"""
일기(diary) 자원 API. (6-1단계: 실제 DB 조회)

※ 이 파일은 특정 화면 전용이 아니라 "일기 자원"을 다루는 API입니다.
  지금은 diary_writing(작성/검토) 화면이 주로 쓰지만, 읽기 주소
  (GET /trips/{id}, GET /trip-days/{id})는 Detail(상세 보기) 등 다른 화면도 재사용합니다.
  그래서 화면명(diary_writing)이 아니라 자원명(diary)으로 둡니다 — settings.py 와 같은 관습.

6-1: 더미 응답 → 실제 DB 조회로 교체 (settings.py 처럼 Depends(get_db) 사용).
  데이터 흐름: trips → trip_days → (diaries, photos) 를 묶어 DayPage/TripDiary 로 변환.
  남은 것: 사진 정적 서빙(6-2), 실제 생성 VLM→LLM(6-3), 재생성 백그라운드(6-4).
"""

import json
import os
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

# 합치기 후: 일기 본문은 trip_days 에 들어가서 Diary 모델은 더 이상 없음.
# PhotoGeneration = 사진별 VLM 분석 이력(2단계화에서 사용).
from app.db.models import DiaryGeneration, Photo, PhotoGeneration, Trip, TripDay
from app.db.session import SessionLocal, get_db
from app.schemas.diary import (
    DayPage,
    DayPhoto,
    DayStatus,
    DayUpdate,
    TripDiary,
    TripStatusUpdate,
)

router = APIRouter(tags=["diary"])

# 사진 파일 경로 해석용 backend 루트. (photos.file_url = "test_images/..." 가 이 폴더 기준)
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
# 생성에 쓰는 모델명(생성 이력 기록용). diary_generator 와 같은 기본값.
_MODEL_NAME = os.getenv("DIARY_MODEL", "gemma4:e4b")


# ─────────────────────────────────────────────────────────────
# DB row → 응답 스키마 변환 헬퍼
# ─────────────────────────────────────────────────────────────

# 생성기는 이제 weather 를 Twemoji 코드포인트로 직접 저장합니다(emotion 과 동일).
# 다만 재생성 전의 옛 데이터에는 한글 텍스트("맑음" 등)가 남아 있을 수 있어, 읽을 때
# 안전하게 변환합니다. 이미 코드포인트면 그대로 통과 → 이 표는 옛 데이터용 fallback.
_WEATHER_CODEPOINTS = {
    "맑음": "2600",  # ☀️
    "흐림": "2601",  # ☁️
    "비": "1f327",  # 🌧️
    "눈": "2744",  # ❄️
    "실내": "",  # 날씨 아님 → 표시 안 함
    "미상": "",  # 알 수 없음 → 표시 안 함
}


def _weather_codepoint(value: str | None) -> str:
    """weather 값을 안전한 코드포인트 문자열로. 모르면 빈 문자열."""
    if not value:
        return ""
    if value in _WEATHER_CODEPOINTS:
        return _WEATHER_CODEPOINTS[value]
    # 이미 코드포인트(hex/하이픈)면 그대로 통과
    if all(c in "0123456789abcdefABCDEF-" for c in value):
        return value
    return ""


def _gen_status(db: Session, trip_day: TripDay) -> str:
    """그 날의 생성 상태 = 그 날의 '최신 diary_generations.status' 를 번역.
    (step4 결정: running→generating, failure→failed, success→ready)
    합치기 후: 생성 이력은 trip_day_id 로 조회. 이력이 없으면 본문 유무로 판단."""
    latest = (
        db.query(DiaryGeneration)
        .filter(DiaryGeneration.trip_day_id == trip_day.id)
        .order_by(DiaryGeneration.id.desc())
        .first()
    )
    if latest is not None:
        if latest.status == "running":
            return "generating"
        if latest.status == "failure":
            return "failed"
        if latest.status == "success":
            return "ready"
    if trip_day.content:
        return "ready"
    return "generating"


def _base_url(request: Request) -> str:
    """요청이 들어온 host 기준 베이스 URL. (실기기에선 PC의 IP가 잡혀 그대로 접속 가능)"""
    return str(request.base_url).rstrip("/")


def _abs_url(base: str, stored: str | None) -> str:
    """DB의 상대경로(test_images/...)를 실제 접속 가능한 절대 URL로.
    한글 파일명은 퍼센트 인코딩(슬래시는 보존)해 어떤 클라이언트에서도 열리게 합니다."""
    if not stored:
        return ""
    return f"{base}/{quote(stored.lstrip('/'), safe='/')}"


def _photo_url(db: Session, base: str, photo_id: int | None) -> str:
    """photos.id → 접속 가능한 file_url. 없으면 빈 문자열. (trip 대표사진 해석용)"""
    if photo_id is None:
        return ""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    return _abs_url(base, photo.file_url) if photo else ""


def _build_day(db: Session, trip_day: TripDay, base: str) -> DayPage:
    """trip_day(일기 내용 포함) + 사진들을 묶어 DayPage 로 만듭니다.
    합치기 후: 일기 본문·상징이 trip_day 에 직접 있어 별도 diary 조회가 없습니다."""
    photos = (
        db.query(Photo)
        .filter(Photo.trip_day_id == trip_day.id, Photo.deleted_at.is_(None))
        .order_by(Photo.display_order)
        .all()
    )
    return DayPage(
        tripDayId=trip_day.id,
        dayNumber=trip_day.day_number,
        date=trip_day.date.isoformat(),  # date → "YYYY-MM-DD"
        locationSummary=trip_day.location_summary or "",
        # Decimal → float. NULL 이면 그대로 None (프론트가 "위치 없음" 분기에 사용).
        representativeLat=float(trip_day.representative_lat) if trip_day.representative_lat is not None else None,
        representativeLon=float(trip_day.representative_lon) if trip_day.representative_lon is not None else None,
        weather=_weather_codepoint(trip_day.weather),
        subtitle=trip_day.subtitle or "",
        emotion=trip_day.emotion or "",
        content=trip_day.content or "",  # 합치기 후: trip_day 에서 직접
        photos=[
            DayPhoto(
                id=p.id,
                thumbnailUrl=_abs_url(base, p.thumbnail_url or p.file_url),
                fileUrl=_abs_url(base, p.file_url),
            )
            for p in photos
        ],
        genStatus=_gen_status(db, trip_day),
    )


def _get_trip_or_404(db: Session, trip_id: int) -> Trip:
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.deleted_at.is_(None))
        .first()
    )
    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


def _get_trip_day_or_404(db: Session, trip_day_id: int) -> TripDay:
    trip_day = db.query(TripDay).filter(TripDay.id == trip_day_id).first()
    if trip_day is None:
        raise HTTPException(status_code=404, detail="TripDay not found")
    return trip_day


# ─────────────────────────────────────────────────────────────
# 엔드포인트
# ─────────────────────────────────────────────────────────────

# ① 여행 전체 조회 — 처음 진입 시 N일치 한 번에
@router.get("/trips/{trip_id}", response_model=TripDiary)
def get_trip(
    trip_id: int, request: Request, db: Session = Depends(get_db)
) -> TripDiary:
    trip = _get_trip_or_404(db, trip_id)
    base = _base_url(request)
    trip_days = (
        db.query(TripDay)
        .filter(TripDay.trip_id == trip_id)
        .order_by(TripDay.day_number)
        .all()
    )
    return TripDiary(
        tripId=trip.id,
        title=trip.title,
        representImage=_photo_url(db, base, trip.cover_photo_id),
        status=trip.status,
        days=[_build_day(db, td, base) for td in trip_days],
    )


# ② 상태 폴링 — "각 날이 ready냐?"만 가볍게
@router.get("/trips/{trip_id}/day-statuses", response_model=list[DayStatus])
def get_day_statuses(trip_id: int, db: Session = Depends(get_db)) -> list[DayStatus]:
    _get_trip_or_404(db, trip_id)
    trip_days = (
        db.query(TripDay)
        .filter(TripDay.trip_id == trip_id)
        .order_by(TripDay.day_number)
        .all()
    )
    result: list[DayStatus] = []
    for td in trip_days:
        # 합치기 후: 상태도 trip_day 기준으로 계산
        result.append(DayStatus(tripDayId=td.id, genStatus=_gen_status(db, td)))
    return result


# ③ 일차 조회 — 어떤 날이 ready되면 그 날 본문만 다시 가져오기
@router.get("/trip-days/{trip_day_id}", response_model=DayPage)
def get_trip_day(
    trip_day_id: int, request: Request, db: Session = Depends(get_db)
) -> DayPage:
    trip_day = _get_trip_day_or_404(db, trip_day_id)
    return _build_day(db, trip_day, _base_url(request))


# ④ 일차 저장 — 여행지(location_summary) + 선택적으로 대표 좌표(lat/lon)
# lat/lon 둘 다 들어오면 함께 저장. 한쪽만 오는 케이스는 무시(현재 UI 가 항상 둘 다 보냄).
@router.patch("/trip-days/{trip_day_id}", response_model=DayPage)
def update_trip_day(
    trip_day_id: int,
    body: DayUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> DayPage:
    trip_day = _get_trip_day_or_404(db, trip_day_id)
    trip_day.location_summary = body.locationSummary
    if body.lat is not None and body.lon is not None:
        trip_day.representative_lat = body.lat
        trip_day.representative_lon = body.lon
    db.commit()
    db.refresh(trip_day)
    return _build_day(db, trip_day, _base_url(request))


# ── 백그라운드 생성 작업 ──
def _run_generation(trip_day_id: int, gen_id: int) -> None:
    """(백그라운드) 2단계 생성 + DB 저장. 요청과 별개로 도니까 새 DB 세션을 엽니다.
      1단계: 사진별 analyze_photo → photo_generations 기록(이미 분석된 사진은 재사용)
      2단계: 모은 분석으로 write_diary → trip_days + diary_generations(success) 저장
    """
    # openai 의존을 서버 시작과 분리하려고 여기서 지연 import.
    from app.services.diary_generator import analyze_photo, write_diary

    db = SessionLocal()
    started = time.monotonic()
    try:
        trip_day = db.query(TripDay).filter(TripDay.id == trip_day_id).first()
        photos = (
            db.query(Photo)
            .filter(Photo.trip_day_id == trip_day_id, Photo.deleted_at.is_(None))
            .order_by(Photo.display_order)
            .all()
        )
        # 콘솔 로그(영문/숫자만 — 어떤 터미널에서도 안 깨지게)
        print(f"[diary-gen] start: trip_day={trip_day_id}, photos={len(photos)}")

        # ── 1단계: 사진별 분석. 이미 성공한 분석이 있으면 재사용(재생성이 빨라짐) ──
        analyses: list[str] = []
        for p in photos:
            cached = (
                db.query(PhotoGeneration)
                .filter(
                    PhotoGeneration.photo_id == p.id,
                    PhotoGeneration.status == "success",
                )
                .order_by(PhotoGeneration.id.desc())
                .first()
            )
            if cached is not None and cached.analysis_text:
                analyses.append(cached.analysis_text)  # 재사용: AI 재호출 없음
                continue

            path = _BACKEND_DIR / p.file_url
            if not path.exists():
                continue  # 파일이 없으면 그 사진은 건너뜀
            try:
                analysis = analyze_photo(path)
                db.add(
                    PhotoGeneration(
                        photo_id=p.id,
                        model_used=_MODEL_NAME,
                        analysis_text=analysis["analysis_text"],
                        analysis_json=analysis["analysis_json"],
                        status="success",
                        created_at=datetime.now(),
                    )
                )
                analyses.append(analysis["analysis_text"])
            except Exception as exc:  # 사진 1장 분석 실패는 기록만 하고 계속 진행
                db.add(
                    PhotoGeneration(
                        photo_id=p.id,
                        model_used=_MODEL_NAME,
                        status="failure",
                        created_at=datetime.now(),
                    )
                )
                print(f"[diary-gen] photo analyze FAILED: photo={p.id}: {exc}")
        db.commit()  # 분석 이력 먼저 저장(2단계가 실패해도 분석은 남도록)

        # ── 2단계: 모은 분석으로 일기 작성(사진 없이 텍스트만) ──
        result = write_diary(
            analyses,
            location=trip_day.location_summary or "",
            date=trip_day.date.isoformat(),
        )

        # 결과 저장: 합치기 후 일기 내용이 trip_day 에 직접 들어감
        trip_day.content = result["content"]
        trip_day.word_count = len(result["content"])
        trip_day.generated_at = datetime.now()
        trip_day.subtitle = result["subtitle"]
        trip_day.emotion = result["emotion"]
        trip_day.weather = result["weather"]  # 생성기가 코드포인트로 줌(없으면 빈 문자열)

        gen = db.query(DiaryGeneration).filter(DiaryGeneration.id == gen_id).first()
        gen.status = "success"
        gen.response_text = json.dumps(result, ensure_ascii=False)
        db.commit()
        elapsed = time.monotonic() - started
        print(
            f"[diary-gen] done: trip_day={trip_day_id} in {elapsed:.1f}s "
            f"(analyses {len(analyses)}, content {len(result['content'])} chars)"
        )
    except Exception as exc:  # 실패 기록 → genStatus 가 failed 로 보이게
        db.rollback()
        gen = db.query(DiaryGeneration).filter(DiaryGeneration.id == gen_id).first()
        if gen is not None:
            gen.status = "failure"
            gen.error_message = str(exc)[:1000]
            db.commit()
        print(f"[diary-gen] FAILED: trip_day={trip_day_id}: {exc}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()


# ⑤ 재생성 — 생성기를 백그라운드로 실행하고 즉시 generating 으로 응답.
@router.post("/trip-days/{trip_day_id}/regenerate", response_model=DayStatus)
def regenerate_trip_day(
    trip_day_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> DayStatus:
    trip_day = _get_trip_day_or_404(db, trip_day_id)

    # 합치기 후: 일기 = trip_day(항상 존재)라 "diary 먼저 만들기"가 불필요해짐(닭-알 해결).
    # 바로 생성 시작 기록(status='running') → 폴링이 generating 으로 봄.
    gen = DiaryGeneration(
        trip_day_id=trip_day_id,
        model_used=_MODEL_NAME,
        status="running",
        created_at=datetime.now(),
    )
    db.add(gen)
    db.commit()

    # 느린 생성은 응답 후 백그라운드에서. (사진 여러 장이면 수십 초)
    background_tasks.add_task(_run_generation, trip_day_id, gen.id)
    return DayStatus(tripDayId=trip_day.id, genStatus="generating")


# ⑥ 최종 저장 — 여행 상태를 'completed'로
@router.patch("/trips/{trip_id}", response_model=TripStatusUpdate)
def update_trip_status(
    trip_id: int, body: TripStatusUpdate, db: Session = Depends(get_db)
) -> TripStatusUpdate:
    trip = _get_trip_or_404(db, trip_id)
    trip.status = body.status
    db.commit()
    return body

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
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

# 합치기 후: 일기 본문은 trip_days 에 들어가서 Diary 모델은 더 이상 없음.
# PhotoGeneration = 사진별 VLM 분석 이력(2단계화에서 사용).
from app.db.models import DiaryGeneration, Photo, PhotoGeneration, Trip, TripDay, User
from app.db.session import SessionLocal, get_db
from app.schemas.diary import (
    DayPage,
    DayPhoto,
    DayStatus,
    DayUpdate,
    TripDiary,
    TripStatusUpdate,
)
from app.services.travel_style_analysis import run_travel_style_analysis
from app.utils.country_flags import country_to_flag
from collections import Counter

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


def _photo_metadata_for_vlm(photo: Photo) -> dict:
    return {
        "taken_at_utc": photo.taken_at_utc.isoformat() if photo.taken_at_utc else "",
        "tz": photo.tz or "",
        "latitude": float(photo.latitude) if photo.latitude is not None else None,
        "longitude": float(photo.longitude) if photo.longitude is not None else None,
        "location_name": photo.location_name or "",
        "city_name": getattr(photo, "city_name", None) or "",
        "country_name": getattr(photo, "country_name", None) or "",
    }


def _confidence_decimal(value: object) -> Decimal | None:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    score = max(0.0, min(1.0, score))
    return Decimal(str(round(score, 3)))


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
        representImage=trip_day.represent_image,
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
        flag=trip.flag,
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
# countryName/cityName 이 함께 오면(picker 의 reverseGeocode 결과), trip.destination 이
# 비어있을 때만 "국가/도시" 형식으로 자동 채웁니다(이미 있으면 보존).
@router.patch("/trip-days/{trip_day_id}", response_model=DayPage)
def update_trip_day(
    trip_day_id: int,
    body: DayUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> DayPage:
    # 진단용 로그 — 어떤 필드가 들어왔는지 확인. 안정화되면 제거.
    print(
        f"데이터 저장하기: "
        f"[trip-day PATCH] id={trip_day_id} "
        f"loc={body.locationSummary!r} content_len={len(body.content) if body.content is not None else None} "
        f"lat={body.lat} lon={body.lon} "
        f"country={body.countryName!r} city={body.cityName!r}"
    )
    trip_day = _get_trip_day_or_404(db, trip_day_id)
    # 부분 업데이트: None 이 아닌 필드만 반영.
    if body.locationSummary is not None:
        trip_day.location_summary = body.locationSummary
    if body.content is not None:
        # 사용자가 본문을 직접 편집한 경우. 글자 수도 함께 갱신.
        trip_day.content = body.content
        trip_day.word_count = len(body.content)
    if body.lat is not None and body.lon is not None:
        # Decimal 컬럼에 float 직접 대입이 일부 환경에서 누락되는 사례 방어.
        trip_day.representative_lat = Decimal(str(round(body.lat, 8)))
        trip_day.representative_lon = Decimal(str(round(body.lon, 8)))
    # 사용자가 고른 그날 대표사진. 검증: 그 photo_id 가 정말 이 trip_day 의 사진인지.
    # 다른 일차의 사진이나 존재하지 않는 id 가 들어오면 400.
    if body.representImage is not None:
        owned = (
            db.query(Photo.id)
            .filter(
                Photo.id == body.representImage,
                Photo.trip_day_id == trip_day.id,
                Photo.deleted_at.is_(None),
            )
            .first()
        )
        if owned is None:
            raise HTTPException(status_code=400, detail="representImage does not belong to this trip_day")
        trip_day.represent_image = body.representImage
    # picker 가 알려준 국가/도시로 trip.destination 자동 보강(비어있을 때만).
    if body.countryName and body.cityName:
        trip = db.query(Trip).filter(Trip.id == trip_day.trip_id).first()
        if trip:
            if not trip.destination:
                trip.destination = f"{body.countryName}/{body.cityName}"
            if not trip.flag:
                trip.flag = country_to_flag(body.countryName)
    db.commit()
    db.refresh(trip_day)
    trip = db.query(Trip).filter(Trip.id == trip_day.trip_id).first()
    if trip:
        from app.services.neo4j_service import update_trip_day_graph
        ok = update_trip_day_graph(trip_day, trip)
        print("neo4j trip_day update result:", ok)
    return _build_day(db, trip_day, _base_url(request))


# ── 백그라운드 생성 작업 ──
def _run_generation(trip_day_id: int, gen_id: int) -> None:
    """(백그라운드) 2단계 생성 + DB 저장. 요청과 별개로 도니까 새 DB 세션을 엽니다.
      1단계: 사진별 analyze_photo → photo_generations 기록(이미 분석된 사진은 재사용)
      2단계: 모은 분석으로 write_diary → trip_days + diary_generations(success) 저장
    """
    # openai 의존을 서버 시작과 분리하려고 여기서 지연 import.
    from app.services.diary_generator import analyze_photo, write_diary
    from app.services.neo4j_service import (Seed,Place,Keyword,Day_Memory,TripData,save_trip_graph,update_trip_day_graph,past_graph_context)
    graph_trip = TripData()
    graph_dayMemory: list[Day_Memory] = []
    graph_place: list[Place] = []
    graph_keyword = Keyword()
    mood_list = []

    db = SessionLocal()
    started = time.monotonic()
    image_path = []
    try:
        trip_day = db.query(TripDay).filter(TripDay.id == trip_day_id).first()
        trip = db.query(Trip).filter(Trip.id == trip_day.trip_id).first()
        user = db.query(User).filter(User.id == trip.user_id).first() if trip else None
        
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
            print("사진 경로:",path)
            image_path.append(path)
            if not path.exists():
                continue  # 파일이 없으면 그 사진은 건너뜀
            try:
                analysis = analyze_photo(path, photo_metadata=_photo_metadata_for_vlm(p))
                analysis_json = analysis["analysis_json"]
                token_usage = analysis.get("token_usage") or {}
                db.add(
                    PhotoGeneration(
                        photo_id=p.id,
                        model_used=_MODEL_NAME,
                        analysis_text=analysis["analysis_text"],
                        analysis_json=analysis_json,
                        place_type=analysis_json.get("place_type"),
                        indoor_outdoor=analysis_json.get("indoor_outdoor"),
                        landmark_guess=analysis_json.get("landmark_guess") or None,
                        landmark_confidence=_confidence_decimal(
                            analysis_json.get("landmark_confidence")
                        ),
                        people_type=analysis_json.get("people_type"),
                        people_importance=analysis_json.get("people_importance"),
                        time_hint=analysis_json.get("time_hint"),
                        time_confidence=_confidence_decimal(
                            analysis_json.get("time_confidence")
                        ),
                        input_tokens=token_usage.get("input_tokens"),
                        output_tokens=token_usage.get("output_tokens"),
                        total_tokens=token_usage.get("total_tokens"),
                        status="success",
                        created_at=datetime.now(),
                    )
                )
                analyses.append(analysis["analysis_text"])
                print("사진속 기분?:",analysis_json.get("mood"))
                mood_list.append(analysis_json.get("mood"))

                # 2. 이중 for문을 사용하여 objects 내부의 아이템들을 set에 추가
                # .get()을 사용해 "objects" 키가 없거나 비어있어도 안전하게 처리
                objects_list = analysis_json.get("objects") or []

                for obj in objects_list:
                    graph_keyword.name.append(str(obj))

                graph_keyword.type.append(analysis_json.get("place_type") or "unknown")
                
                photo_place = Place(
                    name=analysis_json.get("landmark_guess") or "unknown",
                    type=analysis_json.get("place_type") or "unknown",
                    country=p.country_name,
                    city=p.city_name,
                    lat=float(p.latitude) if p.latitude else None,
                    lng=float(p.longitude) if p.longitude else None,
                    confidence=float(analysis_json.get("landmark_confidence") or 0.0)
                )
                graph_place.append(photo_place)
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
        
        persona = (user.writing_persona if user else None) or "daily"
        result = write_diary(
            analyses,
            location=trip_day.location_summary or "",
            date=trip_day.date.isoformat(),
            persona=persona,
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

        # 그래프 디비를 위한 DTO 처리 
        graph_dayMemory.append(
                    Day_Memory(
                        title=trip_day.subtitle,
                        description=trip_day.content,
                        day_number=trip_day.day_number,
                        weather=trip_day.weather,
                        keywords=graph_keyword,
                        mood=Counter(mood_list).most_common(1)[0][0] if mood_list else None,
                        place=graph_place,
                        emotions=trip_day.emotion,
                        summaryShort=result["summaryShort"] # 요약내용
                    )
                )
        graph_trip.title = trip.title
        graph_trip.mood_persona = persona
        graph_trip.travelType=trip.flag
        graph_trip.startDate=trip.start_date
        graph_trip.endDate=trip.end_date

        graph_seed = Seed(
            trip=graph_trip,
            days=graph_dayMemory
        )
        past_graph_context(user.id,graph_seed)
        ok = save_trip_graph(user.id,user.nickname,graph_seed,trip.id)
        print("neo4j 저장 결과: ",ok)


        elapsed = time.monotonic() - started
        print(
            f"[diary-gen] done: trip_day={trip_day_id} in {elapsed:.1f}s "
            f"(analyses {len(analyses)}, content {len(result['content'])} chars)"
        )

        # ── 3단계: 이 여행의 모든 일차가 끝났다면 trip 제목 자동 생성 ──
        # 마지막 일차가 막 success 가 된 지금 시점에서 한 번만 실행.
        # 이미 사용자/AI 가 만든 제목이 있으면(= '새 여행' 기본값이 아니면) 건드리지 않음.
        try:
            remaining = (
                db.query(TripDay)
                .filter(
                    TripDay.trip_id == trip_day.trip_id,
                    (TripDay.content.is_(None)) | (TripDay.content == ""),
                )
                .count()
            )
            trip = db.query(Trip).filter(Trip.id == trip_day.trip_id).first()
            if remaining == 0 and trip is not None and (not trip.title or trip.title == "새 여행"):
                from app.services.diary_generator import write_trip_title

                all_days = (
                    db.query(TripDay)
                    .filter(TripDay.trip_id == trip.id)
                    .order_by(TripDay.day_number)
                    .all()
                )
                days_payload = [
                    {
                        "subtitle": d.subtitle or "",
                        # 너무 길면 토큰 낭비. 앞 200자만 발췌해 분위기 전달.
                        "content_excerpt": (d.content or "")[:200],
                    }
                    for d in all_days
                ]
                trip_photos = (
                    db.query(Photo)
                    .join(TripDay, Photo.trip_day_id == TripDay.id)
                    .filter(
                        TripDay.trip_id == trip.id,
                        Photo.deleted_at.is_(None),
                    )
                    .order_by(TripDay.day_number, Photo.display_order)
                    .all()
                )
                photo_candidates = []
                for photo in trip_photos:
                    latest_analysis = (
                        db.query(PhotoGeneration)
                        .filter(
                            PhotoGeneration.photo_id == photo.id,
                            PhotoGeneration.status == "success",
                        )
                        .order_by(PhotoGeneration.id.desc())
                        .first()
                    )
                    photo_candidates.append(
                        {
                            "img_id": photo.id,
                            "analysis_text": latest_analysis.analysis_text if latest_analysis else "",
                        }
                    )
                title_dict = write_trip_title(
                    days_payload,
                    destination=trip.destination or "",
                    photo_info=photo_candidates,
                )
                if title_dict:
                    generated_title = (title_dict.get("title") or "").strip()
                    generated_img_id = title_dict.get("img_id")
                    if generated_title:
                        trip.title = generated_title
                    if generated_img_id:
                        trip.cover_photo_id = generated_img_id
                    db.commit()
                    ok = update_trip_day_graph(trip_day, trip)
                    print(f"[trip-title] generated: trip={trip.id} title={trip.title}")
        except Exception as exc:
            # 제목 생성 실패해도 일기 본문 흐름엔 영향 없게 — 로그만.
            print(f"[trip-title] FAILED: trip_day={trip_day_id}: {exc}")
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
# 일기 재생성은 응답을 먼저 돌려주고, 실제 생성 작업은 백그라운드에서 실행합니다.
@router.post("/trip-days/{trip_day_id}/regenerate", response_model=DayStatus)
def regenerate_trip_day(
    trip_day_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> DayStatus:
    trip_day = _get_trip_day_or_404(db, trip_day_id)
    print("다이어리 작성 시작 ")
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
    trip_id: int,
    body: TripStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> TripStatusUpdate:
    print("여기가 진짜 저장 하는곳:",trip_id)
    trip = _get_trip_or_404(db, trip_id)
    previous_status = trip.status
    trip.status = body.status
    db.commit()

    if previous_status != "completed" and body.status == "completed":
        # diary 라우터는 완료 시점만 감지하고, 중복 분석 여부와 실제 LLM 작업은 서비스 함수가 처리합니다.
        background_tasks.add_task(run_travel_style_analysis, trip.user_id)

    return body

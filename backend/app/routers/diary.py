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

from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.models import Diary, Photo, Trip, TripDay
from app.db.session import get_db
from app.schemas.diary import (
    DayPage,
    DayPhoto,
    DayStatus,
    DayUpdate,
    TripDiary,
    TripStatusUpdate,
)

router = APIRouter(tags=["diary"])


# ─────────────────────────────────────────────────────────────
# DB row → 응답 스키마 변환 헬퍼
# ─────────────────────────────────────────────────────────────

# DB의 weather 는 한글 텍스트("맑음" 등)로 들어있는데, 프론트는 Twemoji 코드포인트(hex)를
# 기대합니다. 그대로 주면 화면이 깨지므로 여기서 안전하게 변환합니다.
# (생성기가 처음부터 코드포인트로 뱉도록 고치는 건 6-3에서. 여기선 기존 데이터 방어용.)
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


def _gen_status(diary: Diary | None) -> str:
    """그 날의 생성 상태. (6-1 단순 규칙: 본문 있는 일기가 있으면 ready)
    실패 판정·생성 이력(diary_generations) 반영은 6-4에서."""
    if diary is not None and diary.content:
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
    """trip_day + 그날 diary + 사진들을 묶어 DayPage 로 만듭니다."""
    diary = db.query(Diary).filter(Diary.trip_day_id == trip_day.id).first()
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
        weather=_weather_codepoint(trip_day.weather),
        subtitle=trip_day.subtitle or "",
        emotion=trip_day.emotion or "",
        symbol=(diary.symbol if diary else "") or "",
        content=(diary.content if diary else "") or "",
        photos=[
            DayPhoto(
                id=p.id,
                thumbnailUrl=_abs_url(base, p.thumbnail_url or p.file_url),
                fileUrl=_abs_url(base, p.file_url),
            )
            for p in photos
        ],
        genStatus=_gen_status(diary),
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
        diary = db.query(Diary).filter(Diary.trip_day_id == td.id).first()
        result.append(DayStatus(tripDayId=td.id, genStatus=_gen_status(diary)))
    return result


# ③ 일차 조회 — 어떤 날이 ready되면 그 날 본문만 다시 가져오기
@router.get("/trip-days/{trip_day_id}", response_model=DayPage)
def get_trip_day(
    trip_day_id: int, request: Request, db: Session = Depends(get_db)
) -> DayPage:
    trip_day = _get_trip_day_or_404(db, trip_day_id)
    return _build_day(db, trip_day, _base_url(request))


# ④ 일차 저장 — 여행지(location_summary)만 수정
@router.patch("/trip-days/{trip_day_id}", response_model=DayPage)
def update_trip_day(
    trip_day_id: int,
    body: DayUpdate,
    request: Request,
    db: Session = Depends(get_db),
) -> DayPage:
    trip_day = _get_trip_day_or_404(db, trip_day_id)
    trip_day.location_summary = body.locationSummary
    db.commit()
    db.refresh(trip_day)
    return _build_day(db, trip_day, _base_url(request))


# ⑤ 재생성 — 실제 재생성(VLM→LLM)은 6-4에서 백그라운드로 연결. 지금은 현재 상태만 반환.
@router.post("/trip-days/{trip_day_id}/regenerate", response_model=DayStatus)
def regenerate_trip_day(
    trip_day_id: int, db: Session = Depends(get_db)
) -> DayStatus:
    trip_day = _get_trip_day_or_404(db, trip_day_id)
    diary = db.query(Diary).filter(Diary.trip_day_id == trip_day_id).first()
    return DayStatus(tripDayId=trip_day.id, genStatus=_gen_status(diary))


# ⑥ 최종 저장 — 여행 상태를 'completed'로
@router.patch("/trips/{trip_id}", response_model=TripStatusUpdate)
def update_trip_status(
    trip_id: int, body: TripStatusUpdate, db: Session = Depends(get_db)
) -> TripStatusUpdate:
    trip = _get_trip_or_404(db, trip_id)
    trip.status = body.status
    db.commit()
    return body

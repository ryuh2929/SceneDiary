"""
일기(diary) 자원 API. (4단계: 계약 + 더미 응답)

※ 이 파일은 특정 화면 전용이 아니라 "일기 자원"을 다루는 API입니다.
  지금은 diary_writing(작성/검토) 화면이 주로 쓰지만, 읽기 주소
  (GET /trips/{id}, GET /trip-days/{id})는 Detail(상세 보기) 등 다른 화면도 재사용합니다.
  그래서 화면명(diary_writing)이 아니라 자원명(diary)으로 둡니다 — settings.py 와 같은 관습.

지금은 DB를 안 보고 아래 _DUMMY_TRIP 고정 데이터를 돌려줍니다.
실제 DB 조회·AI 생성·사진 URL 변환은 6단계에서 이 함수들 속을 채웁니다.
주소·요청/응답 "모양"은 schemas/diary.py 로 확정 (프론트 types/diary_writing.ts 와 1:1).

settings.py 와 같은 방식(APIRouter + response_model + 404 처리)으로 작성합니다.
"""

from fastapi import APIRouter, HTTPException

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
# 더미 데이터 (6단계에서 실제 DB 조회로 교체)
#   모양 확인용 최소 2일치. 1일차=ready, 2일차=generating(본문 빈 채).
#   사진 URL은 picsum placeholder (실제 변환은 6단계).
# ─────────────────────────────────────────────────────────────
_DUMMY_DAYS: list[DayPage] = [
    DayPage(
        tripDayId=1,
        dayNumber=1,
        date="2026-05-01",
        locationSummary="신시모도",
        weather="2600",  # ☀️
        subtitle="시모도의 빛으로 적신 갯벌",
        emotion="1f60c",  # 😌
        symbol="1f30a",  # 🌊
        content="신시모도에 발을 디딘 날, 세상의 모든 소음이 저만치 흩어지는 기분이었다.",
        photos=[
            DayPhoto(
                id=1,
                thumbnailUrl="https://picsum.photos/seed/sd-1/200/200",
                fileUrl="https://picsum.photos/seed/sd-1/800/800",
            ),
        ],
        genStatus="ready",
    ),
    DayPage(
        tripDayId=2,
        dayNumber=2,
        date="2026-05-02",
        locationSummary="제부도",
        weather="1f3e0",  # 🏠
        subtitle="",
        emotion="",
        symbol="",
        content="",  # 생성 중이라 본문 비어 있음
        photos=[],
        genStatus="generating",
    ),
]

_DUMMY_TRIP = TripDiary(
    tripId=1,
    title="신시모-제부-부산-포항, 바다의 빛과 시간 여행",
    representImage="https://picsum.photos/seed/sd-cover/400/400",
    status="draft",
    days=_DUMMY_DAYS,
)


def _find_day(trip_day_id: int) -> DayPage:
    """더미에서 trip_day_id 로 하루를 찾습니다. 없으면 404."""
    for day in _DUMMY_DAYS:
        if day.tripDayId == trip_day_id:
            return day
    raise HTTPException(status_code=404, detail="TripDay not found")


# ① 여행 전체 조회 — 처음 진입 시 N일치 한 번에
@router.get("/trips/{trip_id}", response_model=TripDiary)
def get_trip(trip_id: int) -> TripDiary:
    if trip_id != _DUMMY_TRIP.tripId:
        raise HTTPException(status_code=404, detail="Trip not found")
    return _DUMMY_TRIP


# ② 상태 폴링 — "각 날이 ready냐?"만 가볍게
@router.get("/trips/{trip_id}/day-statuses", response_model=list[DayStatus])
def get_day_statuses(trip_id: int) -> list[DayStatus]:
    if trip_id != _DUMMY_TRIP.tripId:
        raise HTTPException(status_code=404, detail="Trip not found")
    return [DayStatus(tripDayId=d.tripDayId, genStatus=d.genStatus) for d in _DUMMY_DAYS]


# ③ 일차 조회 — 어떤 날이 ready되면 그 날 본문만 다시 가져오기
@router.get("/trip-days/{trip_day_id}", response_model=DayPage)
def get_trip_day(trip_day_id: int) -> DayPage:
    return _find_day(trip_day_id)


# ④ 일차 저장 — 여행지(locationSummary)만 수정
@router.patch("/trip-days/{trip_day_id}", response_model=DayPage)
def update_trip_day(trip_day_id: int, body: DayUpdate) -> DayPage:
    day = _find_day(trip_day_id)
    # 더미: 받은 값을 그대로 반영해 돌려줌 (실제 DB 저장은 6단계)
    return day.model_copy(update={"locationSummary": body.locationSummary})


# ⑤ 재생성 — 실패한 날 다시 생성 요청
@router.post("/trip-days/{trip_day_id}/regenerate", response_model=DayStatus)
def regenerate_trip_day(trip_day_id: int) -> DayStatus:
    day = _find_day(trip_day_id)
    # 더미: 요청 즉시 generating 으로 응답 (실제 생성은 6단계)
    return DayStatus(tripDayId=day.tripDayId, genStatus="generating")


# ⑥ 최종 저장 — 여행 상태를 'completed'로
@router.patch("/trips/{trip_id}", response_model=TripStatusUpdate)
def update_trip_status(trip_id: int, body: TripStatusUpdate) -> TripStatusUpdate:
    if trip_id != _DUMMY_TRIP.tripId:
        raise HTTPException(status_code=404, detail="Trip not found")
    # 더미: 받은 status 를 그대로 echo (실제 DB 저장은 6단계)
    return body

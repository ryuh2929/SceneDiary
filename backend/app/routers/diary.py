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

import time

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
#   _DUMMY_DAYS = 각 날의 "완성된(ready)" 모습 2일치. genStatus·본문은
#   아래 _gen_status / _day_view 가 "시간"에 따라 계산해 덮어씁니다.
#   (서버가 뜬 뒤 시간이 지나면 다음 날이 ready로 — 5-3 폴링 확인용)
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
        subtitle="제부의 오후, 일상의 빛과 맛",
        emotion="1f604",  # 😄
        symbol="1f41a",  # 🐚
        content="제부도는 언제나 빛으로 가득 찬 공간이다. 친구들과 웃고, 활기찬 순간들을 카메라에 담는 시간은 그 자체로 기쁨이었다.",
        photos=[
            DayPhoto(
                id=4,
                thumbnailUrl="https://picsum.photos/seed/sd-4/200/200",
                fileUrl="https://picsum.photos/seed/sd-4/800/800",
            ),
            DayPhoto(
                id=5,
                thumbnailUrl="https://picsum.photos/seed/sd-5/200/200",
                fileUrl="https://picsum.photos/seed/sd-5/800/800",
            ),
        ],
        genStatus="ready",
    ),
]

_DUMMY_TRIP = TripDiary(
    tripId=1,
    title="신시모-제부-부산-포항, 바다의 빛과 시간 여행",
    representImage="https://picsum.photos/seed/sd-cover/400/400",
    status="draft",
    days=_DUMMY_DAYS,
)


# ── "시간차" 생성 시뮬레이션 (데모용) ──
# 서버가 뜬 시점부터 _READY_INTERVAL_SEC 마다 한 날씩 ready가 됩니다. (0번째 날은 처음부터 ready)
_START = time.monotonic()
_READY_INTERVAL_SEC = 6.0


def _gen_status(index: int) -> str:
    """index번째 날의 현재 생성 상태를 '경과 시간'으로 계산합니다."""
    elapsed = time.monotonic() - _START
    ready_count = 1 + int(elapsed // _READY_INTERVAL_SEC)
    return "ready" if index < ready_count else "generating"


def _day_view(index: int) -> DayPage:
    """index번째 날을 '현재 시각 기준' 모습으로 만들어 돌려줍니다.
    아직 생성 중이면 본문·사진 등 생성 결과는 비워서 보냅니다(기본 정보만).
    """
    base = _DUMMY_DAYS[index]
    if _gen_status(index) == "ready":
        return base  # 이미 genStatus="ready" + 본문 채워져 있음
    return base.model_copy(
        update={
            "genStatus": "generating",
            "subtitle": "",
            "emotion": "",
            "symbol": "",
            "content": "",
            "photos": [],
        }
    )


def _find_index(trip_day_id: int) -> int:
    """trip_day_id 로 날의 위치(index)를 찾습니다. 없으면 404."""
    for i, day in enumerate(_DUMMY_DAYS):
        if day.tripDayId == trip_day_id:
            return i
    raise HTTPException(status_code=404, detail="TripDay not found")


# ① 여행 전체 조회 — 처음 진입 시 N일치 한 번에 (각 날은 현재 시각 기준 상태로)
@router.get("/trips/{trip_id}", response_model=TripDiary)
def get_trip(trip_id: int) -> TripDiary:
    if trip_id != _DUMMY_TRIP.tripId:
        raise HTTPException(status_code=404, detail="Trip not found")
    # 데모용: 화면에 들어올 때마다 "생성중" 타이머를 다시 시작 → 매번 전환을 볼 수 있게.
    # (실제 DB 연결되는 6단계에선 이 줄을 지웁니다 — 진짜 생성 상태를 읽으니까)
    global _START
    _START = time.monotonic()
    days = [_day_view(i) for i in range(len(_DUMMY_DAYS))]
    return _DUMMY_TRIP.model_copy(update={"days": days})


# ② 상태 폴링 — "각 날이 ready냐?"만 가볍게
@router.get("/trips/{trip_id}/day-statuses", response_model=list[DayStatus])
def get_day_statuses(trip_id: int) -> list[DayStatus]:
    if trip_id != _DUMMY_TRIP.tripId:
        raise HTTPException(status_code=404, detail="Trip not found")
    return [
        DayStatus(tripDayId=d.tripDayId, genStatus=_gen_status(i))
        for i, d in enumerate(_DUMMY_DAYS)
    ]


# ③ 일차 조회 — 어떤 날이 ready되면 그 날 본문만 다시 가져오기
@router.get("/trip-days/{trip_day_id}", response_model=DayPage)
def get_trip_day(trip_day_id: int) -> DayPage:
    return _day_view(_find_index(trip_day_id))


# ④ 일차 저장 — 여행지(locationSummary)만 수정
@router.patch("/trip-days/{trip_day_id}", response_model=DayPage)
def update_trip_day(trip_day_id: int, body: DayUpdate) -> DayPage:
    day = _day_view(_find_index(trip_day_id))
    # 더미: 받은 값을 그대로 반영해 돌려줌 (실제 DB 저장은 6단계)
    return day.model_copy(update={"locationSummary": body.locationSummary})


# ⑤ 재생성 — 실패한 날 다시 생성 요청
@router.post("/trip-days/{trip_day_id}/regenerate", response_model=DayStatus)
def regenerate_trip_day(trip_day_id: int) -> DayStatus:
    index = _find_index(trip_day_id)
    # 더미: 요청 즉시 generating 으로 응답 (실제 생성은 6단계)
    return DayStatus(tripDayId=_DUMMY_DAYS[index].tripDayId, genStatus="generating")


# ⑥ 최종 저장 — 여행 상태를 'completed'로
@router.patch("/trips/{trip_id}", response_model=TripStatusUpdate)
def update_trip_status(trip_id: int, body: TripStatusUpdate) -> TripStatusUpdate:
    if trip_id != _DUMMY_TRIP.tripId:
        raise HTTPException(status_code=404, detail="Trip not found")
    # 더미: 받은 status 를 그대로 echo (실제 DB 저장은 6단계)
    return body

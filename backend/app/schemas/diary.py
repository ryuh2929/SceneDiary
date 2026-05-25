"""
일기(diary) 자원 API가 주고받는 데이터의 "모양(계약)" 정의.

※ 특정 화면 전용이 아니라 "일기 자원"의 모양입니다(routers/diary.py 와 짝).
  지금은 diary_writing 화면이 주로 쓰지만 Detail 등 다른 화면도 재사용 → 화면명 아닌 자원명(diary).

이 파일은 프론트의 frontend/src/types/diary_writing.ts 와 1:1로 짝을 이룹니다.
(TS의 type X = {...}  ↔  여기의 class X(BaseModel))
필드 이름·모양을 똑같이 맞춰야 5단계에서 mock → 실제 API로 교체할 때 안 깨집니다.

settings.py 와 같은 방식(Pydantic BaseModel)으로 작성합니다.
"""

from typing import Literal

from pydantic import BaseModel

# 하루 일기의 생성 상태. TS의 GenStatus 와 동일.
#   ready      : 생성 완료
#   generating : 생성 중
#   failed     : 생성 실패
# ※ DB엔 이 이름의 컬럼이 없는 "화면 전용" 값.
#   출처 = 그 일기의 가장 최근 diary_generations.status (생성 시도 이력의 최신 줄).
#   서버가 그 값을 화면 단어로 "번역"해서 내려줍니다(success→ready, failure→failed).
#   이 번역 로직은 6단계(실제 DB 연결). 더미 단계엔 "ready" 고정.
GenStatus = Literal["ready", "generating", "failed"]


# 사진 1장. TS의 DayPhoto 와 동일. (하단 "대표 사진" 바에 들어가는 그날 사진들)
class DayPhoto(BaseModel):
    id: int  # photos.id
    thumbnailUrl: str  # photos.thumbnail_url — 바에 보이는 썸네일
    fileUrl: str  # photos.file_url — 원본


# 하루치 = trip_day + 그날 diary (페이지 1장). TS의 DayPage 와 동일.
class DayPage(BaseModel):
    tripDayId: int  # trip_days.id
    dayNumber: int  # trip_days.day_number (1..N)
    date: str  # trip_days.date — "YYYY-MM-DD"
    locationSummary: str  # trip_days.location_summary — 이 화면의 유일한 편집 대상(지도)
    weather: str  # trip_days.weather — Twemoji 코드포인트(hex)
    subtitle: str  # trip_days.subtitle — 소제목
    emotion: str  # trip_days.emotion — Twemoji 코드포인트(hex)
    symbol: str  # trip_days.symbol — Twemoji 코드포인트(hex). 빈 문자열일 수 있음
    content: str  # trip_days.content — 본문
    photos: list[DayPhoto]  # 그날 다이어리용 사진들
    genStatus: GenStatus  # 위 GenStatus 참고 (출처 = 최신 diary_generations.status 번역)


# 여행 전체 (모든 페이지 공통 정보 + 하루치 배열). TS의 TripDiary 와 동일.
class TripDiary(BaseModel):
    tripId: int  # trips.id
    title: str  # trips.title — 매 페이지 동일한 큰 제목
    # trips.cover_photo_id 가 가리키는 사진의 URL. VLM이 고른 trip 대표사진(매 페이지 동일).
    representImage: str
    status: str  # trips.status — 최종 저장 시 'completed'
    days: list[DayPage]  # 길이 = N (총 일수)


# ─────────────────────────────────────────────────────────────
# 폴링·요청용 (가벼운 스키마들)
# ─────────────────────────────────────────────────────────────

# 상태 폴링 응답 1개. "각 날이 ready냐?"만 가볍게 확인 (content 등 본문은 안 보냄).
class DayStatus(BaseModel):
    tripDayId: int  # trip_days.id
    genStatus: GenStatus  # ready / generating / failed


# 일차 저장(PATCH) 요청 body. 이 화면의 유일한 편집 대상 = 여행지.
# (지도 좌표 lat/lon은 지도 피커 실제 구현 시 추가 예정)
class DayUpdate(BaseModel):
    locationSummary: str  # trip_days.location_summary


# 최종 저장(PATCH /trips) 요청 body. 여행 상태를 'completed'로 변경.
class TripStatusUpdate(BaseModel):
    status: str  # trips.status

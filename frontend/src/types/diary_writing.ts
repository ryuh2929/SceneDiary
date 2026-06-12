// 일기 작성/검토 화면에서 쓰는 타입.
// 이 화면 = "여행 1개(TripDiary)"를 "하루씩(DayPage)" 순서대로 검토하는 멀티데이 뷰어.
// 각 필드 옆 주석 = 실제 DB 컬럼 (backend/app/db/models.py 기준).

// 하루 일기의 생성 상태 (프론트 표시용. DB엔 없는 화면 전용 값).
//   ready      : 생성 완료 → 전체 표시
//   generating : 백엔드 생성 중 → 이전 날의 "다음날로" 버튼이 비활성("다음 추억 생성중")
//   failed     : 생성 실패 → 제목+사진바만, "일기 다시 생성하기" 버튼
export type GenStatus = 'ready' | 'generating' | 'failed';

// 사진 1장 (하단 "대표 사진" 바에 들어가는 그날 사진들)
export type DayPhoto = {
  id: number; // photos.id
  thumbnailUrl: string; // photos.thumbnail_url — 바에 보이는 썸네일
  fileUrl: string; // photos.file_url — 원본
};

// 하루치 = trip_day + 그날 diary (페이지 1장)
export type DayPage = {
  tripDayId: number; // trip_days.id
  dayNumber: number; // trip_days.day_number (1..N)
  date: string; // trip_days.date — "YYYY-MM-DD"
  locationSummary: string; // trip_days.location_summary — ✏️ 이 화면의 유일한 편집 대상(지도)
  // 사진 GPS가 없거나 사용자가 아직 지정 안 했으면 null.
  // 이 두 값이 null 이면 화면에서 "위치 정보 없음" 강조 카드를 띄웁니다.
  representativeLat: number | null; // trip_days.representative_lat
  representativeLon: number | null; // trip_days.representative_lon
  weather: string; // trip_days.weather — Twemoji 코드포인트(hex). emotion 과 동일 방식
  subtitle: string; // trip_days.subtitle — 소제목
  emotion: string; // trip_days.emotion — Twemoji 코드포인트(hex)
  content: string; // trip_days.content — 본문
  photos: DayPhoto[]; // 그날 다이어리용 사진들
  genStatus: GenStatus; // 위 참고
};

// 여행 전체 (모든 페이지 공통 정보 + 하루치 배열)
export type TripDiary = {
  flag: string;
  tripId: number; // trips.id
  title: string; // trips.title — 매 페이지 동일한 큰 제목
  // trips.cover_photo_id 가 가리키는 사진의 URL. VLM이 고른 trip 대표사진(매 페이지 동일).
  representImage: string;
  status: string; // trips.status — 최종 저장 시 'completed'
  days: DayPage[]; // 길이 = N (총 일수)
};

// ── 요청/상태용 (백엔드 schemas/diary.py 와 1:1, 5단계 API 연동에서 사용) ──

// 상태 폴링 응답 1개. "각 날이 ready냐?"만 가볍게 (본문은 안 옴).
export type DayStatus = {
  tripDayId: number; // trip_days.id
  genStatus: GenStatus; // ready / generating / failed
};

// 일차 부분 업데이트(PATCH) 요청 body.
// 모든 필드 옵셔널 — 호출자는 자기가 바꾸려는 것만 보내면 됩니다.
//   · 위치만: { locationSummary, lat, lon, countryName, cityName }
//   · 본문만: { content }
// 백엔드는 None 이 아닌 필드만 업데이트합니다.
export type DayUpdate = {
  locationSummary?: string; // trip_days.location_summary
  content?: string; // trip_days.content — 본문(사용자가 편집한 일기 텍스트)
  lat?: number; // trip_days.representative_lat
  lon?: number; // trip_days.representative_lon
  countryName?: string; // trip.destination 의 "국가" 부분
  cityName?: string; // trip.destination 의 "도시" 부분
};

// 최종 저장(PATCH /trips) 요청 body. 여행 상태를 'completed'로.
export type TripStatusUpdate = {
  status: string; // trips.status
};

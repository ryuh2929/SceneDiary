// 일기(diary) 자원 API 호출 함수들. 백엔드 routers/diary.py 의 6개 엔드포인트와 1:1.
// settings-api.ts 와 같은 방식으로 작성합니다(자체 포함 — baseURL 로직 동일).
// 5단계에서 화면(diary_writing.tsx)이 mock 대신 이 함수들을 부르게 됩니다.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  DayPage,
  DayStatus,
  DayUpdate,
  TripDiary,
  TripStatusUpdate,
} from '@/types/diary_writing';
import type {
  FirstDayUploadResponse,
  GenerationResponse,
} from '@/types/api';

import { useUserStore } from '@/data/userStore';
// 백엔드 주소를 알아냅니다. (settings-api.ts 와 동일)
//   1) 환경변수 EXPO_PUBLIC_API_BASE_URL 이 있으면 그걸 사용
//   2) 실기기/Expo 실행 중이면 개발 PC의 IP:8000
//   3) 그 외(웹)는 localhost:8000
export function getApiBaseUrl() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (Platform.OS !== 'web' && Constants.expoConfig?.hostUri) {
    const host = Constants.expoConfig.hostUri.split(':')[0];
    return `http://${host}:8000`;
  }

  return 'http://localhost:8000';
}

// 공통 요청 헬퍼. 주소로 fetch → 실패하면 에러를 던지고 → 성공하면 JSON을 타입 T로 돌려줍니다.
// (6개 함수가 매번 같은 ok 검사·json 변환을 반복하지 않도록 한 곳에 모음)
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const method = options?.method ?? 'GET';
    throw new Error(`API 요청 실패: ${method} ${path} (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function uploadFirstDayPhotos(photos: {
  fileUri: string;
  originalFilename: string;
  mimeType: string;
  takenDate?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  placeName?: string;
  countryName?: string;
  cityName?: string;
}[], options?: {
  tripId?: string;
  dayNumber?: number;
}) {
  const formData = new FormData();
  formData.append('day_number', String(options?.dayNumber ?? 1));
  formData.append('title', '새 여행');
  if (options?.tripId) {
    formData.append('trip_id', options.tripId);
  }

  for (const photo of photos) {
    console.log("upload 할려는 User ID:", useUserStore.getState().userProfile?.userId);
    formData.append('user_id',String(useUserStore.getState().userProfile?.userId));
    formData.append('photo_dates', photo.takenDate ?? '');
    // 리사이즈 후 EXIF가 사라지므로 리사이즈 전에 추출한 GPS를 별도 form 필드로 전송합니다.
    formData.append('photo_gps_latitudes', photo.gpsLatitude != null ? String(photo.gpsLatitude) : '');
    formData.append('photo_gps_longitudes', photo.gpsLongitude != null ? String(photo.gpsLongitude) : '');
    // OS 지오코딩 결과(지명). 백엔드가 photo.location_name + 일차/여행 단위 집계에 사용.
    formData.append('photo_place_names', photo.placeName ?? '');
    formData.append('photo_country_names', photo.countryName ?? '');
    formData.append('photo_city_names', photo.cityName ?? '');
    if (Platform.OS === 'web') {
      const blob = await fetch(photo.fileUri).then((response) => response.blob());
      formData.append('files', blob, photo.originalFilename);
    } else {
      formData.append('files', {
        uri: photo.fileUri,
        name: photo.originalFilename,
        type: photo.mimeType,
      } as unknown as Blob);
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/trips/upload-first-day`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`사진 업로드 실패 (${response.status})`);
  }

  return (await response.json()) as FirstDayUploadResponse;
}

export function fetchTripDayGenerationStatus(tripDayId: number) {
  return request<GenerationResponse>(`/trip-days/${tripDayId}/generation-status`);
}

// ── 6개 엔드포인트 호출 함수 (routers/diary.py 와 1:1) ──

// ① 여행 전체 조회 — 화면 진입 시 N일치 한 번에
export function fetchTripDiary(tripId: number) {
  return request<TripDiary>(`/trips/${tripId}`);
}

// ② 상태 폴링 — 각 날의 genStatus만 가볍게
export function fetchDayStatuses(tripId: number) {
  return request<DayStatus[]>(`/trips/${tripId}/day-statuses`);
}

// ③ 일차 조회 — ready된 날의 본문을 다시 가져옴
export function fetchTripDay(tripDayId: number) {
  return request<DayPage>(`/trip-days/${tripDayId}`);
}

// ④ 일차 저장 — 여행지 이름(locationSummary) + 선택적으로 좌표(lat/lon)
// 지도 피커에서 위치를 고른 경우 좌표까지 같이 넘어옵니다. 좌표 없이 이름만 저장도 가능.
// lat/lon 둘 다 있을 때만 body 에 포함 (한쪽만 있는 어중간한 데이터는 안 보냄)
export function saveDayLocation(
  tripDayId: number,
  locationSummary: string,
  lat?: number,
  lon?: number,
  countryName?: string,
  cityName?: string,
) {
  const body: DayUpdate = { locationSummary };
  if (lat !== undefined && lon !== undefined) {
    body.lat = lat;
    body.lon = lon;
  }
  // 국가/도시 둘 다 있을 때만 보냄 — 백엔드가 trip.destination 빈 경우에만 채움.
  if (countryName && cityName) {
    body.countryName = countryName;
    body.cityName = cityName;
  }
  return request<DayPage>(`/trip-days/${tripDayId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ④-② 본문 저장 — 사용자가 일기 본문을 직접 편집하고 저장할 때
// 같은 PATCH 엔드포인트지만 content 만 보냅니다(부분 업데이트).
export function saveDayContent(tripDayId: number, content: string) {
  const body: DayUpdate = { content };
  return request<DayPage>(`/trip-days/${tripDayId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ⑤ 재생성 — 실패한 날 다시 생성 요청
export function regenerateDay(tripDayId: number) {
  return request<DayStatus>(`/trip-days/${tripDayId}/regenerate`, {
    method: 'POST',
  });
}

// ⑥ 최종 저장 — 여행 상태를 'completed'로
export function completeTrip(tripId: number) {
  const body: TripStatusUpdate = { status: 'completed' };
  return request<TripStatusUpdate>(`/trips/${tripId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

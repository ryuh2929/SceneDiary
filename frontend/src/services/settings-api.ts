import type { SettingsProfile, SettingsToggle, TravelTypeIconName } from '@/data/settings';
import { Platform } from 'react-native';
import { getApiBaseUrl } from '@/services/api-base-url';
import { ensureCurrentUser } from '@/services/user-api';

export type TravelStyleAnalysisStatus = {
  status: 'idle' | 'running' | 'success' | 'failed';
  message?: string | null;
};

export async function fetchSettingsProfile() {
  const userUuid = await ensureCurrentUser();
  const query = new URLSearchParams({ user_uuid: userUuid });
  const response = await fetch(`${getApiBaseUrl()}/settings/profile?${query.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to load settings profile.');
  }

  const profile = (await response.json()) as SettingsProfile;

  return normalizeSettingsProfile(profile);
}

export async function updateWritingPersona(personaId: string) {
  const userUuid = await ensureCurrentUser();
  const query = new URLSearchParams({ user_uuid: userUuid });

  // 선택한 페르소나 id만 서버로 보내고, 서버는 현재 user_uuid 유저의 writing_persona 컬럼을 갱신합니다.
  const response = await fetch(`${getApiBaseUrl()}/settings/persona?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ persona_id: personaId }),
  });

  if (!response.ok) {
    throw new Error('Failed to update writing persona.');
  }

  const profile = (await response.json()) as SettingsProfile;

  return normalizeSettingsProfile(profile);
}

export async function updateSettingsToggle(toggleId: SettingsToggle['id'], enabled: boolean) {
  const userUuid = await ensureCurrentUser();
  const query = new URLSearchParams({ user_uuid: userUuid });

  // 화면에서 쓰는 토글 id와 값을 보내면 백엔드가 실제 DB 컬럼으로 매핑해서 저장합니다.
  const response = await fetch(`${getApiBaseUrl()}/settings/toggle?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ toggle_id: toggleId, enabled }),
  });

  if (!response.ok) {
    throw new Error('Failed to update settings toggle.');
  }

  const profile = (await response.json()) as SettingsProfile;

  return normalizeSettingsProfile(profile);
}

export async function updateNickname(nickname: string) {
  const userUuid = await ensureCurrentUser();
  const query = new URLSearchParams({ user_uuid: userUuid });

  // 닉네임은 현재 user_uuid 유저의 users.nickname 컬럼에 저장됩니다.
  const response = await fetch(`${getApiBaseUrl()}/settings/nickname?${query.toString()}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nickname }),
  });

  if (!response.ok) {
    throw new Error('Failed to update nickname.');
  }

  const profile = (await response.json()) as SettingsProfile;

  return normalizeSettingsProfile(profile);
}

export async function uploadProfileImage(file: {
  uri: string;
  name: string;
  mimeType: string;
}) {
  const userUuid = await ensureCurrentUser();
  const query = new URLSearchParams({ user_uuid: userUuid });
  const formData = new FormData();

  // 프로필 사진은 설정 화면에서 256x256 JPEG로 정리한 뒤 이 함수로 업로드합니다.
  // multipart 요청은 JSON 헤더를 직접 넣지 않아야 브라우저/앱이 boundary를 자동으로 붙여줍니다.
  if (Platform.OS === 'web') {
    const blob = await fetch(file.uri).then((response) => response.blob());
    const jpegBlob = blob.type ? blob : new Blob([blob], { type: file.mimeType });
    formData.append('file', jpegBlob, file.name);
  } else {
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }

  const response = await fetch(`${getApiBaseUrl()}/settings/profile-image?${query.toString()}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to update profile image.');
  }

  const profile = (await response.json()) as SettingsProfile;

  return normalizeSettingsProfile(profile);
}

export async function requestTravelStyleAnalysis() {
  const userUuid = await ensureCurrentUser();
  const query = new URLSearchParams({ user_uuid: userUuid });

  // 설정 화면의 분석 버튼은 백엔드에 분석 작업 예약만 요청하고, 실제 분석은 서버 백그라운드에서 진행됩니다.
  const response = await fetch(`${getApiBaseUrl()}/settings/travel-style-analysis?${query.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to request travel style analysis.');
  }

  const profile = (await response.json()) as SettingsProfile;

  return normalizeSettingsProfile(profile);
}

export async function fetchTravelStyleAnalysisStatus() {
  const userUuid = await ensureCurrentUser();
  const query = new URLSearchParams({ user_uuid: userUuid });

  // 분석 요청 자체는 바로 성공할 수 있지만, 실제 LLM 작업은 백그라운드에서 실패할 수 있어서 상태를 따로 확인합니다.
  const response = await fetch(`${getApiBaseUrl()}/settings/travel-style-analysis/status?${query.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to load travel style analysis status.');
  }

  return (await response.json()) as TravelStyleAnalysisStatus;
}

function normalizeTravelTypeIcon(icon: unknown): TravelTypeIconName {
  // 백엔드가 재시작되지 않은 경우 예전 { ios, android, web } 형태가 올 수 있어서 프론트에서 한 번 더 정리합니다.
  const iconKey =
    typeof icon === 'string'
      ? icon
      : icon && typeof icon === 'object' && 'web' in icon
        ? String(icon.web)
        : '';

  // 백엔드 재시작 전 응답이나 잘못된 DB 값이 와도 화면이 깨지지 않도록 허용 목록만 통과시킵니다.
  const travelTypeIconNames = new Set<TravelTypeIconName>([
    'Flower2',
    'Camera',
    'Compass',
    'Trees',
    'TreePalm',
    'TentTree',
    'Binoculars',
    'FlameKindling',
    'PartyPopper',
    'Martini',
    'Beer',
    'BottleWine',
    'Wine',
    'Hamburger',
    'Sandwich',
    'Utensils',
    'TicketsPlane',
    'Map',
    'Helicopter',
    'Ship',
    'CarFront',
    'Amphora',
    'Landmark',
    'FerrisWheel',
    'RollerCoaster',
    'Mountain',
    'Coffee',
    'Building',
    'Castle',
    'Hotel',
    'House',
    'Sailboat',
    'FishingHook',
    'Fish',
    'IceCreamBowl',
    'Soup',
    'CookingPot',
    'Cookie',
    'Dog',
    'Snail',
    'Squirrel',
    'Turtle',
    'Bird',
    'Bug',
    'Origami',
    'Footprints',
    'Rose',
    'Baby',
    'CircleDollarSign',
    'Snowflake',
    'Sun',
    'NotebookPen',
  ]);

  if (travelTypeIconNames.has(iconKey as TravelTypeIconName)) {
    return iconKey as TravelTypeIconName;
  }

  // 예전 응답이나 웹사이트 kebab-case 이름이 들어와도 현재 기본 아이콘으로 안전하게 돌립니다.
  return 'NotebookPen';
}

function normalizeSettingsProfile(profile: SettingsProfile): SettingsProfile {
  return {
    ...profile,
    travelType: {
      ...profile.travelType,
      icon: normalizeTravelTypeIcon(profile.travelType.icon),
    },
  };
}

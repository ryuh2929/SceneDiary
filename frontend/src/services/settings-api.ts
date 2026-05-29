import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { SettingsProfile, SettingsToggle, TravelTypeIconName } from '@/data/settings';
import { getOrCreateUserUuid } from '@/services/user-uuid';

function getApiBaseUrl() {
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

export async function fetchSettingsProfile() {
  const userUuid = await getOrCreateUserUuid();
  const query = new URLSearchParams({ user_uuid: userUuid });
  const response = await fetch(`${getApiBaseUrl()}/settings/profile?${query.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to load settings profile.');
  }

  const profile = (await response.json()) as SettingsProfile;

  return normalizeSettingsProfile(profile);
}

export async function updateWritingPersona(personaId: string) {
  const userUuid = await getOrCreateUserUuid();
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
  const userUuid = await getOrCreateUserUuid();
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
  const userUuid = await getOrCreateUserUuid();
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

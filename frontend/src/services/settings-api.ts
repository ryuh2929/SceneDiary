import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { SettingsProfile, SettingsToggle, TravelTypeIconName } from '@/data/settings';
import { getOrCreateDeviceId } from '@/services/device-id';

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
  const deviceId = await getOrCreateDeviceId();
  const query = new URLSearchParams({ device_id: deviceId });
  const response = await fetch(`${getApiBaseUrl()}/settings/profile?${query.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to load settings profile.');
  }

  const profile = (await response.json()) as SettingsProfile;

  return normalizeSettingsProfile(profile);
}

export async function updateWritingPersona(personaId: string) {
  const deviceId = await getOrCreateDeviceId();
  const query = new URLSearchParams({ device_id: deviceId });

  // 선택한 페르소나 id만 서버로 보내고, 서버는 현재 device_id 유저의 writing_persona 컬럼을 갱신합니다.
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
  const deviceId = await getOrCreateDeviceId();
  const query = new URLSearchParams({ device_id: deviceId });

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

function normalizeTravelTypeIcon(icon: unknown): TravelTypeIconName {
  // 백엔드가 재시작되지 않은 경우 예전 { ios, android, web } 형태가 올 수 있어서 프론트에서 한 번 더 정리합니다.
  const iconKey =
    typeof icon === 'string'
      ? icon
      : icon && typeof icon === 'object' && 'web' in icon
        ? String(icon.web)
        : '';

  switch (iconKey) {
    case 'compass':
    case 'explore':
    case 'safari':
      return 'compass';
    default:
      return 'compass';
  }
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

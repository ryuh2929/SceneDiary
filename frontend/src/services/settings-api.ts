import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { SettingsProfile, TravelTypeIconName } from '@/data/settings';

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
  const response = await fetch(`${getApiBaseUrl()}/settings/profile`);

  if (!response.ok) {
    throw new Error('Failed to load settings profile.');
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

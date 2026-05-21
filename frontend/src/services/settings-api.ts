import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { SettingsProfile } from '@/data/settings';

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

  return response.json() as Promise<SettingsProfile>;
}

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 백엔드 API 기본 주소를 한 곳에서 계산합니다.
// 모바일 Expo Go에서는 localhost가 휴대폰 자신을 가리키므로, Expo host IP를 사용해 PC의 백엔드에 접근합니다.
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

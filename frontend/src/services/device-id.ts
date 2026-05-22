import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 이 파일은 앱을 설치한 기기를 식별하기 위한 deviceId를 가져오거나 새로 만드는 역할을 합니다.
// 웹에서는 localStorage를 사용하고, iOS/Android 앱에서는 AsyncStorage를 사용합니다.

const DEVICE_ID_STORAGE_KEY = 'scene_diary_device_id';

// **테스트 끝나면 확인 필요**
// 개발 중에는 기존 DB에 들어있는 테스트 유저를 계속 보기 위해 이 값을 우선 사용합니다.
// 나중에 실제 사용자별 UUID를 쓰려면 .env의 EXPO_PUBLIC_TEST_DEVICE_ID를 지우고,
// 아래 기본값도 빈 문자열로 바꾸거나 개발용 분기를 제거하면 됩니다.
const DEFAULT_DEV_DEVICE_ID = 'korea-test-device-001';

function getDevDeviceId() {
  if (!__DEV__) {
    return null;
  }

  return process.env.EXPO_PUBLIC_TEST_DEVICE_ID || DEFAULT_DEV_DEVICE_ID;
}

function createDeviceId() {
  // 브라우저처럼 crypto.randomUUID를 지원하는 환경에서는 표준 UUID를 사용합니다.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // 일부 모바일 런타임에서는 crypto.randomUUID가 없을 수 있어 간단한 fallback을 둡니다.
  // 로그인 없는 개인 앱의 임시 기기 식별 용도라면 충분하고, 더 강한 난수가 필요하면 expo-crypto로 바꾸면 됩니다.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
}

async function getStoredDeviceId() {
  if (Platform.OS === 'web') {
    return localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  }

  return AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
}

async function saveDeviceId(deviceId: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return;
  }

  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
}

export async function getOrCreateDeviceId() {
  const devDeviceId = getDevDeviceId();

  if (devDeviceId) {
    return devDeviceId;
  }

  const storedDeviceId = await getStoredDeviceId();

  if (storedDeviceId) {
    return storedDeviceId;
  }

  const newDeviceId = createDeviceId();
  await saveDeviceId(newDeviceId);

  return newDeviceId;
}

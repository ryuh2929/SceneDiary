import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 이 파일은 로그인 없이 사용자를 식별하기 위한 userUuid를 가져오거나 새로 만드는 역할을 합니다.
// 웹에서는 localStorage를 사용하고, iOS/Android 앱에서는 AsyncStorage를 사용합니다.

const USER_UUID_STORAGE_KEY = 'scene_diary_user_uuid';

function getDevUserUuid() {
  if (!__DEV__) {
    return null;
  }

  // **테스트 끝나면 확인 필요**
  // .env에 EXPO_PUBLIC_TEST_USER_UUID가 있을 때만 기존 DB의 테스트 유저를 사용합니다.
  // 값을 지우면 웹은 localStorage, 모바일은 AsyncStorage에서 userUuid를 확인하고 없으면 새 UUID를 만듭니다.
  return process.env.EXPO_PUBLIC_TEST_USER_UUID || null;
}

function createUserUuid() {
  // 브라우저처럼 crypto.randomUUID를 지원하는 환경에서는 표준 UUID를 사용합니다.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // 일부 모바일 런타임에서는 crypto.randomUUID가 없을 수 있어 간단한 fallback을 둡니다.
  // 로그인 없는 개인 앱의 임시 사용자 식별 용도라면 충분하고, 더 강한 난수가 필요하면 expo-crypto로 바꾸면 됩니다.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
}

async function getStoredUserUuid() {
  if (Platform.OS === 'web') {
    return localStorage.getItem(USER_UUID_STORAGE_KEY);
  }

  return AsyncStorage.getItem(USER_UUID_STORAGE_KEY);
}

async function saveUserUuid(userUuid: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(USER_UUID_STORAGE_KEY, userUuid);
    return;
  }

  await AsyncStorage.setItem(USER_UUID_STORAGE_KEY, userUuid);
}

export async function getOrCreateUserUuid() {
  const devUserUuid = getDevUserUuid();

  if (devUserUuid) {
    return devUserUuid;
  }

  const storedUserUuid = await getStoredUserUuid();

  if (storedUserUuid) {
    return storedUserUuid;
  }

  const newUserUuid = createUserUuid();
  await saveUserUuid(newUserUuid);

  return newUserUuid;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 앱 설정 중 "서버 응답 전에도 바로 적용되어야 하는 값"을 기기에 저장하는 파일입니다.
// 웹에서는 localStorage, iOS/Android에서는 AsyncStorage를 사용합니다.
const DARK_MODE_STORAGE_KEY = 'scene_diary_dark_mode';

export async function getStoredDarkMode() {
  const storedValue =
    Platform.OS === 'web'
      ? localStorage.getItem(DARK_MODE_STORAGE_KEY)
      : await AsyncStorage.getItem(DARK_MODE_STORAGE_KEY);

  if (storedValue === 'true') {
    return true;
  }

  if (storedValue === 'false') {
    return false;
  }

  return null;
}

export async function saveStoredDarkMode(isDarkMode: boolean) {
  const value = String(isDarkMode);

  if (Platform.OS === 'web') {
    localStorage.setItem(DARK_MODE_STORAGE_KEY, value);
    return;
  }

  await AsyncStorage.setItem(DARK_MODE_STORAGE_KEY, value);
}

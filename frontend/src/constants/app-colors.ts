import { useAppSettings } from '@/contexts/app-settings-context';

// Tailwind 색상 토큰과 같은 값을 TS에서도 쓰기 위한 공용 색상표입니다.
// 아이콘 색상, 그림자, 그라데이션처럼 className으로 처리하기 어려운 곳에서 사용합니다.
export const lightAppColors = {
  primary: '#5B7DBB',
  primaryLight: '#A9C3E6',
  accent: '#F6D9A6',
  accentMuted: '#F6D9A6',
  background: '#F4F6F9',
  surface: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  textPrimary: '#152538',
  textSecondary: '#39536B',
  border: '#A9C3E6',
  muted: '#E8EDF5',
  input: '#FFFFFF',
  error: '#ef4444',
  success: '#22c55e',
  disabled: '#A9C3E6',
  toggle: '#5B7DBB',
  ring: '#D8E3F1',
};

export const darkAppColors = {
  primary: '#5B7DBB',
  primaryLight: '#2F4965',
  accent: '#6F89B8',
  accentMuted: '#243348',
  background: '#0B1624', // 앱 전체 배경은 완전 검정 대신 밤하늘 같은 깊은 네이비를 사용합니다.
  surface: '#121F2F',
  textOnPrimary: '#FFFFFF',
  textPrimary: '#DDE3EE',
  textSecondary: '#A9C3E6',
  border: '#26384D',
  muted: '#172A3E',
  input: '#182B3F',
  error: '#B91C1C',
  success: '#22c55e',
  disabled: '#2F4965',
  toggle: '#5B7DBB',
  ring: '#26384D',
};

export type AppColors = typeof lightAppColors;

export function getAppColors(isDarkMode: boolean): AppColors {
  return isDarkMode ? darkAppColors : lightAppColors;
}

export function useAppThemeColors() {
  const { isDarkMode } = useAppSettings();

  return getAppColors(isDarkMode);
}

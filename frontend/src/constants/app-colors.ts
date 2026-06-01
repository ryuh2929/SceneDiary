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
  primaryLight: '#39536B',
  accent: '#5B7DBB',
  accentMuted: '#37445A',
  background: '#152538',
  surface: '#1C2E43',
  textOnPrimary: '#FFFFFF',
  textPrimary: '#DDE3EE',
  textSecondary: '#A9C3E6',
  border: '#2A4560',
  muted: '#1E3A52',
  input: '#243D52',
  error: '#B91C1C',
  success: '#22c55e',
  disabled: '#39536B',
  toggle: '#5B7DBB',
  ring: '#2A4560',
};

export type AppColors = typeof lightAppColors;

export function getAppColors(isDarkMode: boolean): AppColors {
  return isDarkMode ? darkAppColors : lightAppColors;
}

export function useAppThemeColors() {
  const { isDarkMode } = useAppSettings();

  return getAppColors(isDarkMode);
}

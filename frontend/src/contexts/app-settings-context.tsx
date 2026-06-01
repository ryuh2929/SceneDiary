import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'nativewind';

import type { SettingsProfile } from '@/data/settings';
import { fetchSettingsProfile } from '@/services/settings-api';

type AppSettingsState = {
  nickname: string;
  profileImageUrl: string | null;
  writingPersona: string;
  isDarkMode: boolean;
  isPushEnabled: boolean;
  isLoaded: boolean;
};

type AppSettingsContextValue = AppSettingsState & {
  loadSettings: () => Promise<void>;
  syncSettingsProfile: (profile: SettingsProfile) => void;
  setWritingPersona: (writingPersona: string) => void;
  setIsDarkMode: (isDarkMode: boolean) => void;
  setIsPushEnabled: (isPushEnabled: boolean) => void;
};

const defaultSettingsState: AppSettingsState = {
  nickname: '',
  profileImageUrl: null,
  writingPersona: 'daily',
  isDarkMode: false,
  isPushEnabled: true,
  isLoaded: false,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function getSelectedWritingPersona(profile: SettingsProfile) {
  return profile.persona.tags.find((tag) => tag.selected)?.id ?? profile.persona.tags[0]?.id ?? 'daily';
}

function getToggleEnabled(profile: SettingsProfile, id: 'darkMode' | 'pushNotification') {
  return profile.toggles.find((toggle) => toggle.id === id)?.enabled ?? false;
}

function NativeWindThemeSync({ isDarkMode }: { isDarkMode: boolean }) {
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    // 전역 설정의 다크모드 값을 NativeWind에 알려서 dark: 클래스가 모든 화면에서 동작하게 합니다.
    setColorScheme(isDarkMode ? 'dark' : 'light');
  }, [isDarkMode, setColorScheme]);

  return null;
}

export function AppSettingsProvider({ children }: React.PropsWithChildren) {
  const [settings, setSettings] = useState<AppSettingsState>(defaultSettingsState);

  const syncSettingsProfile = useCallback((profile: SettingsProfile) => {
    // settings API 응답에서 여러 화면이 함께 써야 하는 최소 설정만 전역 상태로 저장합니다.
    setSettings({
      nickname: profile.nickname,
      profileImageUrl: profile.profileImageUrl ?? null,
      writingPersona: getSelectedWritingPersona(profile),
      isDarkMode: getToggleEnabled(profile, 'darkMode'),
      isPushEnabled: getToggleEnabled(profile, 'pushNotification'),
      isLoaded: true,
    });
  }, []);

  const loadSettings = useCallback(async () => {
    const profile = await fetchSettingsProfile();
    syncSettingsProfile(profile);
  }, [syncSettingsProfile]);

  useEffect(() => {
    let ignore = false;

    fetchSettingsProfile()
      .then((profile) => {
        if (!ignore) {
          syncSettingsProfile(profile);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSettings((current) => ({ ...current, isLoaded: true }));
        }
      });

    return () => {
      ignore = true;
    };
  }, [syncSettingsProfile]);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      ...settings,
      loadSettings,
      syncSettingsProfile,
      setWritingPersona: (writingPersona) =>
        setSettings((current) => ({ ...current, writingPersona })),
      setIsDarkMode: (isDarkMode) => setSettings((current) => ({ ...current, isDarkMode })),
      setIsPushEnabled: (isPushEnabled) =>
        setSettings((current) => ({ ...current, isPushEnabled })),
    }),
    [loadSettings, settings, syncSettingsProfile],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      <NativeWindThemeSync isDarkMode={settings.isDarkMode} />
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider.');
  }

  return context;
}

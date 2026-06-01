import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

export function AppSettingsProvider({ children }: React.PropsWithChildren) {
  const [settings, setSettings] = useState<AppSettingsState>(defaultSettingsState);

  const syncSettingsProfile = useCallback((profile: SettingsProfile) => {
    // settings API 응답은 화면 표시용 구조이므로, 여러 화면에서 필요한 최소 설정만 전역 상태로 펼쳐 저장합니다.
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

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider.');
  }

  return context;
}

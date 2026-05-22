import {
  Bell,
  Compass,
  Moon,
  Pencil,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  dummySettingsProfile,
  SettingsToggle,
  TravelTypeIconName,
} from '@/data/settings';
import { fetchSettingsProfile } from '@/services/settings-api';

const colors = {
  primary: '#5B7DBB',
  primaryLight: '#A9C3E6',
  accent: '#F6D9A6',
  background: '#F4F6F9',
  surface: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  text: '#152538',
  textMuted: '#39536B',
  border: '#A9C3E6',
  inactive: '#E8EDF5',
  toggle: '#5B7DBB',
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const travelTypeIcons: Record<TravelTypeIconName, LucideIcon> = {
  compass: Compass,
};

const toggleIcons: Record<SettingsToggle['id'], LucideIcon> = {
  darkMode: Moon,
  pushNotification: Bell,
};

type AppIconProps = {
  icon: TravelTypeIconName;
  size?: number;
  color?: string;
};

const ProfileIcon = React.memo(function ProfileIcon() {
  return <User size={32} color={colors.primary} strokeWidth={2.2} />;
});

const EditIcon = React.memo(function EditIcon() {
  return <Pencil size={13} color={colors.textMuted} strokeWidth={2.2} />;
});

const PersonaTitleIcon = React.memo(function PersonaTitleIcon() {
  return <Sparkles size={15} color={colors.primary} strokeWidth={2.2} />;
});

const AppIcon = React.memo(function AppIcon({ icon, size = 18, color = colors.primary }: AppIconProps) {
  // lucide 아이콘은 SVG 기반이라 iOS, Android, Web에서 같은 형태로 렌더링됩니다.
  const Icon = travelTypeIcons[icon] ?? Compass;

  return <Icon size={size} color={color} strokeWidth={2.2} />;
});

const ToggleIcon = React.memo(function ToggleIcon({
  id,
  size = 16,
  color = colors.textMuted,
}: {
  id: SettingsToggle['id'];
  size?: number;
  color?: string;
}) {
  // 다크 모드와 푸시 알림 아이콘은 설정 UI의 고정 요소라서 API 데이터가 아니라 프론트에서 직접 결정합니다.
  const Icon = toggleIcons[id];

  return <Icon size={size} color={color} strokeWidth={2.2} />;
});

function SettingsCard({
  children,
  className = '',
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <View
      className={`rounded-lg border bg-surface px-md py-md ${className}`}
      style={{
        borderColor: colors.border,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 2,
      }}>
      {children}
    </View>
  );
}

function ToggleSwitch({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const progress = useDerivedValue(() => withTiming(value ? 1 : 0, { duration: 180 }), [value]);
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.inactive, colors.toggle]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={[
        {
          width: 46,
          height: 26,
          borderRadius: 999,
          padding: 3,
          justifyContent: 'center',
        },
        trackStyle,
      ]}>
      {/* 기본 Switch 대신 직접 만든 손잡이라 색상, 위치, 애니메이션을 디자인에 맞게 고정할 수 있습니다. */}
      <Animated.View
        style={[
          {
            width: 20,
            height: 20,
            borderRadius: 999,
            backgroundColor: colors.surface,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.12,
            shadowRadius: 2,
            elevation: 2,
          },
          thumbStyle,
        ]}
      />
    </AnimatedPressable>
  );
}

function PersonaChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`rounded-full px-3 py-2 ${selected ? 'bg-primary' : 'bg-muted'}`}>
      <Text
        className={`text-sm font-bold ${
          selected ? 'text-textOnPrimary' : 'text-textSecondary'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  item,
  value,
  onValueChange,
}: {
  item: SettingsToggle;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <SettingsCard className="flex-row items-center justify-between py-sm">
      <View className="flex-row items-center gap-sm">
        <View className="h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <ToggleIcon id={item.id} />
        </View>
        <Text className="text-md font-semibold text-textPrimary">{item.label}</Text>
      </View>

      <ToggleSwitch value={value} onValueChange={onValueChange} />
    </SettingsCard>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(dummySettingsProfile);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // 토글 값은 화면에서 즉시 확인할 수 있도록 로컬 상태로 관리하고, 이후 DB/API 값으로 대체하기 쉽게 id 기준 객체로 변환합니다.
  const initialToggles = useMemo(
    () =>
      Object.fromEntries(profile.toggles.map((toggle) => [toggle.id, toggle.enabled])) as Record<
        SettingsToggle['id'],
        boolean
      >,
    [profile.toggles],
  );
  const [toggles, setToggles] = useState(initialToggles);

  // 페르소나는 하나만 선택되도록 선택된 id만 저장합니다.
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    profile.persona.tags.find((tag) => tag.selected)?.id ?? profile.persona.tags[0]?.id,
  );
  const selectedPersona = useMemo(
    () => profile.persona.tags.find((tag) => tag.id === selectedPersonaId),
    [profile.persona.tags, selectedPersonaId],
  );

  useEffect(() => {
    let ignore = false;

    fetchSettingsProfile()
      .then((settingsProfile) => {
        if (ignore) {
          return;
        }

        setProfile(settingsProfile);
        setToggles(
          Object.fromEntries(
            settingsProfile.toggles.map((toggle) => [toggle.id, toggle.enabled]),
          ) as Record<SettingsToggle['id'], boolean>,
        );
        setSelectedPersonaId(
          settingsProfile.persona.tags.find((tag) => tag.selected)?.id ??
            settingsProfile.persona.tags[0]?.id,
        );
        setProfileError(null);
      })
      .catch((error: Error) => {
        if (!ignore) {
          setProfileError(error.message);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // 하단 네브바는 별도 컴포넌트가 담당하므로, 이 화면은 안전 영역과 본문 여백만 책임집니다.
  const contentInset = Platform.select({
    ios: { paddingTop: 20, paddingBottom: insets.bottom + 24 },
    android: { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
    default: { paddingTop: 28, paddingBottom: 28 },
  });

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="min-h-full px-md"
      contentContainerStyle={contentInset}
      showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-[420px] flex-1">
        <View className="mb-xl flex-row items-center justify-between">
          <Text className="text-lg font-bold text-textPrimary">설정</Text>
          {isLoadingProfile ? (
            <Text className="text-sm font-semibold text-textSecondary">불러오는 중</Text>
          ) : null}
        </View>

        {profileError ? (
          <View className="mb-md rounded-lg border border-[#E8B4B4] bg-[#FFF4F4] px-md py-sm">
            <Text className="text-sm font-semibold text-[#8A2D2D]">{profileError}</Text>
          </View>
        ) : null}

        <View className="items-center">
          <View className="h-[76px] w-[76px] items-center justify-center rounded-full bg-primaryLight">
            <ProfileIcon />
          </View>

          <View className="mt-md flex-row items-center gap-xs">
            <Text className="text-[20px] font-extrabold text-textPrimary">{profile.nickname}</Text>
            <EditIcon />
          </View>
        </View>

        <View className="mt-lg gap-md">
          <SettingsCard>
            <View className="flex-row items-center gap-sm">
              <PersonaTitleIcon />
              <Text className="text-md font-bold text-textPrimary">{profile.persona.title}</Text>
            </View>

            <View className="mt-sm flex-row flex-wrap gap-sm">
              {profile.persona.tags.map((tag) => (
                <PersonaChip
                  key={tag.id}
                  label={tag.label}
                  selected={tag.id === selectedPersonaId}
                  onPress={() => setSelectedPersonaId(tag.id)}
                />
              ))}
            </View>

            <Text className="mt-sm text-sm font-medium text-textSecondary">
              {selectedPersona?.description ?? profile.persona.description}
            </Text>
          </SettingsCard>

          <SettingsCard>
            <Text className="mb-md text-md font-bold text-textPrimary">여행 유형 분석</Text>
            <View className="flex-row items-center gap-md">
              <View className="h-[52px] w-[52px] items-center justify-center rounded-lg bg-accent">
                <AppIcon icon={profile.travelType.icon} size={24} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-extrabold text-textPrimary">
                  {profile.travelType.title}
                </Text>
                <Text className="mt-xs text-sm font-semibold text-textSecondary">
                  {profile.travelType.description}
                </Text>
              </View>
            </View>
          </SettingsCard>

          {profile.toggles.map((toggle) => (
            <ToggleRow
              key={toggle.id}
              item={toggle}
              value={toggles[toggle.id]}
              onValueChange={(value) =>
                setToggles((current) => ({ ...current, [toggle.id]: value }))
              }
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

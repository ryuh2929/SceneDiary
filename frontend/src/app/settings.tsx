import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dummySettingsProfile, SettingsToggle } from '@/data/settings';

const colors = {
  primary: '#5B7DBB',
  primaryLight: '#A9C3E6',
  accent: '#F6D9A6',
  background: '#F4F6F9',
  surface: '#FFFFFF',
  text: '#152538',
  textMuted: '#39536B',
  border: '#D8E3F2',
  inactive: '#E8EDF5',
};

type AppIconProps = {
  icon: SymbolViewProps['name'];
  size?: number;
  color?: string;
};

function AppIcon({ icon, size = 18, color = colors.primary }: AppIconProps) {
  return <SymbolView name={icon} size={size} tintColor={color} />;
}

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
          <AppIcon icon={item.icon} size={16} color={colors.textMuted} />
        </View>
        <Text className="text-md font-semibold text-textPrimary">{item.label}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.inactive, true: colors.primary }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.inactive}
      />
    </SettingsCard>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const profile = dummySettingsProfile;

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
        <Text className="mb-xl text-lg font-bold text-textPrimary">설정</Text>

        <View className="items-center">
          <View className="h-[76px] w-[76px] items-center justify-center rounded-full bg-primaryLight">
            <SymbolView
              name={{ ios: 'person', android: 'person', web: 'person' }}
              size={32}
              tintColor={colors.primary}
            />
          </View>

          <View className="mt-md flex-row items-center gap-xs">
            <Text className="text-[20px] font-extrabold text-textPrimary">{profile.nickname}</Text>
            <SymbolView
              name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
              size={13}
              tintColor={colors.textMuted}
            />
          </View>
        </View>

        <View className="mt-lg gap-md">
          <SettingsCard>
            <View className="flex-row items-center gap-sm">
              <SymbolView
                name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                size={15}
                tintColor={colors.primary}
              />
              <Text className="text-md font-bold text-textPrimary">{profile.persona.title}</Text>
            </View>

            <View className="mt-sm flex-row flex-wrap gap-sm">
              {profile.persona.tags.map((tag) => (
                <View key={tag.id} className="rounded-full bg-primaryLight px-3 py-2">
                  <Text className="text-sm font-bold text-primary">{tag.label}</Text>
                </View>
              ))}
            </View>

            <Text className="mt-sm text-sm font-medium text-textSecondary">
              {profile.persona.description}
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

import {
  Amphora,
  Baby,
  Bell,
  Beer,
  Binoculars,
  Bird,
  BottleWine,
  Bug,
  Building,
  Camera,
  CarFront,
  Castle,
  CircleDollarSign,
  Coffee,
  Compass,
  Cookie,
  CookingPot,
  Dog,
  FerrisWheel,
  Fish,
  FishingHook,
  FlameKindling,
  Flower2,
  Footprints,
  Hamburger,
  Helicopter,
  Hotel,
  House,
  IceCreamBowl,
  Landmark,
  Map,
  Martini,
  Mountain,
  NotebookPen,
  Moon,
  Origami,
  PartyPopper,
  Pencil,
  RefreshCcw,
  RollerCoaster,
  Rose,
  Sailboat,
  Sandwich,
  Ship,
  Snail,
  Snowflake,
  Soup,
  Sparkles,
  Squirrel,
  Sun,
  TentTree,
  TicketsPlane,
  TreePalm,
  Trees,
  Turtle,
  Utensils,
  Wine,
  Backpack,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NicknameModal } from '@/components/nickname-modal';
import {
  dummySettingsProfile,
  SettingsToggle,
  TravelTypeIconName,
} from '@/data/settings';
import {
  fetchSettingsProfile,
  requestTravelStyleAnalysis,
  updateNickname,
  updateSettingsToggle,
  updateWritingPersona,
  uploadProfileImage,
} from '@/services/settings-api';

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

const TRAVEL_ANALYSIS_COOLDOWN_MS = 60 * 1000;
const PROFILE_IMAGE_SIZE = 256;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

// DB/API는 아이콘을 문자열로 내려주므로, 프런트에서 실제 lucide 아이콘 컴포넌트로 매핑합니다.
// 새 여행 유형 아이콘을 허용하려면 import와 이 매핑, TravelTypeIconName 타입을 함께 추가해야 합니다.
const travelTypeIcons: Record<TravelTypeIconName, LucideIcon> = {
  Flower2,
  Camera,
  Compass,
  Trees,
  TreePalm,
  TentTree,
  Binoculars,
  FlameKindling,
  PartyPopper,
  Martini,
  Beer,
  BottleWine,
  Wine,
  Hamburger,
  Sandwich,
  Utensils,
  TicketsPlane,
  Map,
  Helicopter,
  Ship,
  CarFront,
  Amphora,
  Landmark,
  FerrisWheel,
  RollerCoaster,
  Mountain,
  Coffee,
  Building,
  Castle,
  Hotel,
  House,
  Sailboat,
  FishingHook,
  Fish,
  IceCreamBowl,
  Soup,
  CookingPot,
  Cookie,
  Dog,
  Snail,
  Squirrel,
  Turtle,
  Bird,
  Bug,
  Origami,
  Footprints,
  Rose,
  Baby,
  CircleDollarSign,
  Snowflake,
  Sun,
  NotebookPen,
};

const toggleIcons: Record<SettingsToggle['id'], LucideIcon> = {
  darkMode: Moon,
  pushNotification: Bell,
};

type ProfileNotice = {
  message: string;
  type: 'success' | 'error';
};

type AppIconProps = {
  icon: TravelTypeIconName;
  size?: number;
  color?: string;
};

function profileImageResizeAction(width: number, height: number) {
  // 원본 비율을 유지한 채 짧은 변을 256px로 맞추면, 가운데를 잘라도 얼굴/풍경이 찌그러지지 않습니다.
  if (width < height) {
    return { resize: { width: PROFILE_IMAGE_SIZE } };
  }

  return { resize: { height: PROFILE_IMAGE_SIZE } };
}

async function buildProfileImageFile(asset: ImagePicker.ImagePickerAsset) {
  // 1차로 짧은 변을 256px에 맞추고, 2차로 중앙 256x256 영역만 잘라 원형 프로필에 맞는 정사각형을 만듭니다.
  const resized = await ImageManipulator.manipulateAsync(
    asset.uri,
    [profileImageResizeAction(asset.width, asset.height)],
    {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  const cropWidth = Math.min(PROFILE_IMAGE_SIZE, resized.width);
  const cropHeight = Math.min(PROFILE_IMAGE_SIZE, resized.height);
  const originX = Math.max(0, Math.floor((resized.width - cropWidth) / 2));
  const originY = Math.max(0, Math.floor((resized.height - cropHeight) / 2));

  const cropped = await ImageManipulator.manipulateAsync(
    resized.uri,
    [
      {
        crop: {
          originX,
          originY,
          width: cropWidth,
          height: cropHeight,
        },
      },
    ],
    {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return {
    uri: cropped.uri,
    name: `profile-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
  };
}

const ProfileIcon = React.memo(function ProfileIcon() {
  return <Backpack size={32} color={colors.primary} strokeWidth={2.2} />;
});

const EditIcon = React.memo(function EditIcon() {
  return <Pencil size={13} color={colors.textMuted} strokeWidth={2.2} />;
});

const ProfileImageEditIcon = React.memo(function ProfileImageEditIcon() {
  return <Camera size={15} color={colors.textOnPrimary} strokeWidth={2.4} />;
});

const PersonaTitleIcon = React.memo(function PersonaTitleIcon() {
  return <Sparkles size={15} color={colors.primary} strokeWidth={2.2} />;
});

const TravelAnalysisActionIcon = React.memo(function TravelAnalysisActionIcon() {
  return <WandSparkles size={15} color={colors.primary} strokeWidth={2.2} />;
});

const TravelAnalysisButtonIcon = React.memo(function TravelAnalysisButtonIcon() {
  return <RefreshCcw size={13} color={colors.primary} strokeWidth={2.4} />;
});

const AppIcon = React.memo(function AppIcon({ icon, size = 18, color = colors.primary }: AppIconProps) {
  // lucide 아이콘은 SVG 기반이라 iOS, Android, Web에서 같은 형태로 렌더링됩니다.
  const Icon = travelTypeIcons[icon] ?? NotebookPen;

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
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [savingToggleId, setSavingToggleId] = useState<SettingsToggle['id'] | null>(null);
  const [isNicknameModalVisible, setIsNicknameModalVisible] = useState(false);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [isRequestingTravelAnalysis, setIsRequestingTravelAnalysis] = useState(false);
  const [profileNotice, setProfileNotice] = useState<ProfileNotice | null>(null);
  const [travelAnalysisCooldownUntil, setTravelAnalysisCooldownUntil] = useState<number | null>(null);
  const [travelAnalysisCooldownRemaining, setTravelAnalysisCooldownRemaining] = useState(0);

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
  const noticeProgress = useDerivedValue(
    () => withTiming(profileNotice ? 1 : 0, { duration: 180 }),
    [profileNotice],
  );
  const noticeStyle = useAnimatedStyle(() => ({
    opacity: noticeProgress.value,
    transform: [{ translateY: (1 - noticeProgress.value) * -10 }],
  }));
  const noticeColors =
    profileNotice?.type === 'error'
      ? {
          backgroundColor: '#FFF1F2',
          borderColor: '#F4A7AE',
          textColor: '#A9323C',
        }
      : {
          backgroundColor: '#ECFDF3',
          borderColor: '#86D39B',
          textColor: '#257A3E',
        };
  const isTravelAnalysisCoolingDown = travelAnalysisCooldownRemaining > 0;

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
        setProfileNotice(null);
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

  useEffect(() => {
    if (!profileNotice) {
      return;
    }

    const timer = setTimeout(() => {
      setProfileNotice(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [profileNotice]);

  useEffect(() => {
    if (!travelAnalysisCooldownUntil) {
      setTravelAnalysisCooldownRemaining(0);
      return;
    }

    // 프론트 임시 쿨다운입니다. DB 컬럼이 생기기 전까지 버튼 연타를 UX 차원에서 막습니다.
    const updateRemainingSeconds = () => {
      const remainingMs = Math.max(0, travelAnalysisCooldownUntil - Date.now());
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      setTravelAnalysisCooldownRemaining(remainingSeconds);

      if (remainingSeconds <= 0) {
        setTravelAnalysisCooldownUntil(null);
      }
    };

    updateRemainingSeconds();
    const timer = setInterval(updateRemainingSeconds, 1000);

    return () => clearInterval(timer);
  }, [travelAnalysisCooldownUntil]);

  const handleSelectPersona = async (personaId: string) => {
    if (personaId === selectedPersonaId || isSavingPersona) {
      return;
    }

    const previousPersonaId = selectedPersonaId;

    // 버튼을 누른 즉시 화면을 바꾸고, 서버 저장이 끝나면 응답값으로 한 번 더 동기화합니다.
    setSelectedPersonaId(personaId);
    setProfile((currentProfile) => ({
      ...currentProfile,
      persona: {
        ...currentProfile.persona,
        tags: currentProfile.persona.tags.map((tag) => ({
          ...tag,
          selected: tag.id === personaId,
        })),
      },
    }));
    setIsSavingPersona(true);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const updatedProfile = await updateWritingPersona(personaId);
      const selectedId =
        updatedProfile.persona.tags.find((tag) => tag.selected)?.id ??
        updatedProfile.persona.tags[0]?.id;

      setProfile(updatedProfile);
      setSelectedPersonaId(selectedId);
    } catch (error) {
      setSelectedPersonaId(previousPersonaId);
      setProfile((currentProfile) => ({
        ...currentProfile,
        persona: {
          ...currentProfile.persona,
          tags: currentProfile.persona.tags.map((tag) => ({
            ...tag,
            selected: tag.id === previousPersonaId,
          })),
        },
      }));
      setProfileError(error instanceof Error ? error.message : 'Failed to update writing persona.');
    } finally {
      setIsSavingPersona(false);
    }
  };

  const handleToggleChange = async (toggleId: SettingsToggle['id'], enabled: boolean) => {
    if (savingToggleId) {
      return;
    }

    const previousValue = toggles[toggleId];

    // 토글은 손맛이 중요하므로 먼저 화면을 바꾸고, 저장 실패 시 이전 값으로 되돌립니다.
    setToggles((current) => ({ ...current, [toggleId]: enabled }));
    setSavingToggleId(toggleId);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const updatedProfile = await updateSettingsToggle(toggleId, enabled);

      setProfile(updatedProfile);
      setToggles(
        Object.fromEntries(
          updatedProfile.toggles.map((toggle) => [toggle.id, toggle.enabled]),
        ) as Record<SettingsToggle['id'], boolean>,
      );
    } catch (error) {
      setToggles((current) => ({ ...current, [toggleId]: previousValue }));
      setProfileError(error instanceof Error ? error.message : 'Failed to update settings toggle.');
    } finally {
      setSavingToggleId(null);
    }
  };

  const openNicknameModal = () => {
    // 실제 모달은 ScrollView 밖의 별도 컴포넌트에서 열어 터치 이벤트가 섞이지 않게 합니다.
    setIsNicknameModalVisible(true);
  };

  const closeNicknameModal = () => {
    setIsNicknameModalVisible(false);
  };

  const handleSaveNickname = async (nickname: string) => {
    setProfileError(null);
    setProfileNotice(null);

    const updatedProfile = await updateNickname(nickname);
    setProfile(updatedProfile);
  };

  const openProfileImagePicker = async () => {
    if (isUploadingProfileImage) {
      return;
    }

    setProfileError(null);
    setProfileNotice(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setProfileNotice({
          message: '프로필 사진을 선택하려면 사진 접근 권한이 필요합니다.',
          type: 'error',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setIsUploadingProfileImage(true);

      const profileImageFile = await buildProfileImageFile(result.assets[0]);
      const updatedProfile = await uploadProfileImage(profileImageFile);

      setProfile(updatedProfile);
      setProfileNotice({
        message: '프로필 사진을 변경했어요.',
        type: 'success',
      });
    } catch (error) {
      setProfileNotice({
        message: '프로필 사진 변경에 실패했어요. 잠시 후 다시 시도해주세요.',
        type: 'error',
      });
    } finally {
      setIsUploadingProfileImage(false);
    }
  };

  const startTravelStyleAnalysis = async () => {
    if (isRequestingTravelAnalysis) {
      return;
    }

    if (isTravelAnalysisCoolingDown) {
      setProfileNotice({
        message: `재요청까지 잠시 시간이 필요합니다. ${travelAnalysisCooldownRemaining}초 후 다시 시도해주세요.`,
        type: 'error',
      });
      return;
    }

    setIsRequestingTravelAnalysis(true);
    setProfileError(null);
    setProfileNotice(null);

    try {
      const updatedProfile = await requestTravelStyleAnalysis();
      setProfile(updatedProfile);
      // 분석 요청이 정상 접수된 경우에만 1분 제한을 시작합니다. 실패한 요청은 바로 재시도할 수 있습니다.
      setTravelAnalysisCooldownUntil(Date.now() + TRAVEL_ANALYSIS_COOLDOWN_MS);
      setProfileNotice({
        message: '여행 유형 분석을 시작했어요. 결과가 곧 반영됩니다.',
        type: 'success',
      });
    } catch (error) {
      setProfileNotice({
        message: '여행 유형 분석 요청에 실패했어요. 잠시 후 다시 시도해주세요.',
        type: 'error',
      });
    } finally {
      setIsRequestingTravelAnalysis(false);
    }
  };

  // 하단 네브바는 별도 컴포넌트가 담당하므로, 이 화면은 안전 영역과 본문 여백만 책임집니다.
  const contentInset = Platform.select({
    ios: { paddingTop: 20, paddingBottom: insets.bottom + 24 },
    android: { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
    default: { paddingTop: 28, paddingBottom: 28 },
  });

  return (
    <>
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
          <View className="relative h-[82px] w-[82px] items-center justify-center">
            <View className="h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full bg-primaryLight">
              {profile.profileImageUrl ? (
                <Image
                  source={{ uri: profile.profileImageUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <ProfileIcon />
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="프로필 사진 수정"
              onPress={openProfileImagePicker}
              disabled={isUploadingProfileImage}
              className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-primary"
              style={{
                shadowColor: colors.text,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.14,
                shadowRadius: 4,
                elevation: 3,
                opacity: isUploadingProfileImage ? 0.6 : 1,
              }}>
              <ProfileImageEditIcon />
            </Pressable>
          </View>

          <View className="mt-md flex-row items-center justify-center gap-xs">
            {/* 오른쪽 수정 아이콘과 같은 폭의 빈 공간을 왼쪽에 둬서 닉네임 텍스트가 프로필 사진 중앙과 맞도록 합니다. */}
            <View className="h-7 w-7" />
            <Text className="text-[20px] font-extrabold text-textPrimary">{profile.nickname}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닉네임 수정"
              onPress={openNicknameModal}
              className="h-7 w-7 items-center justify-center rounded-full">
              <EditIcon />
            </Pressable>
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
                  onPress={() => handleSelectPersona(tag.id)}
                />
              ))}
            </View>

            <Text className="mt-sm text-sm font-medium text-textSecondary">
              {selectedPersona?.description ?? profile.persona.description}
            </Text>
          </SettingsCard>

          <SettingsCard>
            <View className="mb-md flex-row items-center justify-between gap-sm">
              <View className="flex-row items-center gap-sm">
                <TravelAnalysisActionIcon />
                <Text className="text-md font-bold text-textPrimary">여행 유형 분석</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="여행 유형 다시 분석"
                accessibilityState={{ disabled: isRequestingTravelAnalysis }}
                onPress={startTravelStyleAnalysis}
                disabled={isRequestingTravelAnalysis}
                // 여행 유형 카드의 제목 줄에서 재분석 액션을 오른쪽 끝에 고정합니다.
                className="h-6 w-6 items-center justify-center rounded-md bg-muted"
                style={{
                  borderColor: colors.border,
                  borderWidth: 1,
                  opacity: isRequestingTravelAnalysis || isTravelAnalysisCoolingDown ? 0.55 : 1,
                }}>
                <TravelAnalysisButtonIcon />
              </Pressable>
            </View>
            <View className="flex-row items-center gap-md">
              <View className="h-[52px] w-[52px] items-center justify-center rounded-lg bg-accent">
                <AppIcon icon={profile.travelType.icon} size={24} color={colors.primary} />
              </View>
              <View className="min-w-0 flex-1">
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
              onValueChange={(value) => handleToggleChange(toggle.id, value)}
            />
          ))}
        </View>
      </View>

      </ScrollView>

      {profileNotice ? (
        <AnimatedView
          pointerEvents="none"
          className="absolute left-md right-md z-10 mx-auto max-w-[420px] rounded-lg border px-md py-sm"
          style={[
            {
              top: (contentInset?.paddingTop ?? 24) + 44,
              alignSelf: 'center',
              backgroundColor: noticeColors.backgroundColor,
              borderColor: noticeColors.borderColor,
              shadowColor: colors.text,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 5,
            },
            noticeStyle,
          ]}>
          <Text className="text-center text-sm font-bold" style={{ color: noticeColors.textColor }}>
            {profileNotice.message}
          </Text>
        </AnimatedView>
      ) : null}

      <NicknameModal
        visible={isNicknameModalVisible}
        currentNickname={profile.nickname}
        onClose={closeNicknameModal}
        onSave={handleSaveNickname}
      />
    </>
  );
}

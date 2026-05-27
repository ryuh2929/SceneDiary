import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ImageIcon } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PreparedPhoto = {
  fileUri: string;
  thumbnailUri: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes?: number;
  width: number;
  height: number;
  displayOrder: number;
};

const colors = {
  primary: '#5B7DBB',
  primaryLight: '#A9C3E6',
  accent: '#F6D9A6',
  surface: '#FFFFFF',
  textPrimary: '#152538',
  textSecondary: '#39536B',
  muted: '#E8EDF5',
  ring: '#D8E3F1',
  textOnPrimary: '#FFFFFF',
};

const analysisSteps = [
  '사진을 정리하고 있어요',
  '장면을 살펴보고 있어요',
  '하루의 흐름을 맞추고 있어요',
  '일기 초안을 준비하고 있어요',
];

// 작성 화면에서 다음 일차 생성 중에 다시 호출할 때 사용할 안내 문구입니다.
const nextDaySteps = [
  '다음 일차를 준비하고 있어요',
  '이전 기록을 이어보고 있어요',
  '하루의 흐름을 맞추고 있어요',
  '새 기록 초안을 준비하고 있어요',
];

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePhotosParam(value: string | string[] | undefined): PreparedPhoto[] {
  // add 화면에서 URL 파라미터로 넘긴 사진 배열을 다시 화면에서 쓸 수 있는 배열로 복원합니다.
  const rawValue = getFirstParam(value);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function LoadingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    photos?: string;
    tripId?: string;
    day?: string;
    mode?: string;
  }>();
  const photos = useMemo(() => parsePhotosParam(params.photos), [params.photos]);
  const previewPhotos = useMemo(() => photos.slice(0, 5), [photos]);
  // tripId/day/mode는 다른 담당 화면이 로딩 화면을 재사용할 때 이어받는 최소 연결 정보입니다.
  const tripId = getFirstParam(params.tripId) ?? '1';
  const day = getFirstParam(params.day) ?? '1';
  const mode = getFirstParam(params.mode) ?? 'initial';
  // initial은 사진 선택 직후 첫 생성 로딩, next-day는 작성 화면에서 다음 일차 생성 중 재진입하는 로딩입니다.
  const isNextDayMode = mode === 'next-day';
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);
  const drift = useSharedValue(0);
  const [progress, setProgress] = useState(18);
  const [stepIndex, setStepIndex] = useState(0);

  // 같은 로딩 화면을 상황별로 재사용하기 위해 모드에 따라 문구 묶음만 바꿉니다.
  const steps = isNextDayMode ? nextDaySteps : analysisSteps;
  const progressWidth = useMemo(() => `${progress}%` as `${number}%`, [progress]);
  const photoCountLabel = photos.length > 0 ? `${photos.length}장의 사진` : '선택한 사진';
  // 사진 기반 첫 생성과 다음 일차 생성은 사용자가 기다리는 이유가 달라서 보조 문구를 분리합니다.
  const helperText = isNextDayMode
    ? `${day}일차 기록을 준비 중이에요`
    : `${photoCountLabel}으로 하루 기록을 준비 중이에요`;
  // 버튼 문구도 현재 대기 중인 일차를 드러내서 다음 화면 이동 맥락을 맞춥니다.
  const buttonLabel = isNextDayMode ? `${day}일차 편집 화면으로 이동` : '작성 화면으로 이동';

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2200, easing: Easing.linear }),
      -1,
      false,
    );

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [drift, pulse, rotation]);

  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress((current) => {
        if (current >= 96) {
          return current;
        }

        return current + 5;
      });
    }, 620);

    const stepTimer = setInterval(() => {
      setStepIndex((current) => (current + 1) % steps.length);
    }, 1700);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stepTimer);
    };
  }, [steps.length]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const softBlobStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + drift.value * 0.08,
    transform: [
      { translateX: -12 + drift.value * 18 },
      { translateY: 4 - drift.value * 10 },
      { scale: 1 + drift.value * 0.08 },
    ],
  }));

  const paleBlobStyle = useAnimatedStyle(() => ({
    opacity: 0.14 + (1 - drift.value) * 0.08,
    transform: [
      { translateX: 14 - drift.value * 12 },
      { translateY: -8 + drift.value * 12 },
      { scale: 1.08 - drift.value * 0.05 },
    ],
  }));

  const lightBlobStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + drift.value * 0.06,
    transform: [
      { translateX: 3 + drift.value * 8 },
      { translateY: 14 - drift.value * 8 },
      { scale: pulse.value },
    ],
  }));

  return (
    <View
      className="flex-1 items-center bg-surface px-lg"
      style={{ paddingTop: insets.top + 24, paddingBottom: bottomInset }}>
      <View className="mx-auto w-full max-w-[720px] flex-1 items-center justify-center px-xl">
        <View className="w-full items-center">
          <View className="relative h-40 w-40 items-center justify-center">
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 142,
                  height: 116,
                  borderRadius: 999,
                  backgroundColor: 'rgba(169,195,230,0.26)',
                },
                softBlobStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 124,
                  height: 134,
                  borderRadius: 999,
                  backgroundColor: 'rgba(214,226,242,0.34)',
                },
                paleBlobStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 88,
                  height: 82,
                  borderRadius: 999,
                  backgroundColor: 'rgba(169,195,230,0.18)',
                },
                lightBlobStyle,
              ]}
            />
            <Animated.View
              className="absolute h-28 w-28 rounded-full"
              style={[
                {
                  backgroundColor: 'rgba(169,195,230,0.08)',
                },
                pulseStyle,
              ]}
            />

            <View
              className="absolute h-28 w-28 rounded-full border"
              style={{ borderColor: 'rgba(216,227,241,0.78)', zIndex: 4 }}
            />
            <Animated.View
              className="absolute h-28 w-28 rounded-full border-[2px]"
              style={[
                {
                  borderColor: 'transparent',
                  borderTopColor: colors.primary,
                  borderRightColor: colors.primaryLight,
                  borderBottomColor: 'rgba(91,125,187,0.2)',
                  zIndex: 5,
                },
                spinnerStyle,
              ]}
            />

            {previewPhotos.length > 0 ? (
              <View className="h-[72px] w-[104px] items-center justify-center">
                {previewPhotos.slice(0, 3).map((photo, index) => (
                  <View
                    key={`${photo.thumbnailUri}-${photo.displayOrder}`}
                    className="absolute h-16 w-16 overflow-hidden rounded-lg border-2 border-white bg-muted"
                    style={{
                      left: 20 + index * 12,
                      transform: [{ rotate: `${(index - 1) * 7}deg` }],
                      shadowColor: colors.textPrimary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 2,
                    }}>
                    <Image source={{ uri: photo.thumbnailUri }} className="h-full w-full" resizeMode="cover" />
                  </View>
                ))}
              </View>
            ) : (
              <View className="h-14 w-14 items-center justify-center rounded-full bg-muted" style={{ zIndex: 6 }}>
                <ImageIcon size={27} color={colors.primary} strokeWidth={2.1} />
              </View>
            )}
          </View>

          <Text className="mt-md text-center text-2xl font-extrabold text-textPrimary">
            {steps[stepIndex]}
          </Text>
          <Text className="mt-xs text-center text-md font-semibold text-textSecondary">
            {helperText}
          </Text>

          {!isNextDayMode && photos.length > 3 ? (
            <Text className="mt-sm text-center text-sm font-bold text-textSecondary">
              외 {photos.length - 3}장 더
            </Text>
          ) : null}

          <View className="mt-xl w-[280px] max-w-full">
            <View className="h-[5px] overflow-hidden rounded-full bg-muted">
              <LinearGradient
                colors={[colors.primary, colors.primaryLight, colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="h-full rounded-full"
                style={{ width: progressWidth }}
              />
            </View>
            <Text className="mt-sm text-center text-sm font-bold text-textSecondary">{progress}%</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="일기 작성 화면으로 이동"
          onPress={() =>
            router.replace({
              pathname: '/diary_writing',
              // 작성 화면에서 같은 여행과 일차 정보를 이어받을 수 있도록 그대로 넘깁니다.
              params: { tripId, day, mode },
            })
          }
          className="absolute bottom-md w-full max-w-[360px] overflow-hidden rounded-lg">
          <LinearGradient
            colors={[colors.primary, colors.primaryLight, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-14 items-center justify-center">
            <Text className="text-md font-extrabold text-textOnPrimary">{buttonLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Search } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
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
  textOnPrimary: '#FFFFFF',
};

const analysisSteps = [
  '사진을 업로드할 준비 중',
  '1024px 이미지 정보를 확인 중',
  '썸네일 묶음을 정리 중',
  '일기 초안을 준비 중',
];

function parsePhotosParam(value: string | string[] | undefined): PreparedPhoto[] {
  const rawValue = Array.isArray(value) ? value[0] : value;
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
  const params = useLocalSearchParams<{ photos?: string }>();
  const photos = useMemo(() => parsePhotosParam(params.photos), [params.photos]);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  const rotation = useSharedValue(0);
  const [progress, setProgress] = useState(18);
  const [stepIndex, setStepIndex] = useState(0);

  const progressWidth = useMemo(() => `${progress}%` as `${number}%`, [progress]);
  const photoCountLabel = photos.length > 0 ? `${photos.length}장` : '선택한 사진';

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress((current) => {
        if (current >= 96) {
          return current;
        }

        return current + 6;
      });
    }, 520);

    const stepTimer = setInterval(() => {
      setStepIndex((current) => (current + 1) % analysisSteps.length);
    }, 1500);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stepTimer);
    };
  }, []);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      className="flex-1 items-center bg-surface px-lg"
      style={{ paddingTop: insets.top + 24, paddingBottom: bottomInset }}>
      <View className="mx-auto w-full max-w-[720px] flex-1 items-center justify-center px-xl">
        <View className="items-center">
          <View className="relative h-36 w-36 items-center justify-center">
            <View
              className="absolute h-28 w-28 rounded-full border-[5px]"
              style={{ borderColor: colors.muted }}
            />

            <Animated.View
              className="absolute h-28 w-28 rounded-full border-[5px]"
              style={[
                {
                  borderColor: colors.muted,
                  borderTopColor: colors.accent,
                  borderRightColor: colors.accent,
                },
                spinnerStyle,
              ]}
            />

            <View className="h-[58px] w-[58px] items-center justify-center rounded-full bg-muted">
              <Search size={34} color={colors.primary} strokeWidth={2.4} />
            </View>
          </View>

          <Text className="mt-lg text-center text-xl font-extrabold text-textPrimary">
            {analysisSteps[stepIndex]}
          </Text>
          <Text className="mt-xs text-center text-md font-semibold text-textSecondary">
            {photoCountLabel}을 하루 기록으로 묶고 있어요
          </Text>

          <View className="mt-lg flex-row items-center rounded-lg bg-muted px-md py-sm">
            <Image size={18} color={colors.primary} />
            <Text className="ml-xs text-sm font-bold text-textSecondary">
              file_url: 리사이징 이미지 · thumbnail_url: 미리보기 이미지
            </Text>
          </View>

          <View className="mt-xl w-[280px] max-w-full">
            <View className="h-[6px] overflow-hidden rounded-full bg-muted">
              <View
                className="h-full rounded-full bg-accent"
                style={{ width: progressWidth }}
              />
            </View>
            <Text className="mt-sm text-center text-sm font-bold text-textSecondary">{progress}%</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="일기 작성 화면으로 이동"
          onPress={() => router.replace('/diary_writing')}
          className="absolute bottom-md w-full max-w-[360px] overflow-hidden rounded-lg">
          <LinearGradient
            colors={[colors.primary, colors.primaryLight, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-14 items-center justify-center">
            <Text className="text-md font-extrabold text-textOnPrimary">작성 화면으로 이동</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

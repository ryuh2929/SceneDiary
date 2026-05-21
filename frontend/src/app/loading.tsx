import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
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

const colors = {
  primary: '#5B7DBB',
  primaryLight: '#A9C3E6',
  accent: '#F6D9A6',
  background: '#F4F6F9',
  surface: '#FFFFFF',
  textPrimary: '#152538',
  textSecondary: '#39536B',
  border: '#A9C3E6',
  muted: '#E8EDF5',
};

const analysisSteps = [
  '사진 메타데이터 분석 중',
  '장소와 시간을 확인하는 중',
  '여행 분위기를 정리하는 중',
  '일기 초안을 준비하는 중',
];

export default function LoadingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rotation = useSharedValue(0);
  const [progress, setProgress] = useState(18);
  const [stepIndex, setStepIndex] = useState(0);

  const progressWidth = useMemo(() => `${progress}%` as `${number}%`, [progress]);

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
        if (current >= 92) {
          return current;
        }

        return current + 7;
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
      className="flex-1 items-center bg-background px-md"
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <View
        className="mx-auto w-full max-w-[420px] flex-1 items-center justify-center rounded-lg border bg-surface px-xl"
        style={{
          borderColor: colors.border,
          shadowColor: colors.textPrimary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 3,
        }}>
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

          <Text className="mt-lg text-xl font-extrabold text-textPrimary">
            {analysisSteps[stepIndex]}
          </Text>
          <Text className="mt-xs text-md font-semibold text-textSecondary">잠시만 기다려주세요...</Text>

          <View className="mt-xl w-[280px] max-w-full">
            <View className="h-2 overflow-hidden rounded-full bg-muted">
              {/* 진행률은 실제 분석 API가 연결되면 서버 상태값으로 교체하면 됩니다. */}
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
          className="absolute bottom-lg rounded-full bg-primary px-lg py-sm">
          <Text className="text-sm font-bold text-textOnPrimary">작성 화면으로 이동</Text>
        </Pressable>
      </View>
    </View>
  );
}

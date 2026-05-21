import { LinearGradient } from 'expo-linear-gradient';
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
  textOnPrimary: '#FFFFFF',
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
  const bottomInset = Math.max(insets.bottom, 16);
  const rotation = useSharedValue(0);
  const [progress, setProgress] = useState(18);
  const [stepIndex, setStepIndex] = useState(0);

  const progressWidth = useMemo(() => `${progress}%` as `${number}%`, [progress]);

  useEffect(() => {
    // 로딩 상태를 시각적으로 보여주기 위해 원형 테두리를 반복 회전시킵니다.
    rotation.value = withRepeat(
      withTiming(360, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  useEffect(() => {
    // 실제 분석 API 연결 전까지는 진행률과 안내 문구를 목업 상태로 갱신합니다.
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
      className="flex-1 items-center bg-surface px-lg"
      style={{ paddingTop: insets.top + 24, paddingBottom: bottomInset }}>
      <View
        className="mx-auto w-full max-w-[720px] flex-1 items-center justify-center px-xl">
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
            <View className="h-[6px] overflow-hidden rounded-full bg-muted">
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

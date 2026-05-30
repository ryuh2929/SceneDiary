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

import {
  fetchTripDayGenerationStatus,
  startTripDayGeneration,
  type LoadingStep,
} from '@/api/diary';

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
  '사진을 업로드할 준비를 하고 있어요',
  '사진을 정리하고 있어요',
  '일차별 사진을 묶고 있어요',
  '장면을 살펴보고 있어요',
  '일기 초안을 준비하고 있어요',
];

const loadingStepLabels: Record<LoadingStep, string> = {
  uploading: '사진을 업로드하고 있어요',
  resizing_images: '사진을 정리하고 있어요',
  creating_thumbnails: '썸네일을 준비하고 있어요',
  analyzing_metadata: '사진 정보를 살펴보고 있어요',
  analyzing_photos: '장면을 살펴보고 있어요',
  generating_diary: '일기 초안을 준비하고 있어요',
  completed: '작업 준비가 끝났어요',
  failed: '일기 준비에 실패했어요',
};

// 작성 화면에서 다음 일차 생성 중에 다시 호출할 때 사용할 안내 문구입니다.
const nextDaySteps = [
  '다음 일차를 준비하고 있어요',
  '이전 기록을 이어보고 있어요',
  '하루의 흐름을 맞추고 있어요',
  '새 기록 초안을 준비하고 있어요',
];

const COMPLETE_DELAY_MS = 650;

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

type UploadedDayParam = {
  tripDayId: number;
  day: number;
  date: string;
};

function parseDaysParam(value: string | string[] | undefined): UploadedDayParam[] {
  const rawValue = getFirstParam(value);
  if (!rawValue) return [];
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
    tripDayId?: string;
    day?: string;
    mode?: string;
    days?: string;
  }>();
  const photos = useMemo(() => parsePhotosParam(params.photos), [params.photos]);
  const previewPhotos = useMemo(() => photos.slice(0, 5), [photos]);
  // tripId/day/mode는 다른 담당 화면이 로딩 화면을 재사용할 때 이어받는 최소 연결 정보입니다.
  const tripId = getFirstParam(params.tripId) ?? '1';
  const tripDayId = getFirstParam(params.tripDayId);
  const day = getFirstParam(params.day) ?? '1';
  const mode = getFirstParam(params.mode) ?? 'initial';
  const allDays = useMemo(() => parseDaysParam(params.days), [params.days]);
  // initial은 사진 선택 직후 첫 생성 로딩, next-day는 작성 화면에서 다음 일차 생성 중 재진입하는 로딩입니다.
  const isNextDayMode = mode === 'next-day';
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);
  const drift = useSharedValue(0);
  const [progress, setProgress] = useState(18);
  const [stepIndex, setStepIndex] = useState(0);
  const [loadingStep, setLoadingStep] = useState<LoadingStep | null>(
    tripDayId ? 'analyzing_photos' : null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generationAttempt, setGenerationAttempt] = useState(0);
  const hasApiLoading = Boolean(tripDayId) && !isNextDayMode;
  // 다중 일차 추적: 각 일차의 완료 여부를 id → boolean 맵으로 관리합니다.
  const [completedDayIds, setCompletedDayIds] = useState<Set<number>>(new Set());
  const totalDayCount = allDays.length > 1 ? allDays.length : 0;
  const completedDayCount = completedDayIds.size;

  // 같은 로딩 화면을 상황별로 재사용하기 위해 모드에 따라 문구 묶음만 바꿉니다.
  const steps = isNextDayMode ? nextDaySteps : analysisSteps;
  const progressWidth = useMemo(() => `${progress}%` as `${number}%`, [progress]);
  const photoCountLabel = photos.length > 0 ? `${photos.length}장의 사진` : '선택한 사진';
  // 사진 기반 첫 생성과 다음 일차 생성은 사용자가 기다리는 이유가 달라서 보조 문구를 분리합니다.
  const multiDayLabel = totalDayCount > 1 ? ` (${completedDayCount}/${totalDayCount}일차 완료)` : '';
  const helperText = isNextDayMode
    ? `${day}일차 기록을 준비 중이에요`
    : `${photoCountLabel}으로 하루 기록을 준비 중이에요${multiDayLabel}`;
  // 버튼 문구도 현재 대기 중인 일차를 드러내서 다음 화면 이동 맥락을 맞춥니다.
  const buttonLabel =
    loadingStep === 'failed'
      ? '다시 시도하기'
      : progress >= 100
      ? isNextDayMode
        ? `${day}일차 편집 화면으로 이동`
        : '작성 화면으로 이동'
      : '준비가 끝나면 자동으로 이동해요';
  const displayStep = loadingStep ? loadingStepLabels[loadingStep] : steps[stepIndex];
  const displayHelperText =
    loadingStep === 'failed'
      ? errorMessage ?? '잠시 후 다시 시도해 주세요'
      : progress >= 100
        ? '작업 준비가 끝났어요'
        : helperText;

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
    if (hasApiLoading) {
      return;
    }

    const progressTimer = setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          return current;
        }

        return Math.min(current + 4, 100);
      });
    }, 620);

    const stepTimer = setInterval(() => {
      setStepIndex((current) => (current + 1) % steps.length);
    }, 1700);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stepTimer);
    };
  }, [hasApiLoading, steps.length]);

  useEffect(() => {
    if (!hasApiLoading || !tripDayId) {
      return;
    }

    let isMounted = true;
    const firstDayId = Number(tripDayId);
    // 다중 일차가 있으면 모든 일차를, 없으면 첫 날만 폴링합니다.
    const dayIdsToTrack = allDays.length > 1
      ? allDays.map((d) => d.tripDayId)
      : [firstDayId];

    async function startAndPoll() {
      try {
        const started = await startTripDayGeneration(firstDayId);
        if (!isMounted) return;
        setLoadingStep(started.status);
        setProgress(started.progress);
      } catch {
        if (!isMounted) return;
        setLoadingStep('failed');
        setErrorMessage('분석 요청을 시작하지 못했어요.');
      }
    }

    startAndPoll();

    const doneIds = new Set<number>();

    const pollTimer = setInterval(async () => {
      try {
        // 첫 번째 일차 상태는 메인 UI(progress/loadingStep)에 반영합니다.
        const firstStatus = await fetchTripDayGenerationStatus(firstDayId);
        if (!isMounted) return;
        setLoadingStep(firstStatus.status);
        setProgress(firstStatus.progress);
        setErrorMessage(firstStatus.errorMessage ?? null);

        if (firstStatus.status === 'completed' || firstStatus.status === 'failed') {
          doneIds.add(firstDayId);
          setCompletedDayIds(new Set(doneIds));
        }

        // 나머지 일차들은 완료 여부만 추적합니다 (병렬 요청).
        if (dayIdsToTrack.length > 1) {
          const otherIds = dayIdsToTrack.filter((id) => id !== firstDayId && !doneIds.has(id));
          await Promise.allSettled(
            otherIds.map(async (id) => {
              const s = await fetchTripDayGenerationStatus(id);
              if (s.status === 'completed' || s.status === 'failed') {
                doneIds.add(id);
                if (isMounted) {
                  setCompletedDayIds(new Set(doneIds));
                }
              }
            }),
          );
        }

        // 첫 날 완료되면 폴링 중단 (나머지는 백그라운드에서 계속 진행됨).
        if (firstStatus.status === 'completed' || firstStatus.status === 'failed') {
          clearInterval(pollTimer);
        }
      } catch {
        if (!isMounted) return;
        setLoadingStep('failed');
        setErrorMessage('분석 상태를 확인하지 못했어요.');
        clearInterval(pollTimer);
      }
    }, 1800);

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
    };
  }, [allDays, generationAttempt, hasApiLoading, tripDayId]);

  useEffect(() => {
    if (progress < 100 || loadingStep === 'failed') {
      return;
    }

    const timer = setTimeout(() => {
      router.replace({
        pathname: '/diary_writing',
        params: { tripId, day, mode },
      });
    }, COMPLETE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [day, loadingStep, mode, progress, router, tripId]);

  const retryGeneration = () => {
    if (!tripDayId) {
      return;
    }

    setLoadingStep('analyzing_photos');
    setErrorMessage(null);
    setCompletedDayIds(new Set());
    setProgress(42);
    setGenerationAttempt((current) => current + 1);
  };

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
            {displayStep}
          </Text>
          <Text className="mt-xs text-center text-md font-semibold text-textSecondary">
            {displayHelperText}
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
          disabled={progress < 100 && loadingStep !== 'failed'}
          onPress={() => {
            if (loadingStep === 'failed') {
              retryGeneration();
              return;
            }

            router.replace({
              pathname: '/diary_writing',
              // 작성 화면에서 같은 여행과 일차 정보를 이어받을 수 있도록 그대로 넘깁니다.
              params: { tripId, day, mode },
            });
          }}
          className="absolute bottom-md w-full max-w-[360px] overflow-hidden rounded-lg"
          style={{ opacity: progress >= 100 || loadingStep === 'failed' ? 1 : 0.58 }}>
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

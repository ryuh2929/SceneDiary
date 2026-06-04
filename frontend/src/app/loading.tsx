import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Circle, Image as ImageIcon, Loader2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchTripDayGenerationStatus } from '@/api/diary';
import { useAppThemeColors } from '@/constants/app-colors';
import type { LoadingStep } from '@/types/api';

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

const backendSteps = [
  { key: 'upload', label: '사진 업로드 및 이미지 정리' },
  { key: 'metadata', label: '촬영 날짜와 위치 정보 분류' },
  { key: 'diary', label: '사진을 분석해 일기 초안 생성' },
  { key: 'ready', label: '여행 기록 준비 완료' },
] as const;

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
  const colors = useAppThemeColors();
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
  const [progress, setProgress] = useState(18);
  const [stepIndex, setStepIndex] = useState(0);
  const [loadingStep, setLoadingStep] = useState<LoadingStep | null>(
    tripDayId ? 'analyzing_photos' : null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const hasApiLoading = Boolean(tripDayId) && !isNextDayMode;
  // 다중 일차 추적: 각 일차의 완료 여부를 id → boolean 맵으로 관리합니다.
  const [completedDayIds, setCompletedDayIds] = useState<Set<number>>(new Set());
  const totalDayCount = allDays.length || (tripDayId ? 1 : 0);
  const completedDayCount = completedDayIds.size;
  const allDaysCompleted = totalDayCount > 0 && completedDayCount === totalDayCount;

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

  const currentDay = allDays.find((item) => !completedDayIds.has(item.tripDayId));
  const generationLabel =
    totalDayCount > 1 && currentDay
      ? `${currentDay.day}일차 일기를 만들고 있어요`
      : '사진을 분석해 일기 초안을 만들고 있어요';
  const getBackendStepState = (key: typeof backendSteps[number]['key']) => {
    if (loadingStep === 'failed' && (key === 'diary' || key === 'ready')) return 'failed';
    if (key === 'upload' || key === 'metadata') return 'completed';
    if (key === 'diary') return allDaysCompleted ? 'completed' : 'active';
    return allDaysCompleted ? 'completed' : 'pending';
  };

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2200, easing: Easing.linear }),
      -1,
      false,
    );

  }, [rotation]);

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
    const doneIds = new Set<number>();

    async function pollInitialStatus() {
      try {
        const statuses = await Promise.all(
          dayIdsToTrack.map((id) => fetchTripDayGenerationStatus(id)),
        );
        if (!isMounted) return;
        statuses.forEach((status) => {
          if (status.status === 'completed') doneIds.add(status.tripDayId);
        });
        setCompletedDayIds(new Set(doneIds));
        const failedStatus = statuses.find((status) => status.status === 'failed');
        const completedCount = statuses.filter((status) => status.status === 'completed').length;
        if (failedStatus) {
          setLoadingStep('failed');
          setProgress(100);
          setErrorMessage(failedStatus.errorMessage ?? '일기 생성에 실패했어요.');
        } else if (completedCount === statuses.length) {
          setLoadingStep('completed');
          setProgress(100);
          setErrorMessage(null);
        } else {
          setLoadingStep('generating_diary');
          setProgress(Math.round(58 + (completedCount / statuses.length) * 40));
          setErrorMessage(null);
        }
      } catch {
        if (!isMounted) return;
        setLoadingStep('failed');
        setErrorMessage('분석 상태를 확인하지 못했어요.');
      }
    }

    pollInitialStatus();

    const pollTimer = setInterval(async () => {
      try {
        // 모든 일차의 실제 생성 상태를 함께 조회해 화면 진행 상태에 반영합니다.
        const statuses = await Promise.all(
          dayIdsToTrack.map((id) => fetchTripDayGenerationStatus(id)),
        );
        if (!isMounted) return;
        statuses.forEach((status) => {
          if (status.status === 'completed') doneIds.add(status.tripDayId);
        });
        setCompletedDayIds(new Set(doneIds));

        const failedStatus = statuses.find((status) => status.status === 'failed');
        if (failedStatus) {
          setLoadingStep('failed');
          setProgress(100);
          setErrorMessage(failedStatus.errorMessage ?? '일기 생성에 실패했어요.');
          clearInterval(pollTimer);
          return;
        }

        // 전체 일차 중 완료된 비율을 진행률에 반영합니다.
        const completedCount = statuses.filter((status) => status.status === 'completed').length;

        // 모든 일차가 완료되어야 작성 화면으로 이동합니다.
        if (completedCount === statuses.length) {
          setLoadingStep('completed');
          setProgress(100);
          setErrorMessage(null);
          clearInterval(pollTimer);
          return;
        }
        setLoadingStep('generating_diary');
        setProgress(Math.round(58 + (completedCount / statuses.length) * 40));
        setErrorMessage(null);
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
  }, [allDays, pollingAttempt, hasApiLoading, tripDayId]);

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
    setPollingAttempt((current) => current + 1);
  };

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      className="flex-1 items-center bg-surface px-lg dark:bg-dark-surface"
      style={{ paddingTop: insets.top + 24, paddingBottom: bottomInset }}>
      <View className="mx-auto w-full max-w-[720px] flex-1 items-center justify-center">
        <View className="w-full items-center">
          <View className="relative h-40 w-40 items-center justify-center">
            <Animated.View
              className="absolute h-28 w-28 rounded-full border-[2px]"
              style={[
                {
                  borderColor: 'transparent',
                  borderTopColor: colors.primary,
                  borderRightColor: colors.primaryLight,
                  borderBottomColor: `${colors.primary}33`,
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
                    className="absolute h-16 w-16 overflow-hidden rounded-lg border-2 bg-muted dark:bg-dark-muted"
                    style={{
                      left: 20 + index * 12,
                      borderColor: colors.surface,
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
              <View className="h-14 w-14 items-center justify-center rounded-full bg-muted dark:bg-dark-muted" style={{ zIndex: 6 }}>
                <ImageIcon size={27} color={colors.primary} strokeWidth={2.1} />
              </View>
            )}
          </View>

          <Text className="mt-md text-center text-2xl font-sans-real-bold text-textPrimary dark:text-dark-textPrimary">
            {hasApiLoading && loadingStep !== 'failed' && !allDaysCompleted ? generationLabel : displayStep}
          </Text>
          <Text className="mt-xs text-center text-md font-sans-semibold text-textSecondary dark:text-dark-textSecondary">
            {displayHelperText}
          </Text>

          {!isNextDayMode && photos.length > 3 ? (
            <Text className="mt-sm text-center text-sm font-sans-bold text-textSecondary dark:text-dark-textSecondary">
              외 {photos.length - 3}장 더
            </Text>
          ) : null}

          {hasApiLoading ? (
            <View
              className="mt-lg w-full max-w-[360px] rounded-lg px-md py-md"
              style={{ backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }}>
              {backendSteps.map((step, index) => {
                const state = getBackendStepState(step.key);
                return (
                  <View key={step.key} className={`flex-row items-center ${index > 0 ? 'mt-sm' : ''}`}>
                    <View
                      className="h-6 w-6 items-center justify-center rounded-full"
                      style={{ backgroundColor: state === 'completed' ? colors.primary : colors.surface }}>
                      {state === 'completed' ? (
                        <Check size={14} color={colors.textOnPrimary} strokeWidth={3} />
                      ) : state === 'active' ? (
                        <Loader2 size={15} color={colors.primary} />
                      ) : (
                        <Circle size={12} color={state === 'failed' ? colors.error : colors.textSecondary} />
                      )}
                    </View>
                    <Text
                      className="ml-sm flex-1 text-sm font-sans-semibold"
                      style={{ color: state === 'active' ? colors.textPrimary : colors.textSecondary }}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View className="mt-lg w-[320px] max-w-full">
            <View
              className="h-[10px] overflow-hidden rounded-full"
              style={{ backgroundColor: colors.ring, borderColor: colors.border, borderWidth: 1 }}>
              <LinearGradient
                colors={[colors.primary, colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="h-full rounded-full"
                style={{ width: progressWidth }}
              />
            </View>
            <Text className="mt-sm text-center text-sm font-sans-bold text-textSecondary dark:text-dark-textSecondary">{progress}%</Text>
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
          className="absolute bottom-md w-full max-w-[420px] overflow-hidden rounded-lg"
          style={{ opacity: progress >= 100 || loadingStep === 'failed' ? 1 : 0.58 }}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-14 items-center justify-center">
            <Text className="text-md font-sans-bold text-textOnPrimary">{buttonLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

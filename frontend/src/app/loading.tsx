import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Defs, G, Polygon, RadialGradient, Stop, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchTripDayGenerationStatus, regenerateDay } from '@/api/diary';
import { useAppThemeColors } from '@/constants/app-colors';
import { useAppSettings } from '@/contexts/app-settings-context';
import { WatercolorLayer, MeteorLayer } from '@/components/loading-particles';
import type { LoadingStep } from '@/types/api';

// ─── 타입 ──────────────────────────────────────────────────────────────────────

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

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const COMPLETE_DELAY_MS = 650;
const IS_ANDROID = Platform.OS === 'android';

// 진행률 구간별 단계 문구 (일반 모드)
const PROGRESS_PHASES = [
  { emoji: '🖼️', text: '사진을 차곡차곡 정리하고 있어요',     until: 28 },
  { emoji: '🗓️', text: '여행의 순간을 날짜별로 나누고 있어요', until: 52 },
  { emoji: '🔍', text: '사진 속 이야기를 살펴보고 있어요',     until: 74 },
  { emoji: '✍️', text: '여행의 기억을 글로 옮기고 있어요',     until: 99 },
  { emoji: '✨', text: '여행 일기가 완성됐어요',                until: 100 },
];

// API 폴링 모드에서 단계별 문구
const STEP_PHASES: Record<string, { emoji: string; text: string }> = {
  uploading:         { emoji: '🖼️', text: '사진을 차곡차곡 정리하고 있어요' },
  resizing_images:   { emoji: '🖼️', text: '사진을 차곡차곡 정리하고 있어요' },
  creating_thumbnails:{ emoji: '🗓️', text: '여행의 순간을 날짜별로 나누고 있어요' },
  analyzing_metadata:{ emoji: '🗓️', text: '여행의 순간을 날짜별로 나누고 있어요' },
  analyzing_photos:  { emoji: '🔍', text: '사진 속 이야기를 살펴보고 있어요' },
  generating_diary:  { emoji: '✍️', text: '여행의 기억을 글로 옮기고 있어요' },
  completed:         { emoji: '✨', text: '여행 일기가 완성됐어요' },
  failed:            { emoji: '⚠️', text: '일기 준비에 실패했어요' },
};

// 오래 걸릴 때 순환하는 보조 문구
const LONG_WAIT_CYCLE = [
  { emoji: '📸', text: '사진 한 장 한 장을 살펴보고 있어요' },
  { emoji: '🌟', text: '특별한 기억을 정리하는 중이에요' },
  { emoji: '🗺️', text: '여행의 발자취를 따라가고 있어요' },
  { emoji: '💭', text: '여행의 이야기를 담고 있어요' },
  { emoji: '⏳', text: '조금만 더 기다려 주세요' },
];

// 다음 일차 모드 문구
const NEXT_DAY_CYCLE = [
  { emoji: '📖', text: '다음 일차를 준비하고 있어요' },
  { emoji: '🔗', text: '이전 기록을 이어보고 있어요' },
  { emoji: '🌅', text: '하루의 흐름을 맞추고 있어요' },
  { emoji: '✍️', text: '새 기록 초안을 준비하고 있어요' },
];

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

function getFirstParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
function parsePhotosParam(v: string | string[] | undefined): PreparedPhoto[] {
  const raw = getFirstParam(v);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
type UploadedDayParam = { tripDayId: number; day: number; date: string };
function parseDaysParam(v: string | string[] | undefined): UploadedDayParam[] {
  const raw = getFirstParam(v);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// ─── useFadingText 훅 ──────────────────────────────────────────────────────────
// 문구가 바뀔 때 fade-out → 값 교체 → fade-in

function useFadingText(next: string) {
  const opacity = useSharedValue(1);
  const [shown, setShown] = useState(next);

  useEffect(() => {
    if (next === shown) return;
    // ref 대신 클로저로 캡처 → worklet에 객체가 넘어가지 않음 (경고 제거)
    const captured = next;
    opacity.value = withTiming(0, { duration: 200 }, (ok) => {
      if (ok) {
        runOnJS(setShown)(captured);
        opacity.value = withDelay(40, withTiming(1, { duration: 360 }));
      }
    });
  }, [next]); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return { shown, animStyle };
}

// ─── TriangleLogo ─────────────────────────────────────────────────────────────
// SVG 삼각형 + 맥박 펄스 + 외곽 링 (1개만, 중복 없음)

function TriangleLogo({
  primaryColor, glowColor, progress,
}: { primaryColor: string; glowColor: string; progress: number }) {
  const pulse = useSharedValue(1);
  const ring  = useSharedValue(0);       // 0→360 회전

  useEffect(() => {
    // 펄스: 천천히 숨쉬는 느낌
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.00, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ), -1, false,
    );
    // 링 1개 회전 (IS_ANDROID면 조금 빠르게)
    ring.value = withRepeat(
      withTiming(360, { duration: IS_ANDROID ? 2000 : 2400, easing: Easing.linear }),
      -1, false,
    );
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring.value}deg` }],
  }));

  // 완료되면 삼각형 살짝 커지는 효과
  const doneScale = useSharedValue(1);
  useEffect(() => {
    if (progress >= 100) {
      doneScale.value = withSequence(
        withTiming(1.25, { duration: 300, easing: Easing.out(Easing.back(2)) }),
        withTiming(1.00, { duration: 400 }),
      );
    }
  }, [progress >= 100]);  // eslint-disable-line react-hooks/exhaustive-deps
  const doneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: doneScale.value }],
  }));

  return (
    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      {/* 정지 링 — 같은 크기, 얇고 연하게 */}
      <View
        style={{
          position:    'absolute',
          width:        110,
          height:       110,
          borderRadius: 55,
          borderWidth:  1.5,
          borderColor: `${glowColor}50`,
        }}
      />
      {/* 회전 호 — 같은 크기, borderTop만 색 */}
      <Animated.View
        style={[
          ringStyle,
          {
            position:     'absolute',
            width:         110,
            height:        110,
            borderRadius:  55,
            borderWidth:   2.5,
            borderColor:  'transparent',
            borderTopColor: primaryColor,
          },
        ]}
      />
      {/* 삼각형 */}
      <Animated.View style={pulseStyle}>
        <Animated.View style={doneStyle}>
          <Svg width={56} height={52} viewBox="0 0 56 52">
          <Defs>
            <RadialGradient id="triGrad" cx="50%" cy="60%" r="60%">
              <Stop offset="0%"   stopColor={glowColor}   stopOpacity={1} />
              <Stop offset="100%" stopColor={primaryColor} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <G>
            {/* 그림자 삼각형 */}
            <Polygon
              points="28,6 52,48 4,48"
              fill={`${primaryColor}22`}
              transform="translate(1,2)"
            />
            {/* 메인 삼각형 */}
            <Polygon
              points="28,5 52,47 4,47"
              fill="url(#triGrad)"
              stroke={`${glowColor}99`}
              strokeWidth={1}
            />
          </G>
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── PhotoCards ───────────────────────────────────────────────────────────────
// 사진 3장이 펼쳐져 있다가 progress 오름에 따라 모여드는 애니메이션

function PhotoCards({
  photos, progress, surfaceColor,
}: { photos: PreparedPhoto[]; progress: number; surfaceColor: string }) {
  // 완료에 가까울수록 카드가 중앙으로 모임 (gather: 0=펼침, 1=완전히 모임)
  const gather = useSharedValue(0);
  useEffect(() => {
    const target = Math.max(0, (progress - 60) / 40); // 60% 이후부터 모이기 시작
    gather.value = withTiming(target, { duration: 600, easing: Easing.inOut(Easing.sin) });
  }, [progress]);  // eslint-disable-line react-hooks/exhaustive-deps

  const preview = photos.slice(0, 3);

  // 카드별 초기 offsets
  const offsets = [
    { x: 18, rot: -8 },
    { x:  0, rot:  3 },
    { x: 16, rot:  9 },  // 오른쪽이 위로
  ];

  return (
    <View style={{ width: 108, height: 72, alignItems: 'center', justifyContent: 'center' }}>
      {preview.map((photo, i) => (
        <GatheringCard
          key={`${photo.thumbnailUri}-${i}`}
          photo={photo}
          offsetX={offsets[i].x}
          rot={offsets[i].rot}
          index={i}
          gather={gather}
          surfaceColor={surfaceColor}
        />
      ))}
    </View>
  );
}

function GatheringCard({
  photo, offsetX, rot, index, gather, surfaceColor,
}: {
  photo: PreparedPhoto; offsetX: number; rot: number;
  index: number; gather: SharedValue<number>; surfaceColor: string;
}) {
  const style = useAnimatedStyle(() => {
    const g = gather.value;
    // gather가 1에 가까울수록 offset/rotation이 0으로 수렴
    const tx = offsetX * (1 - g);
    const rz = rot    * (1 - g);
    const sc = 1 + g * 0.08; // 살짝 커지며 모임
    return {
      transform: [
        { translateX: tx },
        { rotate:    `${rz}deg` },
        { scale:      sc },
      ],
      zIndex: index,
    };
  });

  return (
    <Animated.View
      style={[
        style,
        {
          position:     'absolute',
          width:          64,
          height:         64,
          borderRadius:    8,
          borderWidth:     2,
          borderColor:    surfaceColor,
          overflow:       'hidden',
          shadowColor:    '#000',
          shadowOffset:   { width: 0, height: 3 },
          shadowOpacity:   0.12,
          shadowRadius:    6,
          elevation:       3,
        },
      ]}
    >
      <Image
        source={{ uri: photo.thumbnailUri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

// ─── AnimatedProgressBar ──────────────────────────────────────────────────────

function AnimatedProgressBar({
  progress, primaryColor, accentColor, ringColor,
}: {
  progress: number; primaryColor: string; accentColor: string; ringColor: string;
}) {
  const animPct = useSharedValue(progress);

  useEffect(() => {
    animPct.value = withTiming(progress, {
      duration: 700,
      easing:   Easing.out(Easing.cubic),
    });
  }, [progress]);  // eslint-disable-line react-hooks/exhaustive-deps

  const barStyle = useAnimatedStyle(() => ({
    width: `${animPct.value}%`,
  }));

  // 진행 끝 글로우 닷
  const dotStyle = useAnimatedStyle(() => ({
    left: `${Math.min(animPct.value, 97)}%`,
    opacity: animPct.value > 5 ? 1 : 0,
  }));

  return (
    <View style={{ width: '100%', maxWidth: 320, paddingHorizontal: 4 }}>
      {/* 트랙 */}
      <View
        style={{
          height:         13,
          borderRadius:    8,
          overflow:       'hidden',
          backgroundColor: ringColor,
          borderWidth:     1,
          borderColor:    `${primaryColor}33`,
          position:       'relative',
        }}
      >
        {/* 채워지는 그라디언트 */}
        <Animated.View style={[barStyle, { height: '100%', borderRadius: 8, overflow: 'hidden' }]}>
          <LinearGradient
            colors={[primaryColor, accentColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* 끝단 글로우 닷 */}
        <Animated.View
          style={[
            dotStyle,
            {
              position:        'absolute',
              top:              2,
              width:            9,
              height:           9,
              borderRadius:     5,
              backgroundColor: '#fff',
              opacity:          0.9,
              shadowColor:     primaryColor,
              shadowOffset:    { width: 0, height: 0 },
              shadowOpacity:    1,
              shadowRadius:     5,
              elevation:        4,
              marginLeft:      -5,
            },
          ]}
        />
      </View>

      {/* 퍼센트 */}
      <Text
        style={{
          marginTop:  8,
          textAlign: 'center',
          fontSize:   13,
          fontWeight: '600',
          color:     `${primaryColor}cc`,
        }}
      >
        {progress}%
      </Text>
    </View>
  );
}

// ─── LoadingScreen (메인) ──────────────────────────────────────────────────────

export default function LoadingScreen() {
  const router = useRouter();
  const colors = useAppThemeColors();
  const { isDarkMode } = useAppSettings();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    path?: string; photos?: string; tripId?: string;
    tripDayId?: string; day?: string; mode?: string; days?: string;
  }>();

  const photos      = useMemo(() => parsePhotosParam(params.photos), [params.photos]);
  const previewPhotos = useMemo(() => photos.slice(0, 3), [photos]);
  const tripId      = getFirstParam(params.tripId)    ?? '1';
  const tripDayId   = getFirstParam(params.tripDayId);
  const day         = getFirstParam(params.day)       ?? '1';
  const mode        = getFirstParam(params.mode)      ?? 'initial';
  const allDays     = useMemo(() => parseDaysParam(params.days), [params.days]);

  const isNextDayMode = mode === 'next-day';
  const hasApiLoading = Boolean(tripDayId) && !isNextDayMode;

  const [progress,       setProgress]       = useState(18);
  const [stepIndex,      setStepIndex]      = useState(0);
  const [loadingStep,    setLoadingStep]    = useState<LoadingStep | null>(
    tripDayId ? 'analyzing_photos' : null,
  );
  const [errorMessage,   setErrorMessage]   = useState<string | null>(null);
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const [failedDayId, setFailedDayId] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const totalDayCount     = allDays.length || (tripDayId ? 1 : 0);

  // ── 현재 보여줄 문구 계산 ────────────────────────────────────────────────────

  const currentPhase: { emoji: string; text: string } = useMemo(() => {
    if (loadingStep === 'failed') return { emoji: '⚠️', text: errorMessage ?? '일기 준비에 실패했어요' };
    if (isNextDayMode) {
      return NEXT_DAY_CYCLE[stepIndex % NEXT_DAY_CYCLE.length];
    }
    if (hasApiLoading && loadingStep) {
      // generating_diary가 오래걸리면 LONG_WAIT_CYCLE 순환
      if (loadingStep === 'generating_diary' && stepIndex > 0) {
        return LONG_WAIT_CYCLE[(stepIndex - 1) % LONG_WAIT_CYCLE.length];
      }
      return STEP_PHASES[loadingStep] ?? STEP_PHASES.generating_diary;
    }
    // progress 기반 일반 모드
    const phase = PROGRESS_PHASES.find((p) => progress <= p.until);
    return phase ?? PROGRESS_PHASES[PROGRESS_PHASES.length - 1];
  }, [loadingStep, isNextDayMode, hasApiLoading, stepIndex, progress, errorMessage]);

  // 보조 문구
  const helperText = useMemo(() => {
    if (loadingStep === 'failed') return errorMessage ?? '잠시 후 다시 시도해 주세요';
    if (progress >= 100) return '';
    if (isNextDayMode) return `${day}일차 기록을 준비 중이에요`;
    const countLabel = photos.length > 0 ? `${photos.length}장의 사진` : '선택한 사진';
    const firstDayLabel = totalDayCount > 1 ? ' 첫 일차를 먼저 열 준비를 하고 있어요' : ' 하루 기록을 준비 중이에요';
    return `${countLabel}으로${firstDayLabel}`;
  }, [loadingStep, progress, isNextDayMode, day, totalDayCount, photos.length, errorMessage]);

  const buttonLabel =
    loadingStep === 'failed'     ? (isRetrying ? '다시 시도 중...' : '다시 시도하기')
    : progress >= 100            ? (isNextDayMode ? `${day}일차 편집 화면으로 이동` : '작성 화면으로 이동')
    : '준비가 끝나면 자동으로 이동해요';

  // ── 페이드 문구 ──────────────────────────────────────────────────────────────

  const { shown: shownEmoji, animStyle: emojiAnim } = useFadingText(currentPhase.emoji);
  const { shown: shownText,  animStyle: textAnim  } = useFadingText(currentPhase.text);
  const { shown: shownHelper, animStyle: helperAnim } = useFadingText(helperText);

  // ── 애니메이션 타이머 (progress 기반 & step 순환) ───────────────────────────

  useEffect(() => {
    if (hasApiLoading) return;
    const progressTimer = setInterval(() => {
      setProgress((c) => c >= 100 ? c : Math.min(c + 4, 100));
    }, 620);
    const stepTimer = setInterval(() => {
      setStepIndex((c) => c + 1);
    }, 1700);
    return () => { clearInterval(progressTimer); clearInterval(stepTimer); };
  }, [hasApiLoading]);


  // 장시간 대기 시 LONG_WAIT_CYCLE 순환
  useEffect(() => {
    if (!hasApiLoading) return;
    const timer = setInterval(() => {
      setStepIndex((c) => c + 1);
    }, 2800);
    return () => clearInterval(timer);
  }, [hasApiLoading]);

  // ── API 폴링 ───────────────────────────────────────────

  useEffect(() => {
    if (!hasApiLoading || !tripDayId) return;
    let isMounted = true;
    const firstId = Number(tripDayId);
    // 작성 화면은 첫 일차만 준비되면 열고, 나머지 일차는 diary_writing의 상태 폴링이 이어서 처리합니다.
    const dayIds = [firstId];
    let pollInFlight = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    async function poll() {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        const statuses = await Promise.all(dayIds.map((id) => fetchTripDayGenerationStatus(id)));
        if (!isMounted) return;
        const failed    = statuses.find((s) => s.status === 'failed');
        const doneCount = statuses.filter((s) => s.status === 'completed').length;
        if (failed) {
          setLoadingStep('failed'); setProgress(100);
          setFailedDayId(failed.tripDayId);
          setErrorMessage(failed.errorMessage ?? '일기 생성에 실패했어요.');
          stopPolling();
        } else if (doneCount === statuses.length) {
          setLoadingStep('completed'); setProgress(100); setErrorMessage(null);
          setFailedDayId(null);
          stopPolling();
        } else {
          setLoadingStep('generating_diary');
          setProgress(Math.round(58 + (doneCount / statuses.length) * 40));
          setErrorMessage(null);
          setFailedDayId(null);
        }
      } catch {
        if (!isMounted) return;
        setLoadingStep('failed'); setErrorMessage('분석 상태를 확인하지 못했어요.');
        setFailedDayId(null);
        stopPolling();
      } finally {
        pollInFlight = false;
      }
    }

    void poll();
    timer = setInterval(() => { void poll(); }, 1800);
    return () => { isMounted = false; stopPolling(); };
  }, [allDays, pollingAttempt, hasApiLoading, tripDayId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 완료 → 화면 전환 ───────────────────────────────

  useEffect(() => {
    if (progress < 100 || loadingStep === 'failed') return;
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/diary_writing',
        params:   { tripId, day, mode, path: params.path },
      });
    }, COMPLETE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [day, loadingStep, mode, progress, router, tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryGeneration = async () => {
    if (!tripDayId || isRetrying) return;
    setIsRetrying(true);
    setLoadingStep('analyzing_photos'); setErrorMessage(null);
    setProgress(42);
    try {
      if (failedDayId !== null) {
        await regenerateDay(failedDayId);
      }
      setFailedDayId(null);
      setPollingAttempt((c) => c + 1);
    } catch {
      setLoadingStep('failed');
      setErrorMessage('일기 재생성을 요청하지 못했어요.');
    } finally {
      setIsRetrying(false);
    }
  };

  const paddingTop    = insets.top + 24;
  const paddingBottom = Math.max(insets.bottom, 16);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop, paddingBottom }}>
      <WatercolorLayer isDark={isDarkMode} />
      <MeteorLayer     isDark={isDarkMode} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', height: 160 }}>
          <TriangleLogo primaryColor={colors.primary} glowColor={colors.primaryLight} progress={progress} />
          {previewPhotos.length > 0 && (
            <View style={{ position: 'absolute' }}>
              <PhotoCards photos={previewPhotos} progress={progress} surfaceColor={colors.surface} />
            </View>
          )}
        </View>
        <View style={{ marginTop: 28, alignItems: 'center' }}>
          <Animated.Text style={[emojiAnim, { fontSize: 32, marginBottom: 8 }]}>{shownEmoji}</Animated.Text>
          <Animated.Text style={[textAnim, { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', lineHeight: 28 }]}>
            {shownText}
          </Animated.Text>
          {helperText !== '' && (
            <Animated.Text style={[helperAnim, { marginTop: 6, fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }]}>
              {shownHelper}
            </Animated.Text>
          )}
          {!isNextDayMode && photos.length > 3 && (
            <Text style={{ marginTop: 4, fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
              외 {photos.length - 3}장 더
            </Text>
          )}
        </View>
        <View style={{ marginTop: 32, width: '100%', alignItems: 'center' }}>
          <AnimatedProgressBar progress={progress} primaryColor={colors.primary} accentColor={colors.accent} ringColor={colors.ring} />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="일기 작성 화면으로 이동"
        disabled={isRetrying || (progress < 100 && loadingStep !== 'failed')}
        onPress={() => {
          if (loadingStep === 'failed') { void retryGeneration(); return; }
          router.replace({ pathname: '/diary_writing', params: { tripId, day, mode } });
        }}
        style={{ marginHorizontal: 24, borderRadius: 12, overflow: 'hidden', opacity: progress >= 100 || loadingStep === 'failed' ? 1 : 0.52 }}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryLight, colors.accent]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textOnPrimary }}>{buttonLabel}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

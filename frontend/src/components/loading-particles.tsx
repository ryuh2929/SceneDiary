/**
 * loading-particles.tsx
 * 로딩 화면용 수채화 파티클 + 유성우 스파클 레이어
 * - reanimated UI 스레드에서 실행 (JS 부하 없음)
 * - renderToHardwareTextureAndroid: GPU 레이어 캐싱
 * - Android: 파티클 수/duration 조정으로 GPU 업데이트 최소화
 */
import React, { useEffect, useMemo } from 'react';
import { Dimensions, Platform, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width: SW, height: SH } = Dimensions.get('window');
const IS_ANDROID = Platform.OS === 'android';

const BLOB_COLORS_LIGHT = [
  '#C5D8F0', '#A9C3E6', '#F6D9A6', '#E8C99A',
  '#D4E5F7', '#F0E4C8', '#B8CDE8', '#DDE8F5',
];
const BLOB_COLORS_DARK = [
  '#1A3352', '#243348', '#2F4965', '#1E2D45',
  '#162638', '#263D58', '#1C2E44', '#0F2035',
];
const METEOR_COLORS_LIGHT = ['#5B7DBB', '#A9C3E6', '#F6D9A6', '#8FB4E0'];
const METEOR_COLORS_DARK = ['#A9C3E6', '#C5D8F0', '#6F89B8', '#DDE3EE'];

const BLOB_COUNT = IS_ANDROID ? 4 : 8;
const METEOR_COUNT = IS_ANDROID ? 3 : 6;
const BLOB_DURATION_SCALE = IS_ANDROID ? 1.6 : 1.0;

type BlobCfg = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  baseOpacity: number;
  delay: number;
  duration: number;
  br: number;
};

function makeBlobConfigs(isDark: boolean): BlobCfg[] {
  const colors = isDark ? BLOB_COLORS_DARK : BLOB_COLORS_LIGHT;
  const slots: [number, number][] = [
    [-0.15, -0.08], [0.58, -0.12], [0.82, 0.28],
    [-0.08, 0.48], [0.52, 0.68], [0.18, 0.82],
    [0.68, 0.78], [0.28, 0.18],
  ];
  return slots.slice(0, BLOB_COUNT).map((pos, i) => ({
    x: pos[0] * SW,
    y: pos[1] * SH,
    w: 150 + ((i * 29) % 110),
    h: 120 + ((i * 37) % 100),
    color: colors[i % colors.length],
    // 라이트 0.22~0.36, 다크 0.38~0.54
    baseOpacity: isDark ? 0.38 + (i % 3) * 0.08 : 0.22 + (i % 3) * 0.07,
    delay: i * 480,
    duration: (3800 + i * 650) * BLOB_DURATION_SCALE,
    br: 60 + ((i * 19) % 40),
  }));
}

function WatercolorBlob({ cfg }: { cfg: BlobCfg }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(cfg.baseOpacity);

  useEffect(() => {
    const opts = { easing: Easing.inOut(Easing.sin) };
    scale.value = withDelay(
      cfg.delay,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: cfg.duration, ...opts }),
          withTiming(1.0, { duration: cfg.duration, ...opts }),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      cfg.delay,
      withRepeat(
        withSequence(
          withTiming(cfg.baseOpacity, { duration: cfg.duration * 0.9 }),
          withTiming(cfg.baseOpacity * 0.5, { duration: cfg.duration * 0.9 }),
        ),
        -1,
        false,
      ),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      renderToHardwareTextureAndroid={IS_ANDROID}
      style={[
        style,
        {
          position: 'absolute',
          left: cfg.x,
          top: cfg.y,
          width: cfg.w,
          height: cfg.h,
          borderRadius: cfg.br,
          backgroundColor: cfg.color,
        },
      ]}
    />
  );
}

export function WatercolorLayer({ isDark }: { isDark: boolean }) {
  const configs = useMemo(() => makeBlobConfigs(isDark), [isDark]);
  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {configs.map((c, i) => (
        <WatercolorBlob key={i} cfg={c} />
      ))}
    </View>
  );
}

function MeteorSpark({ index, isDark }: { index: number; isDark: boolean }) {
  const colors = isDark ? METEOR_COLORS_DARK : METEOR_COLORS_LIGHT;
  const color = colors[index % colors.length];
  const size = 3 + (index % 4); // 3~6px

  // 화면 아래에서 시작, 가로로 분산
  const startX = SW * (0.08 + ((index * 0.17) % 0.84));
  const startY = SH + 15 + index * 12;
  // 위로 이동 + 좌우 살짝 흔들 (짝수: 오른쪽, 홀수: 왼쪽)
  const drift = (index % 2 === 0 ? 1 : -1) * SW * (0.04 + ((index * 0.025) % 0.12));
  const travelY = -(SH * (0.45 + ((index * 0.05) % 0.35)));
  const duration = 2200 + index * 350;
  const loopDelay = index * 520;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      loopDelay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // 올라갈수록 서서히 사라짐
    const alpha = p < 0.12 ? p / 0.12 : p > 0.65 ? (1 - p) / 0.35 : 1;
    return {
      opacity: Math.max(0, Math.min(1, alpha)) * (isDark ? 0.88 : 0.68),
      transform: [
        { translateX: startX + drift * p },
        { translateY: startY + travelY * p },
        { rotate: `${-360 * p}deg` }, // 역방향(반시계) 회전
      ],
    };
  });

  return (
    <Animated.View
      renderToHardwareTextureAndroid={IS_ANDROID}
      style={[
        style,
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size * 2, // 덜 길쭉하게
          borderRadius: size,
          backgroundColor: color,
        },
      ]}
    />
  );
}

export function MeteorLayer({ isDark }: { isDark: boolean }) {
  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: METEOR_COUNT }, (_, i) => (
        <MeteorSpark key={i} index={i} isDark={isDark} />
      ))}
    </View>
  );
}

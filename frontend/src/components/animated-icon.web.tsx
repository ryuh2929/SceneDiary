import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppSettings } from '@/contexts/app-settings-context';

const SPLASH_DURATION = 3000;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const { isDarkMode } = useAppSettings();

  // 웹에서도 네이티브와 동일한 3초 MP4를 사용해 플랫폼별 타이밍 차이를 없앱니다.
  const source = isDarkMode
    ? require('../assets/splash/scenediary-splash-v3-3s-dark.mp4')
    : require('../assets/splash/scenediary-splash-v3-3s.mp4');

  // 브라우저 자동 재생 정책에 맞춰 음소거 상태로 한 번만 재생합니다.
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), SPLASH_DURATION);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.splashOverlay} pointerEvents="none">
      <VideoView
        player={player}
        style={styles.splashVideo}
        nativeControls={false}
        contentFit="cover"
        playsInline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#152538',
    zIndex: 10000,
  },
  splashVideo: {
    width: '100%',
    height: '100%',
  },
});

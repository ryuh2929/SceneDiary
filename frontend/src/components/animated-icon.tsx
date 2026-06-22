import * as SplashScreen from 'expo-splash-screen';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, StyleSheet, View } from 'react-native';
import { useAppSettings } from '@/contexts/app-settings-context';

const MIN_SHOW_MS = 3000;
const MAX_WAIT_MS = 3000;

export function AnimatedSplashOverlay({ ready = false }: { ready?: boolean }) {
  const { isDarkMode, isLoaded } = useAppSettings();
  const [visible, setVisible] = useState(true);
  const fadeStartedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  // 앱 설정이 준비되기 전에는 라이트 영상을 사용하고, 준비된 뒤 현재 테마를 반영합니다.
  const useDarkSplash = isLoaded && isDarkMode;
  const source = useDarkSplash
    ? require('../assets/splash/scenediary-splash-v3-3s-dark.mp4')
    : require('../assets/splash/scenediary-splash-v3-3s.mp4');

  // 로컬 MP4를 무음으로 한 번만 재생하며, 화면 종료는 아래 3초 타이머가 담당합니다.
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => h.remove();
  }, []);

  const startFadeOut = () => {
    if (fadeStartedRef.current) return;
    fadeStartedRef.current = true;
    setVisible(false);
  };

  useEffect(() => {
    if (!ready) return;
    const elapsed = Date.now() - startTimeRef.current;
    const t = setTimeout(startFadeOut, Math.max(0, MIN_SHOW_MS - elapsed));
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    const t = setTimeout(startFadeOut, MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <Modal
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="cover"
          surfaceType="textureView"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#152538',
  },
  video: {
    flex: 1,
    backgroundColor: '#152538',
  },
});

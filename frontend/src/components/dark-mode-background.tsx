import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

export function DarkModeBackground() {
  return (
    <LinearGradient
      pointerEvents="none"
      // 다크모드 화면 전체에 아주 약한 깊이감만 주는 배경 레이어입니다.
      // 별이나 입자처럼 시선을 끄는 장식 대신, 단색 배경이 납작해 보이지 않게만 보정합니다.
      colors={['#07111F', '#0B1624', '#101D2D']}
      locations={[0, 0.58, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

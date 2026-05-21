import { Stack } from 'expo-router';
import React from 'react';
import { useFonts } from 'expo-font';
import { DancingScript_400Regular } from '@expo-google-fonts/dancing-script';
import { GowunDodum_400Regular } from '@expo-google-fonts/gowun-dodum';
import { View } from 'react-native';
import '../../global.css';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DancingScript: DancingScript_400Regular,
    GowunDodum: GowunDodum_400Regular,
  });

  if (!fontsLoaded) {
    return <View className="flex-1 bg-background" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* 1. 메인 진입점을 하단 탭 구조인 (tabs) 폴더로 지정합니다 */}
      <Stack.Screen name="(tabs)" /> 
      
      {/* 2. 상세 페이지나 추가 페이지는 탭 바 위로 전체 화면이 덮여야 하므로 여기에 둡니다 */}
      <Stack.Screen name="detail" />
      <Stack.Screen name="add" />
      
    </Stack>
  );
}
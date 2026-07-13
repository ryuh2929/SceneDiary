import { Stack } from "expo-router";
import React from "react";
import { useFonts } from "expo-font";
import { DancingScript_400Regular } from "@expo-google-fonts/dancing-script";
import {
  Hahmlet_400Regular,
  Hahmlet_500Medium,
  Hahmlet_600SemiBold,
  Hahmlet_700Bold,
} from "@expo-google-fonts/hahmlet";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { useUserUuidBootstrap } from "@/hooks/use-user-uuid";
import "../../global.css";
import "@/api/client";

// JS 로딩이 끝나기 전에 네이티브 스플래시가 먼저 사라지지 않도록 유지합니다.
// 영상 오버레이가 준비되면 AnimatedSplashOverlay에서 직접 숨깁니다.
// SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const userReady = useUserUuidBootstrap();
  const [fontsLoaded] = useFonts({
    DancingScript: DancingScript_400Regular,
    Hahmlet: Hahmlet_400Regular, // 추가
    HahmletBold: Hahmlet_600SemiBold, // 추가
    // Hahmlet은 굵기별 파일명이 따로 있어서 화면에서 쓰는 weight를 명시적으로 로드합니다.
    HahmletMedium: Hahmlet_500Medium,
    HahmletSemiBold: Hahmlet_600SemiBold,
    HahmletRealBold: Hahmlet_700Bold,
  });

  if (!fontsLoaded) {
    return <View className="flex-1 bg-background" />;
  }
  return (
    <AppSettingsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* 1. 메인 진입점을 하단 탭 구조인 (tabs) 폴더로 지정합니다 */}
        <Stack.Screen name="(tabs)" />

        {/* 2. 상세 페이지나 추가 페이지는 탭 바 위로 전체 화면이 덮여야 하므로 여기에 둡니다 */}
        <Stack.Screen name="detail" />
        <Stack.Screen name="add" />
      </Stack>
      <AnimatedSplashOverlay ready={userReady} />
    </AppSettingsProvider>
  );
}

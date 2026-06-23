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
import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { useUserUuidBootstrap } from "@/hooks/use-user-uuid";
import "../../global.css";
import "@/api/client";

export default function RootLayout() {
  const userReady = useUserUuidBootstrap();
  const [fontsLoaded] = useFonts({
    DancingScript: DancingScript_400Regular,
    Hahmlet: Hahmlet_400Regular,        // 추가
    HahmletBold: Hahmlet_600SemiBold,       // 추가
    // Hahmlet은 굵기별 파일명이 따로 있어서 화면에서 쓰는 weight를 명시적으로 로드합니다.
    HahmletMedium: Hahmlet_500Medium,
    HahmletSemiBold: Hahmlet_600SemiBold,
    HahmletRealBold: Hahmlet_700Bold,

  });

  if (!fontsLoaded) {
    // 네이티브 스플래시가 자동으로 닫힌 뒤 영상 오버레이가 준비되기 전까지
    // 같은 배경색을 유지해 순간적인 흰 화면 노출을 최소화합니다.
    return <View style={{ flex: 1, backgroundColor: "#152538" }} />;
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

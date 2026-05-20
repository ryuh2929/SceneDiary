// src/app/_layout.tsx
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import React from "react";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colorScheme === "dark" ? "#121212" : "#ffffff",
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
      }}
    >
      {/* 🏠 1. 홈 탭 ((tabs)/index.tsx 와 매핑) */}
      <Tabs.Screen
        name="index" // 👈 (tabs)/ 를 빼고 "index"만 적어줍니다!
        options={{
          title: "Home",
        }}
      />

      {/* 📍 2. 지도 탭 ((tabs)/map.tsx 와 매핑) */}
      <Tabs.Screen
        name="map" // 👈 "map"만 적어줍니다!
        options={{
          title: "Map",
        }}
      />

      {/* ⚙️ 3. 설정 탭 ((tabs)/setting.tsx 와 매핑) */}
      <Tabs.Screen
        name="setting" // 👈 "setting"만 적어줍니다!
        options={{
          title: "Setting",
        }}
      />
    </Tabs>
  );
}

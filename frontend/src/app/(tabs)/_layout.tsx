import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import BottomNav from '../../components/bottom-nav';

export default function TabsLayout() {
  return (
    <View className="flex-1">
        {/* 화면 전환은 Expo Router의 Tabs가 처리하도록 둡니다 */}
      <Tabs
        screenOptions={{
          headerShown: false,
          // Expo Router가 기본으로 제공하는 하단 탭 바를 화면에서 숨깁니다.
          tabBarStyle: { display: 'none' }, 
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="map" />
        <Tabs.Screen name="settings" />
      </Tabs>

      {/* Expo 탭 바 대신, 내가 직접 만든 네비바를 바닥에 띄웁니다 */}
      <BottomNav />
    </View>
  );
}
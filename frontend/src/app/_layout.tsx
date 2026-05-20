import { Stack } from 'expo-router';
import React from 'react';
import { useFonts } from 'expo-font';
import { DancingScript_400Regular } from '@expo-google-fonts/dancing-script';
import { GowunDodum_400Regular } from '@expo-google-fonts/gowun-dodum';
import { View } from 'react-native';
import '../global.css';

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
      <Stack.Screen name="index" />
      <Stack.Screen name="Home" />
      <Stack.Screen name="Detail" />
      <Stack.Screen name="add" />
      <Stack.Screen name="map" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
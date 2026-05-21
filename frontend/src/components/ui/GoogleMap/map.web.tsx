import React from "react";
import { View, Text } from "react-native";

export default function CustomMap() {
  return (
    <View className="flex-1 bg-background items-center justify-center p-5">
      <View className="bg-surface p-6 rounded-2xl shadow-md border border-border items-center max-w-sm">
        <Text className="text-xl font-bold text-textPrimary mb-2">
          📍 지도 확인 안내
        </Text>
        <Text className="text-sm text-textSecondary text-center leading-5">
          이 페이지는 모바일 전용 지도 라이브러리를 사용하고 있습니다.
          시뮬레이터나 실기기에서 확인해 주세요!
        </Text>
      </View>
    </View>
  );
}
// 웹에서는 마커가 필요 없으므로 빈 컴포넌트 처리
export function Marker() {
  return null;
}

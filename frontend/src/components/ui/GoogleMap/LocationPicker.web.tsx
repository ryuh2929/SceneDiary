// ─────────────────────────────────────────────────────────────────────────
// 여행지 피커 — 웹 폴백(대체) 버전
//
// [왜 이 파일이 따로 있나]
//   지도(react-native-maps)는 앱(native)에서만 동작합니다. 웹에서 지도를 부르면
//   에러가 나므로, 웹에서는 지도 대신 "앱에서 선택하세요" 안내창만 띄웁니다.
//   (팀원의 GoogleMap/map.web.tsx 와 똑같은 방침)
//
// [자동 선택]
//   Expo가 웹이면 이 .web.tsx 를, 앱이면 LocationPicker.tsx 를 알아서 고릅니다.
//   그래서 일기 화면은 그냥 `LocationPicker` 하나만 부르면 됩니다.
//
// [props 모양은 native와 동일]
//   visible/onClose/onSelect 를 똑같이 받습니다(타입이 어긋나면 안 되므로).
//   다만 웹에선 위치를 못 고르니 onSelect 는 사용하지 않고, 닫기(onClose)만 씁니다.
// ─────────────────────────────────────────────────────────────────────────
import React from "react";
import {Modal, Pressable, Text, View} from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (placeName: string, lat: number, lon: number) => void; // 웹에선 미사용(모양 맞추기용)
};

export default function LocationPicker({visible, onClose}: Props) {
  return (
    // 반투명 배경 위에 작은 안내 카드를 띄우는 모달.
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/40 p-6">
        <View className="w-full max-w-sm items-center gap-3 rounded-2xl bg-surface p-6">
          <Text className="text-base font-bold text-textPrimary">
            📍 여행지 선택
          </Text>
          <Text className="text-center text-sm leading-5 text-textSecondary">
            지도는 앱(모바일)에서만 사용할 수 있어요. 시뮬레이터나 실기기에서
            선택해주세요.
          </Text>
          <Pressable
            onPress={onClose}
            className="mt-2 rounded-xl bg-primary px-5 py-3"
          >
            <Text className="font-bold text-textOnPrimary">닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

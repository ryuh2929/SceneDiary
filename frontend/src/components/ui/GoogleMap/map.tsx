import React, { useState, useEffect } from "react";
import { View, Image } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import SimpleView from "./simpleView"; // 이사 간 카드뷰 불러오기
import { getTripDays } from "@/api/map"; // 👈 우리가 만든 API 호출 함수
import { Days } from "@/types/api"; // 👈 아까 정의한 타입

export default function MapScreen() {
  const [dayMarkers, setDayMarkers] = useState<Days[]>([]);
  const [selectedItem, setSelectedItem] = useState<Days | null>(null);
  // 2. useEffect 추가: 화면이 처음 뜰 때 1번만 실행
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getTripDays(); // API 호출
        setDayMarkers(data); // 데이터를 상태에 저장
      } catch (error) {
        console.error("데이터 불러오기 에러:", error);
      }
    };

    fetchData();
  }, []); // 빈 배열 []은 처음 한 번만 실행하라는 의미
  return (
    <View className="flex-1 bg-background">
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 37.5665,
          longitude: 126.978,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {dayMarkers.map((item) => (
          <Marker
            key={item.id}
            coordinate={{
              latitude: item.representative_lat || 0,
              longitude: item.representative_lon || 0,
            }}
            tracksViewChanges={true}
            onPress={() => setSelectedItem(item)}
          >
            <View className="items-center w-[60px] h-[75px]">
              <View className="w-[56px] h-[56px] p-[2px] bg-surface border-2 border-primary rounded-full shadow-md items-center justify-center"></View>
              <View className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-primary -mt-[2px]" />
            </View>
          </Marker>
        ))}
      </MapView>

      {selectedItem && <SimpleView item={selectedItem} />}
    </View>
  );
}

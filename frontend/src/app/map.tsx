// src/app/map.tsx (모바일 전용 파일이 됩니다)
import React, { useState } from "react";
import { StyleSheet, View, Image } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";

export default function MapScreen() {
  const theme = useColorScheme() ?? "light"; // 현재 기기 테마가 무엇인지 확인
  const styles = createStyles(theme); // 테마를 넘겨서 스타일 객체를 받아옴
  const [markers] = useState([
    {
      id: 1,
      lat: 37.5665,
      lon: 126.978,
      title: "서울시청",
      img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e",
    },
    {
      id: 2,
      lat: 37.57,
      lon: 126.98,
      title: "인사동",
      img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e",
    },
    {
      id: 3,
      lat: 37.55,
      lon: 126.99,
      title: "남산타워",
      img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e",
    },
  ]);

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 37.5665,
          longitude: 126.978,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {/* 2. .map() 함수를 이용한 마커 반복 생성 */}
        {markers.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lon }}
          >
            <View className="items-center">
              {/* 마커 컨테이너: 설정하신 border, background 컬러 사용 */}
              <View className="p-[2px] bg-surface border-2 border-textPrimary rounded-full shadow-md">
                <Image
                  source={{ uri: item.img }}
                  className="w-[50px] h-[50px] rounded-full"
                />
              </View>
              {/* 꼬리 부분: 테일윈드 클래스로 구현 */}
              <View className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-textPrimary -mt-[2px]" />
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const createStyles = (theme: "light" | "dark") =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors[theme].background },
    map: { width: "100%", height: "100%" },
  });

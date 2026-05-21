import React, { useState } from "react";
import { View, Image } from "react-native";
// 📍 ui 폴더가 추가되었으므로 경로에 /ui를 추가해 줍니다!
import CustomMap, { Marker } from "@/components/ui/GoogleMap/map";

export default function MapScreen() {
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
    <View className="flex-1 bg-background">
      <CustomMap
        initialRegion={{
          latitude: 37.5665,
          longitude: 126.978,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {markers.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lon }}
            tracksViewChanges={true}
          >
            <View className="items-center w-[60px] h-[75px]">
              <View className="w-[56px] h-[56px] p-[2px] bg-surface border-2 border-primary rounded-full shadow-md items-center justify-center">
                <Image
                  source={{ uri: item.img }}
                  className="w-[48px] h-[48px] rounded-full"
                />
              </View>
              <View className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-primary -mt-[2px]" />
            </View>
          </Marker>
        ))}
      </CustomMap>
    </View>
  );
}

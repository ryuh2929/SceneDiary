import React, { useState, useRef } from "react";
import { Image, Platform, View, useWindowDimensions } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import SimpleView from "./simpleView";
import { getTripDays } from "@/api/map";
import { Days, Trip } from "@/types/api";
import { useFocusEffect } from "expo-router"; // 또는 @react-navigation/native

type PhotoMarkerProps = {
  item: Days;
  photoUrl?: string;
  onPress: () => void;
};

function PhotoMarker({ item, photoUrl, onPress }: PhotoMarkerProps) {
  const coordinate = {
    latitude: item.representative_lat || 0,
    longitude: item.representative_lon || 0,
  };
  const { width, height } = useWindowDimensions();
  const imageSize = Math.min(width * 0.2, 88);

  const [isLoaded, setIsLoaded] = useState(false);

  if (Platform.OS === "android") {
    // android버전
    return (
      <Marker coordinate={coordinate} pinColor="#5B7DBB" onPress={onPress} />

      // <Marker
      //   // 1. [핵심] 커스텀 뷰(자식 컴포넌트)를 모두 제거합니다.
      //   coordinate={coordinate}
      //   onPress={onPress}
      //   // 2. [가장 확실한 해결책] image 속성에 이미지 URL을 직접 넣습니다.
      //   // 팁: URI가 HTTP인 경우, 안드로이드는 보안 정책상 기본적으로 차단합니다. HTTPS를 사용하세요.
      //   image={{ uri: photoUrl, width: imageSize, height: imageSize }}
      //   // 3. [중요] 안드로이드 성능 최적화를 위해 tracksViewChanges를 끕니다.
      //   // 이제는 뷰가 아니라 이미지이므로 변경 사항을 추적할 필요가 없습니다.
      //   tracksViewChanges={false}
      //   // 4. [레이아웃 안정화] 마커의 중심점을 고정합니다.
      //   anchor={{ x: 0.5, y: 0.5 }}
      // ></Marker>
    );
  } else {
    // ios 버전
    return (
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 1 }}
        tracksViewChanges={!isLoaded}
        onPress={onPress}
      >
        <View
          style={{
            width: 64,
            height: 78,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: "#FFFFFF",
              borderWidth: 3,
              borderColor: "#5B7DBB",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              shadowColor: "#000000",
              shadowOpacity: 0.22,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                }}
                onLoad={() => setIsLoaded(true)}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#D8E2EA",
                }}
              />
            )}
          </View>

          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 9,
              borderRightWidth: 9,
              borderTopWidth: 14,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderTopColor: "#5B7DBB",
              marginTop: -2,
            }}
          />
        </View>
      </Marker>
    );
  }
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const [dayTripMarkers, setTripDayMarkers] = useState<Trip[]>([]);
  const [dayMarkers, setDayMarkers] = useState<Days[]>([]);
  const [selectedItem, setSelectedItem] = useState<Days | null>(null);

  // 1. 데이터 가져오는 로직을 별도 함수로 분리
  const fetchData = async () => {
    try {
      const data = await getTripDays();
      console.log("API 응답: ", JSON.stringify(data, null, 2));
      const allDays = data.flatMap((trip) => trip.tripDays);
      setDayMarkers(allDays);
    } catch (error) {
      console.error("데이터 불러오기 에러:", error);
    }
  };

  // 2. 화면에 들어올 때마다(Focus) 데이터 갱신
  useFocusEffect(
    React.useCallback(() => {
      fetchData(); // 데이터 새로고침
      return () => {
        /* 필요 시 정리 작업 */
      };
    }, []),
  );

  const handleMarkerPress = (item: Days) => {
    const latitude = item.representative_lat || 0;
    const longitude = item.representative_lon || 0;

    setSelectedItem(item);

    mapRef.current?.animateCamera(
      {
        center: {
          latitude,
          longitude,
        },
      },
      { duration: 200 }, // duration은 두 번째 인자로 넘겨야 합니다
    );
  };

  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 37.5665,
          longitude: 126.978,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {dayMarkers.map((item) => {
          const photo =
            item.photos?.find((p) => p.id === item.represent_image) ||
            item.photos?.[0];

          return (
            <PhotoMarker
              key={item.id}
              item={item}
              photoUrl={photo?.thumbnail_image_url}
              onPress={() => handleMarkerPress(item)}
            />
          );
        })}
      </MapView>

      {selectedItem && <SimpleView item={selectedItem} />}
    </View>
  );
}

import React, { useEffect, useState, useRef } from "react";
import { Image, Platform, View, useWindowDimensions } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import SimpleView from "./simpleView";
import { getTripDays } from "@/api/map";
import { Days } from "@/types/api";
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


   // 🎯 안드로이드용: 이미지가 로드된 후에도 아주 잠깐 더 렌더링을 허용하기 위한 상태
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // 🎯 안드로이드 핵심 로직: 로딩 완료 후 0.5초 정도 더 지켜본 뒤 추적을 끕니다.
  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        setTracksViewChanges(false);
      }, 500); // 500ms 정도 여유를 주면 안드로이드에서 이미지가 안정적으로 고정됩니다.
      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

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

      // <Marker
      //   coordinate={coordinate}
      //   anchor={{ x: 0.5, y: 0.5 }}
      //   onPress={onPress}
      //   // 🎯 변경된 상태값 사용
      //   tracksViewChanges={tracksViewChanges}
      // >
      //   <View
      //     style={{
      //       width: imageSize,
      //       height: imageSize,
      //       alignItems: "center",
      //       justifyContent: "center",
      //     }}
      //     // 🎯 안드로이드 뷰 최적화 방지
      //     collapsable={false}
      //   >
      //     <View
      //       style={{
      //         width: imageSize,
      //         height: imageSize,
      //         borderRadius: imageSize / 2,
      //         borderWidth: 3,
      //         borderColor: "#5B7DBB",
      //         backgroundColor: "#D8E2EA",
      //         overflow: "hidden", // 안드로이드 원형 자르기 필수
      //       }}
      //     >
      //       <Image
      //         source={{ uri: photoUrl }}
      //         style={{
      //           width: "100%",
      //           height: "100%",
      //         }}
      //         resizeMode="cover"
      //         // 🎯 onLoadEnd를 사용하면 성공/실패 상관없이 무한 렌더링을 막습니다.
      //         onLoadEnd={() => setIsLoaded(true)}
      //       />
      //     </View>
      //   </View>
      // </Marker>
      
      
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

  const [dayMarkers, setDayMarkers] = useState<Days[]>([]);
  const [selectedItem, setSelectedItem] = useState<Days | null>(null);

  // 1. 데이터 가져오는 로직을 별도 함수로 분리
  const fetchData = async () => {
    try {
      const data = await getTripDays();
      console.log("API 응답: ", JSON.stringify(data, null, 2));
      setDayMarkers(data);
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
    <View className="flex-1 bg-background">
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

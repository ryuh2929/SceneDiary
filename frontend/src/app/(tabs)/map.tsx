// src/app/(tabs)/map.tsx
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location"; // 🌍 위치 권한 패키지 가져오기

export default function MapScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 1️⃣ 스마트폰 시스템에 위치 권한 요청하기 (이미 허용되어 있다면 바로 통과)
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        // 2️⃣ 거부당했을 때 사용자에게 친절하게 안내하기
        Alert.alert(
          "위치 권한 필요",
          "지도에 표시하려면 설정에서 위치 권한을 허용해 주세요.",
        );
        setHasPermission(false);
      } else {
        setHasPermission(true);
      }
      setLoading(false);
    })();
  }, []);

  // 권한 체크 중일 때는 로딩 스피너를 보여줍니다
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

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
        // 3️⃣ 권한 상태에 따라 내 위치 기능을 켜고 끕니다 (거부 상태에서 true로 주면 크래시 방지)
        showsUserLocation={hasPermission === true}
        showsMyLocationButton={hasPermission === true}
        rotateEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
});

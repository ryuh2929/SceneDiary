// ─────────────────────────────────────────────────────────────────────────
// 여행지 선택 지도 피커 (앱 전용)
//
// [이 부품이 하는 일]
//   일기 화면의 "여행지" 칸을 누르면 이 피커가 화면을 덮으며 떠서,
//   사용자가 지도에서 위치를 고르게 합니다. 고른 좌표를 "지명 글자"로 바꿔
//   일기 화면에 돌려주면(onSelect) 끝입니다.
//
// [위치를 고르는 두 가지 방법]
//   ① 지도를 손가락으로 탭 → 그 자리에 핀이 놓임
//   ② "현재 위치" 버튼 → 휴대폰 GPS로 내 위치를 잡아 지도를 그쪽으로 이동
//
// [native 전용]
//   react-native-maps 지도는 앱에서만 동작합니다. 웹에서는 이 파일 대신
//   LocationPicker.web.tsx(안내 모달)가 자동으로 쓰입니다.
//   (Expo가 웹이면 .web.tsx, 앱이면 .tsx 를 알아서 골라줍니다.)
// ─────────────────────────────────────────────────────────────────────────
import * as Location from "expo-location"; // 위치 권한·GPS·좌표→지명 변환
import {LocateFixed, MapPin, X} from "lucide-react-native"; // 아이콘
import React, {useEffect, useRef, useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from "react-native";
import MapView, {Marker, PROVIDER_GOOGLE} from "react-native-maps"; // 구글 지도
import {useSafeAreaInsets} from "react-native-safe-area-context"; // 노치/홈바 여백

// 지도 초기 중심(서울) — 기존 지도 탭과 동일한 시작 위치.
const SEOUL = {latitude: 37.5665, longitude: 126.978};
// 지도 확대 정도(델타가 작을수록 더 확대). 위/경도 한 화면에 보이는 폭.
const DELTA = {latitudeDelta: 0.0922, longitudeDelta: 0.0421};

// 위도·경도 한 쌍. 지도에서 고른 한 지점을 나타냅니다.
type Coord = {latitude: number; longitude: number};

// 이 부품이 바깥(일기 화면)에서 받는 값들 = "props".
//   visible  : 지금 열려 있니? (true면 화면에 보임)
//   onClose  : "그냥 닫고 싶을 때" 바깥에게 알리는 함수 (X 버튼)
//   onSelect : "위치를 다 골랐을 때" 지명 + 좌표를 바깥에게 건네는 함수
//              → 식당 비유: 주문(열기) 후 "음식 나왔어요"라고 번호 부르는 것과 같음.
//              지명만 보낸 게 예전 방식. 지금은 좌표(lat/lon)도 함께 보내서
//              DB의 trip_days.representative_lat/lon 에도 저장될 수 있게 함.
type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (placeName: string, lat: number, lon: number) => void;
};

// reverseGeocode(좌표→주소) 결과를 사람이 읽기 좋은 짧은 지명 한 줄로 다듬습니다.
//   예) {region:"서울특별시", city:"중구", ...} → "서울특별시 중구"
//   주소를 못 얻으면(권한 거부 등) 그냥 좌표를 글자로 넣는 안전장치(폴백)로 둡니다.
function toPlaceName(
  a: Location.LocationGeocodedAddress | undefined,
  c: Coord,
): string {
  if (a) {
    // 큰 단위→작은 단위 순서로 모아서, 빈 값은 빼고, 중복은 제거해 합칩니다.
    const parts = [a.region, a.city, a.district, a.street ?? a.name].filter(
      Boolean,
    );
    const name = Array.from(new Set(parts)).join(" ").trim();
    if (name) return name;
    if (a.formattedAddress) return a.formattedAddress; // 그래도 비면 전체 주소
  }
  // 주소 자체를 못 얻었을 때의 최후 폴백: 좌표를 그대로 표시.
  return `위치 (${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)})`;
}

export default function LocationPicker({visible, onClose, onSelect}: Props) {
  const insets = useSafeAreaInsets(); // 상단 노치/하단 홈바만큼 여백 확보
  // 지도를 코드로 움직이려면(예: 현재 위치로 이동) 지도에 대한 "리모컨"이 필요합니다.
  // useRef 가 그 리모컨 역할 — mapRef.current 로 지도 명령을 호출합니다.
  const mapRef = useRef<MapView>(null);
  // 사용자가 지금까지 고른 지점. 아직 안 골랐으면 null(=핀 없음).
  const [picked, setPicked] = useState<Coord | null>(null);
  // 현재 위치 잡기 / 지명 변환처럼 "잠깐 기다리는 중"인지. true면 버튼에 스피너.
  const [busy, setBusy] = useState(false);

  // 피커가 새로 열릴 때마다 이전에 찍었던 핀을 지웁니다(다른 날에 다시 열 때 깨끗하게).
  useEffect(() => {
    if (visible) setPicked(null);
  }, [visible]);

  // 안 열려 있으면 아무것도 그리지 않음(화면에서 사라짐).
  // ※ useState/useEffect 같은 훅은 위에서 항상 먼저 실행되므로 규칙 위반 아님.
  if (!visible) return null;

  // [현재 위치] 권한을 물어보고, 허락하면 GPS 좌표를 받아 핀+지도를 그쪽으로 옮깁니다.
  const useCurrentLocation = async () => {
    setBusy(true);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return; // 거부해도 OK — 지도 탭으로 고르면 됨
      const pos = await Location.getCurrentPositionAsync({});
      const c = {latitude: pos.coords.latitude, longitude: pos.coords.longitude};
      setPicked(c); // 핀 표시
      mapRef.current?.animateToRegion({...c, ...DELTA}, 500); // 지도 카메라 이동(0.5초)
    } catch (e) {
      console.error("현재 위치 가져오기 실패:", e);
    } finally {
      setBusy(false); // 성공/실패 무관하게 대기 상태 해제
    }
  };

  // [이 위치로 선택] 고른 좌표를 지명으로 바꿔 onSelect 로 바깥에 건넵니다.
  const confirm = async () => {
    if (!picked) return; // 아직 안 골랐으면 무시
    setBusy(true);
    try {
      // Android는 좌표→주소 변환에도 위치 권한이 필요 → 없으면 요청(이미 있으면 즉시 통과).
      await Location.requestForegroundPermissionsAsync();
      let address: Location.LocationGeocodedAddress | undefined;
      try {
        // 좌표 → 주소 목록. 보통 첫 번째[0]가 가장 구체적입니다.
        address = (await Location.reverseGeocodeAsync(picked))[0];
      } catch (e) {
        // 변환 실패해도 멈추지 않고, 아래 toPlaceName 이 좌표로 폴백합니다.
        console.error("지오코딩 실패(좌표로 대체):", e);
      }
      // ★ 결과를 일기 화면에 전달 (지명 + 좌표).
      // picked 는 사용자가 지도에서 고른 정확한 좌표 — DB에 그대로 저장됨.
      onSelect(toPlaceName(address, picked), picked.latitude, picked.longitude);
    } finally {
      setBusy(false);
    }
  };

  return (
    // 화면 전체를 덮는 오버레이.
    //   absoluteFill = 부모 화면을 꽉 채움. zIndex/elevation 50 = 하단 버튼 등 위로 올라옴.
    <View
      style={[StyleSheet.absoluteFill, {zIndex: 50, elevation: 50}]}
      className="bg-surface"
    >
      {/* ===== 헤더: 제목 + 닫기(X) ===== */}
      <View style={{paddingTop: insets.top}} className="bg-surface">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="text-base font-bold text-textPrimary">여행지 선택</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color="#39536B" />
          </Pressable>
        </View>
      </View>

      {/* ===== 지도 영역 ===== */}
      <View className="flex-1">
        <MapView
          ref={mapRef} // 위의 "리모컨"을 이 지도에 연결
          provider={PROVIDER_GOOGLE} // 구글 지도 사용(키는 app.json에 설정됨)
          style={{flex: 1}}
          initialRegion={{...SEOUL, ...DELTA}} // 처음엔 서울 중심
          onPress={(e) => setPicked(e.nativeEvent.coordinate)} // 탭한 좌표에 핀
        >
          {picked && <Marker coordinate={picked} />}{/* 고른 곳에만 핀 표시 */}
        </MapView>

        {/* 현재 위치 버튼 (지도 위에 떠 있음) */}
        <Pressable
          onPress={useCurrentLocation}
          className="absolute right-4 top-4 flex-row items-center gap-1 rounded-full bg-surface px-3 py-2 shadow-md"
        >
          <LocateFixed size={16} color="#5B7DBB" />
          <Text className="text-sm font-medium text-primary">현재 위치</Text>
        </Pressable>

        {/* 아직 안 골랐을 때만 보이는 첫 안내 문구 */}
        {!picked && (
          <View className="absolute left-4 top-4 rounded-lg bg-surface px-3 py-2 shadow-md">
            <Text className="text-xs text-textSecondary">
              지도를 탭해 여행지를 선택하세요
            </Text>
          </View>
        )}
      </View>

      {/* ===== 하단 확인 바 ===== */}
      <View
        style={{paddingBottom: insets.bottom + 12}}
        className="border-t border-border bg-surface px-5 pt-3"
      >
        <Pressable
          onPress={confirm}
          // 아직 안 골랐거나 처리 중이면 누를 수 없게(색도 흐리게).
          disabled={!picked || busy}
          className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 ${
            picked && !busy ? "bg-primary" : "bg-muted"
          }`}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" /> // 처리 중엔 스피너
          ) : (
            <>
              <MapPin size={18} color="#FFFFFF" />
              <Text className="font-bold text-textOnPrimary">
                {picked ? "이 위치로 선택" : "위치를 먼저 선택하세요"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

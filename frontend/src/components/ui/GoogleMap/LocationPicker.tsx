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
import {LocateFixed, MapPin, Search, X} from "lucide-react-native"; // 아이콘
import React, {useEffect, useRef, useState} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, {Marker, PROVIDER_GOOGLE} from "react-native-maps"; // 구글 지도
import {useSafeAreaInsets} from "react-native-safe-area-context"; // 노치/홈바 여백
import {useAppThemeColors} from "@/constants/app-colors";

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
  // reverseGeocode 결과에서 뽑아낸 국가/도시도 함께 넘깁니다.
  // 백엔드가 trip.destination 이 비어있을 때 "국가/도시" 형식으로 자동 채우는 데 사용.
  // 좌표만 있고 reverseGeocode 가 실패하면 country/city 는 undefined.
  onSelect: (
    placeName: string,
    lat: number,
    lon: number,
    context?: {countryName?: string; cityName?: string},
  ) => void;
  // 그 날에 이미 검출된 좌표(사진 EXIF/이전 선택). 있으면 피커를 열 때 이 위치에 핀을 박고
  // 카메라도 그쪽으로 이동합니다. null/undefined(위치 없는 날)면 현재 위치를 기본 핀으로 잡습니다.
  // 객체가 아닌 원시값으로 받아 useEffect 의존성을 안정적으로 유지합니다.
  initialLat?: number | null;
  initialLon?: number | null;
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

export default function LocationPicker({
  visible,
  onClose,
  onSelect,
  initialLat,
  initialLon,
}: Props) {
  const insets = useSafeAreaInsets(); // 상단 노치/하단 홈바만큼 여백 확보
  const colors = useAppThemeColors(); // 전역 다크모드에 맞춰 아이콘 색상을 바꿉니다.
  // 지도를 코드로 움직이려면(예: 현재 위치로 이동) 지도에 대한 "리모컨"이 필요합니다.
  // useRef 가 그 리모컨 역할 — mapRef.current 로 지도 명령을 호출합니다.
  const mapRef = useRef<MapView>(null);
  // 사용자가 지금까지 고른 지점. 아직 안 골랐으면 null(=핀 없음).
  const [picked, setPicked] = useState<Coord | null>(null);
  // 현재 위치 잡기 / 지명 변환처럼 "잠깐 기다리는 중"인지. true면 버튼에 스피너.
  const [busy, setBusy] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // 지도가 실제로 그려질 준비가 됐는지. 피커를 닫으면 MapView 가 언마운트되고 다시 열면
  // 새로 마운트되므로, 매 열기마다 false 로 리셋하고 onMapReady 에서 true 로 바꿉니다.
  const mapReadyRef = useRef(false);
  // 카메라를 옮기고 싶은 목표 좌표. 지도가 아직 준비 전이면 여기에 담아뒀다가
  // onMapReady 시점에 옮깁니다. (준비 전 animateToRegion 호출이 조용히 무시되는 회귀 회피)
  const targetRef = useRef<Coord | null>(null);

  // 카메라 이동 요청. 지도가 준비됐으면 즉시 이동, 아니면 목표만 저장 → onMapReady 가 처리.
  const centerOn = (c: Coord) => {
    targetRef.current = c;
    if (mapReadyRef.current) {
      mapRef.current?.animateToRegion({...c, ...DELTA}, 0);
    }
  };

  // 지도 준비 완료 → 대기 중인 목표가 있으면 그때 이동.
  const handleMapReady = () => {
    mapReadyRef.current = true;
    if (targetRef.current) {
      mapRef.current?.animateToRegion({...targetRef.current, ...DELTA}, 0);
    }
  };

  // 피커를 열 때 초기 핀/카메라를 잡습니다.
  //  ① 그 날에 이미 좌표가 있으면(위치 있는 날) → 그 좌표에 핀을 박고 카메라도 그쪽으로.
  //     (사진 EXIF/이전 선택으로 검출된 여행지를 지도에 그대로 보여줘야 함 — 요구사항 1)
  //  ② 좌표가 없으면(직접 선택하는 날) → 기기 현재 위치를 기본 핀으로 (요구사항 3).
  //     권한 거부 / GPS 실패 시엔 기본 시작 위치(SEOUL)에서 핀 없이 시작.
  useEffect(() => {
    if (!visible) return;
    // 새로 열 때마다 MapView 가 재마운트되므로 준비상태/목표를 초기화.
    mapReadyRef.current = false;
    targetRef.current = null;

    // ① 위치 있는 날: 검출된 좌표를 그대로 핀으로.
    if (initialLat != null && initialLon != null) {
      const c = {latitude: initialLat, longitude: initialLon};
      setPicked(c);
      centerOn(c);
      return;
    }

    // ② 위치 없는 날: 이전 핀을 지우고 현재 위치를 기본으로 잡습니다.
    setPicked(null);
    (async () => {
      try {
        const {status} = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({});
        const c = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setPicked(c); // 핀 미리 박기 → 하단 "이 위치로 선택" 즉시 활성화
        centerOn(c); // 지도 준비 여부와 무관하게 안전하게 이동(준비 전이면 onMapReady 가 처리)
      } catch (e) {
        console.error("초기 위치 설정 실패:", e);
      }
    })();
  }, [visible, initialLat, initialLon]);

  // 안 열려 있으면 아무것도 그리지 않음(화면에서 사라짐).
  // ※ react-native-maps 의 MapView 는 Modal 안에서 Google Maps API key 인식이 실패하는
  //   안드로이드 회귀가 있어, overlay(absoluteFill) 방식으로 유지합니다.
  if (!visible) return null;

  // [현재 위치] 권한을 물어보고, 허락하면 GPS 좌표를 받아 핀+지도를 그쪽으로 옮깁니다.
  const useCurrentLocation = async () => {
    setBusy(true);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return; // 거부해도 OK — 지도 탭으로 고르면 됨
      const pos = await Location.getCurrentPositionAsync({});
      const c = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setPicked(c); // 핀 표시
      mapRef.current?.animateToRegion({...c, ...DELTA}, 500); // 지도 카메라 이동(0.5초)
    } catch (e) {
      console.error("현재 위치 가져오기 실패:", e);
    } finally {
      setBusy(false); // 성공/실패 무관하게 대기 상태 해제
    }
  };

  // [장소 검색] 검색어 → OS 지오코딩 → 첫 번째 결과로 핀 + 지도 이동.
  // useCurrentLocation 과 같은 모양 — GPS 대신 검색어로 좌표를 얻는 것만 다릅니다.
  const searchLocation = async () => {
    const query = searchQuery.trim();
    if (!query) return; // 빈 검색어는 무시
    setIsSearching(true);
    try {
      const results = await Location.geocodeAsync(query);
      const first = results[0];
      if (!first) {
        // 결과 없으면 조용히 종료 (검색바에 안내는 추후 작업으로)
        return;
      }
      const c = {latitude: first.latitude, longitude: first.longitude};
      setPicked(c); // 핀 표시
      mapRef.current?.animateToRegion({...c, ...DELTA}, 500); // 지도 카메라 이동
    } catch (e) {
      console.error("위치 검색 실패:", e);
    } finally {
      setIsSearching(false);
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
      // ★ 결과를 일기 화면에 전달 (지명 + 좌표 + 국가/도시).
      // picked 는 사용자가 지도에서 고른 정확한 좌표 — DB에 그대로 저장됨.
      // country/city 는 add.tsx 의 자동 추출과 같은 의미 — trip.destination 자동 보강용.
      const countryName = address?.country || undefined;
      const cityName = address?.city || address?.region || undefined;
      onSelect(
        toPlaceName(address, picked),
        picked.latitude,
        picked.longitude,
        {countryName, cityName},
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    // 화면 전체를 덮는 오버레이.
    //   absoluteFill = 부모 화면을 꽉 채움. zIndex/elevation 50 = 하단 버튼 등 위로 올라옴.
    //   Modal 대신 이 방식을 쓰는 이유: react-native-maps + Modal 조합이 안드로이드에서
    //   "Google Maps API key not found" 에러를 내는 회귀가 있음.
    <View
      style={[StyleSheet.absoluteFill, {zIndex: 50, elevation: 50}]}
      className="bg-surface dark:bg-dark-surface"
    >
      {/* ===== 헤더: 제목 + 닫기(X) ===== */}
      <View
        style={{paddingTop: insets.top}}
        className="bg-surface dark:bg-dark-surface"
      >
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3 dark:border-dark-border">
          <Text className="text-base font-sans-bold text-textPrimary dark:text-dark-textPrimary">
            여행지 선택
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* ===== 검색바: 입력창 + 검색 버튼 ===== */}
      <View className="border-b border-border bg-surface px-4 py-2">
        <View className="flex-row items-center gap-2 rounded-full bg-background px-4 py-2">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="장소를 검색하세요"
            placeholderTextColor="#A9C3E6"
            onSubmitEditing={searchLocation} // 키보드 검색 키로도 실행
            returnKeyType="search"
            className="flex-1 text-textPrimary"
          />
          <Pressable
            onPress={searchLocation}
            disabled={isSearching || !searchQuery.trim()}
            hitSlop={8}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#5B7DBB" />
            ) : (
              <Search
                size={18}
                color={searchQuery.trim() ? "#5B7DBB" : "#A9C3E6"}
              />
            )}
          </Pressable>
        </View>
      </View>

      {/* ===== 지도 영역 ===== */}
      <View className="flex-1">
        <MapView
          ref={mapRef} // 위의 "리모컨"을 이 지도에 연결
          provider={PROVIDER_GOOGLE} // 구글 지도 사용(키는 app.json에 설정됨)
          style={{flex: 1}}
          // 위치 있는 날은 그 좌표를, 없으면 서울을 중심으로 마운트(이후 effect 가 현재 위치로 이동).
          initialRegion={{
            latitude: initialLat ?? SEOUL.latitude,
            longitude: initialLon ?? SEOUL.longitude,
            ...DELTA,
          }}
          onMapReady={handleMapReady} // 지도 준비 완료 시 대기 중인 목표로 카메라 이동
          onPress={(e) => setPicked(e.nativeEvent.coordinate)} // 탭한 좌표에 핀
        >
          {picked && <Marker coordinate={picked} />}
          {/* 고른 곳에만 핀 표시 */}
        </MapView>

        {/* 현재 위치 버튼 (지도 위에 떠 있음) */}
        <Pressable
          onPress={useCurrentLocation}
          className="absolute right-4 top-4 flex-row items-center gap-1 rounded-full bg-surface px-3 py-2 shadow-md dark:bg-dark-surface"
        >
          <LocateFixed size={16} color={colors.primary} />
          <Text className="text-sm font-medium text-primary">현재 위치</Text>
        </Pressable>

        {/* 아직 안 골랐을 때만 보이는 첫 안내 문구 */}
        {!picked && (
          <View className="absolute left-4 top-4 rounded-lg bg-surface px-3 py-2 shadow-md dark:bg-dark-surface">
            <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">
              지도를 탭해 여행지를 선택하세요
            </Text>
          </View>
        )}
      </View>

      {/* ===== 하단 확인 바 ===== */}
      <View
        style={{paddingBottom: insets.bottom + 12}}
        className="border-t border-border bg-surface px-5 pt-3 dark:border-dark-border dark:bg-dark-surface"
      >
        <Pressable
          onPress={confirm}
          // 아직 안 골랐거나 처리 중이면 누를 수 없게(색도 흐리게).
          disabled={!picked || busy}
          className={`flex-row items-center justify-center gap-2 rounded-2xl py-4 ${
            picked && !busy ? "bg-primary" : "bg-muted dark:bg-dark-muted"
          }`}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" /> // 처리 중엔 스피너
          ) : (
            <>
              <MapPin size={18} color="#FFFFFF" />
              <Text className="font-sans-bold text-textOnPrimary">
                {picked ? "이 위치로 선택" : "위치를 먼저 선택하세요"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

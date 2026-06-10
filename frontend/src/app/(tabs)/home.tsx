import React, { useState,useMemo } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  Plus,
} from "lucide-react-native";
import Twemoji from "react-native-twemoji";
import { DarkModeBackground } from "@/components/dark-mode-background";
import { getTrips} from "@/api/home";
import { Trip } from "@/types/api";
import { useAppThemeColors } from "@/constants/app-colors";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useUserStore } from "@/data/userStore";


// ─────────────────────────────────────────────
// 🔧 유틸 함수 섹션
// ─────────────────────────────────────────────

/**
 * 이모지 코드포인트(hex 문자열)를 실제 이모지 문자로 변환합니다.
 * 예: "1f5fc" -> 타워 이모지, "1f1f0-1f1f7" -> 국기 이모지
 */
function codepointToEmoji(codepoint: string): string {
  return codepoint
    .split("-")
    .map((cp) => String.fromCodePoint(parseInt(cp, 16)))
    .join("");
}

/**
 * 서버에서 내려온 이모지 코드포인트를 Twemoji 이미지로 보여줍니다.
 * Twemoji가 지원하지 않는 경우에는 기기 기본 이모지로 표시합니다.
 */
function EmojiIcon({ codepoint, size }: { codepoint: string; size: number }) {
  if (!codepoint) return null;

  const char = codepointToEmoji(codepoint);

  if (Twemoji.supportedEmojis.includes(char)) {
    return <Twemoji style={{ width: size, height: size }}>{char}</Twemoji>;
  }

  return <Text style={{ fontSize: size }}>{char}</Text>;
}

/**
 * 여행 카드에 보여줄 대표 사진을 찾습니다.
 * cover_photo_id와 일치하는 사진이 없으면 이미지를 렌더링하지 않습니다.
 */
export function getMainImage(item: Trip) {
  const allPhotos = item.tripDays.flatMap((day) => day.photos || []);
  const coverPhoto = allPhotos.find(
    (photo) => photo.id === item.cover_photo_id,
  );

  if (!coverPhoto?.image_url) return null;

  return (
    <Image
      source={{ uri: coverPhoto.image_url }}
      className="w-full h-full"
      resizeMode="cover"
    />
  );
}

/**
 * 홈 화면입니다.
 * 여행 데이터가 많아져도 화면에 보이는 카드 위주로 렌더링되도록 FlatList를 사용합니다.
 */
export default function HomeScreen() {
  const router = useRouter();
  const colors = useAppThemeColors();
  const { isDarkMode } = useAppSettings();

  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tripData, setTripData] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 🎯 핵심 꼼수: 데이터가 존재한다고 '확인된' 연도들을 기록해둘 상자입니다.
  // 진입할 때의 2026년은 기본적으로 포함해 둡니다
  const [hasDataYears, setHasDataYears] = useState<number[]>([2026]);

  /**
   * 현재 선택된 연도의 여행 목록을 서버에서 불러옵니다.
   * 화면에 다시 진입하거나 연도가 바뀔 때마다 최신 데이터를 반영합니다.
   */
  //1. Zustand 스토어에서 userProfile의 변경 사항을 실시간으로 감시
  const userProfile = useUserStore((state) => state.userProfile);
  const loadTripData = async () => {
    // 🌟 [안전장치] 혹시라도 userId가 없으면 즉시 종료
    if (!userProfile?.userId|| currentYear === null) return;
    try {
      setIsLoading(true); // 로딩 시작
      setError(null); // 이전 에러 초기화
      setTripData([]); // 이전 데이터 초기화

      const data = await getTrips(currentYear, userProfile?.userId);
      // console.log("API 응답 데이터:", JSON.stringify(data, null, 2));
      console.log("데이터 불러옴");
      
      //받아온 전체 데이터 중, 실제 start_date의 연도가 currentYear와 일치하는 것만
      const filteredData = data.filter(item => {
      return new Date(item.start_date).getFullYear() === currentYear;
    });
      setTripData(filteredData); // 필터링된 진짜 해당 연도 데이터만 화면 리스트에 세팅

      // [화살표 잠금 연동]: 데이터가 '진짜로 존재하는 연도들'을 수집할 때도 
      // filteredData가 아니라 원본 data(전체 데이터)를 활용하면 유저가 작성한 모든 연도가 자동으로 수집
      if (data && data.length > 0) {
      const allYears = data.map(item => new Date(item.start_date).getFullYear());
      setHasDataYears(Array.from(new Set(allYears))); // ex) [2025, 2026]이 자동으로 들어감!
    }
    } catch (err: any) {
      setTripData([]);
      console.log("API 에러 전체:", err);
      console.log("API 에러 메시지:", err?.message);
      console.log("API 에러 응답:", err?.response?.status, err?.response?.data);
      setError("여행 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false); // 성공/실패 관계없이 로딩 종료
    }
  };

  // 2. 화면에 들어올 때마다(Focus) 데이터 갱신
  useFocusEffect(
    React.useCallback(() => {
      //userProfile과 userId가 확실히 존재할 때만 API 호출
      if (userProfile?.userId) {
        loadTripData(); // 데이터 새로고침
      }
      return () => {
        /* 필요 시 정리 작업 */
      };
    }, [currentYear, userProfile]), //의존성 배열에 userProfile을 반드시 추가해야 값이 들어온 순간 반응
    
  );

  // ─────────────────────────────────────────────
  // ⚙️ 화살표 제어 및 연도 건너뛰기(Jump) 계산 구역
  // ─────────────────────────────────────────────
  
  // 1. 유효한 연도 목록을 오름차순으로 정렬합니다 (예: [2016, 2025, 2026])
  const sortedAvailableYears = [...hasDataYears].sort((a, b) => a - b);

  // 2. 현재 선택된 연도가 이 배열에서 몇 번째 칸(Index)에 있는지 찾습니다.
  const currentIdx = sortedAvailableYears.indexOf(currentYear);

  // 3. 왼쪽(이전), 오른쪽(다음) 화살표 잠금 조건 설정
  // 배열의 맨 첫 칸이거나 배열에 존재하지 않으면 왼쪽 잠금
  const isLeftDisabled = currentIdx <= 0 || currentIdx === -1;
  // 배열의 맨 마지막 칸이거나 배열에 존재하지 않으면 오른쪽 잠금
  const isRightDisabled = currentIdx >= sortedAvailableYears.length - 1 || currentIdx === -1;

  // 4. 껑충껑충 건너뛰는 화살표 핸들러 함수
  const handlePrevYear = () => {
    if (!isLeftDisabled) {
      setCurrentYear(sortedAvailableYears[currentIdx - 1]);
    }
  };

  const handleNextYear = () => {
    if (!isRightDisabled) {
      setCurrentYear(sortedAvailableYears[currentIdx + 1]);
    }
  };
  // ─────────────────────────────────────────────
  // 🔀 아코디언 토글 핸들러
  // ─────────────────────────────────────────────

  /**
   * 여행 카드 상세 영역을 펼치거나 접습니다.
   * 이미 열린 카드를 다시 누르면 닫히고, 다른 카드를 누르면 해당 카드만 열립니다.
   */
  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

 
  // 🌟 4. [기다리기 처리] 유저 ID가 아직 안 들어왔다면 화면 자체를 홀딩합니다.
  if (!userProfile?.userId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10 }}>유저 정보를 불러오는 중...</Text>
      </View>
    );
  }

  

  // ─────────────────────────────────────────────
  // 🖥️ UI 렌더링
  // ─────────────────────────────────────────────
  return (
    <View className="flex-1 bg-background dark:bg-dark-background">
      {isDarkMode ? <DarkModeBackground /> : null}

      <View className="bg-surface pt-safe pb-md items-center border-b border-border shadow-sm dark:border-dark-border dark:bg-dark-surface">
        <Text className="text-xl font-logo text-logo mt-sm">SceneDiary</Text>

      {!isLoading && sortedAvailableYears.length > 0 && (
        <View className="flex-row items-center justify-center gap-xl mt-md">
          <Pressable
            // onPress={() => setCurrentYear((prev) => prev - 1)}
            onPress={handlePrevYear}
            className="p-xs"
            disabled={isLeftDisabled}
            style={{
              // 잠겼을 때는 25% 투명도로 흐리게 만들고, 누를 수 있을 때는 100%(1) 쨍하게 만듭니다.
              opacity: isLeftDisabled ? 0.25 : 1
            }}
          >
            <ChevronLeft size={20} color={colors.textSecondary} />
          </Pressable>

          <Text className="text-lg text-textPrimary font-sans-bold dark:text-dark-textPrimary">
            {currentYear}
          </Text>

        <Pressable
          // onPress={() => setCurrentYear((prev) => prev + 1)}
          onPress={handleNextYear}
          className="p-xs"
          // 🎯 앞서 계산한 최대 연도 조건(isRightDisabled)을 여기에 대입합니다.
          disabled={isRightDisabled}
          style={{
            opacity: isRightDisabled ? 0.25 : 1
          }}
        >
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
           )}
      </View>
       
      <FlatList
        className="flex-1"
        data={tripData}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-md mt-lg mb-md gap-lg"
        contentContainerStyle={{ paddingBottom: 180 }}
        renderItem={({ item }) => {
          const isExpanded = expandedId === item.id;

          return (
            <View
              className="bg-surface rounded-lg overflow-hidden border border-border dark:border-dark-border dark:bg-dark-surface shadow-sm shadow-black/10 dark:shadow-none"
              style={{
                // 안드로이드는 className 그림자만으로 부족할 수 있어 elevation을 함께 지정합니다.
                elevation: 3,
                shadowColor: colors.textPrimary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
              }}
            >
              <Pressable
                className="relative h-60 w-full"
                onPress={() =>
                  router.push({
                    pathname: "/detail",
                    params: {
                      id: item.id,
                      title: item.title,
                      location: item.destination,
                      mainImage: item.cover_photo_id,
                      startDate: item.start_date,
                      endDate: item.end_date,
                      details: JSON.stringify(item.tripDays),
                    },
                  })
                }
              >
                {getMainImage(item)}

                <View className="absolute top-md left-md bg-muted rounded-md px-sm py-xs items-center shadow-sm dark:bg-dark-muted">
                  <Text className="text-sm font-sans text-textPrimary dark:text-dark-textPrimary">
                    {item.start_date} ~ {item.end_date}
                  </Text>
                </View>

                <View className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/70 items-center justify-center overflow-hidden">
                  <EmojiIcon codepoint={item.flag || "1f1f0-1f1f7"} size={26} />
                </View>
              </Pressable>

              <View className="p-md">
                <Text className="text-lg font-sans-bold text-textPrimary mb-xs dark:text-dark-textPrimary">
                  {item.title}
                </Text>

                <View className="flex-row items-center gap-xs">
                  <MapPin size={12} color={colors.textSecondary} />
                  <Text className="text-sm text-textSecondary font-sans dark:text-dark-textSecondary">
                    {item.destination}
                  </Text>
                </View>
              </View>

              {item.tripDays?.length > 0 && (
                <Pressable
                  onPress={() => toggleExpand(item.id)}
                  className={
                    "w-full flex-row items-center justify-center py-sm gap-xs border-t border-border dark:border-dark-border " +
                    (isExpanded
                      ? "bg-muted dark:bg-dark-muted"
                      : "bg-surface dark:bg-dark-surface")
                  }
                >
                  <Text className="text-sm text-primary font-sans">
                    {isExpanded
                      ? "접기"
                      : `여행 상세 (${item.tripDays.length}일)`}
                  </Text>

                  <ChevronDown
                    size={14}
                    color={colors.primary}
                    style={{
                      transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
                      marginLeft: 2,
                    }}
                  />
                </Pressable>
              )}

              {isExpanded && (
                <View className="bg-muted px-md pb-md pt-sm gap-sm dark:bg-dark-muted">
                  {item.tripDays.map((detail) => (
                    <Pressable
                      key={detail.id}
                      className="flex-row items-center bg-surface p-sm rounded-md shadow-sm dark:bg-dark-surface"
                      onPress={() =>
                        router.push({
                          pathname: "/detail",
                          params: {
                            id: item.id,
                            title: detail.subtitle,
                            location: detail.location_summary,
                            mainImage: detail.represent_image,
                            startDate: item.start_date,
                            endDate: item.end_date,
                            day: detail.day_number,
                            details: JSON.stringify(item.tripDays),
                          },
                        })
                      }
                    >
                      {detail.photos && detail.photos.length > 0 && (
                        <Image
                          source={{
                            uri: detail.photos[0].thumbnail_image_url,
                          }}
                          className="w-14 h-14 rounded-md mr-md"
                          resizeMode="cover"
                        />
                      )}

                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-xs w-full pr-sm">
                          <Text className="text-sm text-primary font-sans-bold">
                            Day {detail.day_number}
                          </Text>

                          <View
                            style={{
                              width: 28,
                              height: 28,
                              flexDirection: "row",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            {detail.emotion && (
                              <EmojiIcon codepoint={detail.emotion} size={20} />
                            )}
                          </View>
                        </View>

                        <Text
                          className="text-md text-textPrimary font-sans-bold mb-xs dark:text-dark-textPrimary"
                          numberOfLines={1}
                        >
                          {detail.subtitle}
                        </Text>

                        <View className="flex-row items-center gap-xs">
                          <MapPin size={10} color={colors.textSecondary} />
                          <Text className="text-sm text-textSecondary font-sans dark:text-dark-textSecondary">
                            {detail.location_summary}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />

      <Pressable
        onPress={() =>
          router.push({ pathname: "/add", params: { path: "home" } })
        }
        className="absolute right-md bg-fab w-14 h-14 rounded-full items-center justify-center shadow-lg"
        style={{ zIndex: 99, bottom: 125 }}
      >
        <Plus size={32} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

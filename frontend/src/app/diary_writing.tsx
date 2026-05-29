// 일기 작성/검토 화면 (읽기 전용 멀티데이 뷰어)
//
// [2단계] AI가 하루치씩 생성한 일기를, 사용자가 하루씩 순서대로 검토하는 화면입니다.
//   - 순방향 일방통행: 뒤로가기·자유이동·작성중단 없음.
//   - 대부분 읽기 전용. 유일한 편집 = 여행지(location_summary, 지도 피커 — 아직 stub).
//   - "다음날로"로 진행, 마지막 날에서 "저장하기" → (3단계에서) Detail 이동.
//   - 데이터는 백엔드 API(api/diary)에서 받아옴. genStatus는 폴링으로 갱신.
//   - 색/폰트는 다른 페이지와 동일한 팀 디자인 토큰(primary, textPrimary, font-sans).

import {Image} from "expo-image";
import {useRouter} from "expo-router";
import {
  Calendar,
  ChevronRight,
  FileText,
  MapPin,
  RotateCcw,
} from "lucide-react-native";
import React, {useCallback, useEffect, useState} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import Twemoji from "react-native-twemoji";

import type {DayPage, TripDiary} from "@/types/diary_writing";
import {
  fetchTripDiary,
  fetchDayStatuses,
  fetchTripDay,
  saveDayLocation,
  regenerateDay,
  completeTrip,
} from "@/api/diary";
import LocationPicker from "@/components/ui/GoogleMap/LocationPicker";

// 디자인 토큰(색상). 아이콘 색처럼 className으로 주기 번거로운 곳에 hex로 직접 씁니다.
// 값은 tailwind.config.js의 팀 색상과 동일합니다. (settings 화면과 같은 방식)
const colors = {
  textPrimary: "#152538", // 제목·본문 등 진한 글자
  textSecondary: "#39536B", // 라벨·보조 글자
  primary: "#5B7DBB", // 메인 포인트(버튼·아이콘)
  primaryLight: "#A9C3E6", // 흐린 글자·비활성
};

// "YYYY-MM-DD" → "YYYY.MM.DD (요일)". (목업의 날짜 표기와 동일)
// new Date(연, 월-1, 일) 로 만들어 시간대(UTC) 때문에 날짜가 밀리는 문제를 피합니다.
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${dateStr.replace(/-/g, ".")} (${weekday})`;
}

// Twemoji 코드포인트(hex) → 실제 이모지 문자. 예: "1f5fc"→🗼, "1f1f0-1f1f7"→🇰🇷
function codepointToEmoji(codepoint: string): string {
  return codepoint
    .split("-")
    .map((cp) => String.fromCodePoint(parseInt(cp, 16)))
    .join("");
}

// 감정·상징·날씨 이모지를 Twemoji(그림) 로 그립니다.
// react-native-twemoji 는 size prop이 없어서 style 로 크기를 줘야 합니다.
// 이 라이브러리에 없는(최신) 이모지는 시스템 이모지로 자동 대체합니다.
// 빈 문자열(예: symbol 미설정)이면 아무것도 그리지 않습니다.
function EmojiIcon({codepoint, size}: {codepoint: string; size: number}) {
  if (!codepoint) return null;
  const char = codepointToEmoji(codepoint);
  if (Twemoji.supportedEmojis.includes(char)) {
    return <Twemoji style={{width: size, height: size}}>{char}</Twemoji>;
  }
  return <Text style={{fontSize: size}}>{char}</Text>;
}

export default function DiaryWritingScreen() {
  const insets = useSafeAreaInsets(); // 노치/홈바 영역만큼 헤더·하단바에 여백을 줍니다.
  const router = useRouter(); // 화면 이동(저장 후 Detail로)에 사용.

  // [5단계] 어떤 여행을 불러올지. 지금은 1번 고정 — 나중에 앞(업로드) 화면에서 tripId를 넘겨받음.
  const TRIP_ID = 1;

  // 백엔드에서 받아온 여행 전체. 받기 전(로딩 중)엔 null.
  const [trip, setTrip] = useState<TripDiary | null>(null);
  // 로딩/에러 상태 — 데이터가 오기 전·실패했을 때 화면을 분기합니다.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 액션(저장·재생성 등) 실패 시 하단에 보여줄 안내 문구.
  const [actionError, setActionError] = useState<string | null>(null);

  // 하루치 데이터. genStatus·본문이 이후에 바뀌므로 trip과 별도 상태로 보관합니다.
  // 처음엔 빈 배열, fetch 성공 시 백엔드가 준 days로 채웁니다. (genStatus도 백엔드 값 그대로)
  const [days, setDays] = useState<DayPage[]>([]);
  // 여행지 지도 피커 열림 여부.
  const [pickerOpen, setPickerOpen] = useState(false);

  // 여행 전체를 불러옵니다. (화면 진입 시 + 에러 후 "다시 시도"에서 재호출)
  const loadTrip = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTripDiary(TRIP_ID); // GET /trips/1
      setTrip(data);
      setDays(data.days);
    } catch (e) {
      console.error(e);
      setError("일기를 불러오지 못했어요. 서버가 켜져 있는지 확인해주세요.");
    } finally {
      setLoading(false); // 성공이든 실패든 로딩은 끝
    }
  }, []);

  // [5단계] 화면에 들어오면 한 번 불러옵니다.
  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  // 지금 보고 있는 날의 인덱스. "다음날로"를 누르면 +1 됩니다.
  const [dayIndex, setDayIndex] = useState(0);
  const day = days[dayIndex];

  const isLastDay = dayIndex === days.length - 1;
  const nextDay = days[dayIndex + 1];
  // "다음날로" 활성 조건: 다음 날이 생성 완료(ready)일 때만.
  const canGoNext = !isLastDay && nextDay?.genStatus === "ready";

  // [5-3] 아직 생성 중인 날이 있으면, 백엔드에 상태를 주기적으로 물어봅니다(폴링).
  // 모든 날이 ready가 되면 자동으로 멈춥니다.
  const hasGenerating = days.some((d) => d.genStatus === "generating");
  useEffect(() => {
    if (!hasGenerating) return; // 생성 중인 날이 없으면 폴링 안 함

    const timer = setInterval(async () => {
      try {
        const statuses = await fetchDayStatuses(TRIP_ID); // GET /trips/1/day-statuses
        // 받아온 상태를 각 날의 genStatus에 반영합니다(generating→ready 등).
        setDays((prev) =>
          prev.map((d) => {
            const s = statuses.find((x) => x.tripDayId === d.tripDayId);
            return s ? {...d, genStatus: s.genStatus} : d;
          }),
        );
      } catch (e) {
        console.error(e); // 폴링 실패는 조용히 넘김(다음 주기에 다시 시도)
      }
    }, 3000); // 3초마다 확인

    return () => clearInterval(timer); // 다 ready거나 화면을 떠나면 폴링 정지
  }, [hasGenerating]);

  // [5-3] 막 ready가 됐는데 본문이 아직 비어 있는 날은, 그 날 전체 내용을 한 번 가져옵니다.
  // (폴링은 genStatus만 갱신하므로, 본문·사진은 여기서 따로 채웁니다.)
  useEffect(() => {
    const target = days.find((d) => d.genStatus === "ready" && d.content === "");
    if (!target) return;

    async function fillContent() {
      try {
        const full = await fetchTripDay(target!.tripDayId); // GET /trip-days/{id}
        setDays((prev) =>
          prev.map((d) => (d.tripDayId === full.tripDayId ? full : d)),
        );
      } catch (e) {
        console.error(e);
      }
    }
    fillContent();
  }, [days]);

  // 현재 날(여행지)을 저장한 뒤 다음날로. 저장에 성공해야 넘어갑니다.
  const handleNext = async () => {
    if (!canGoNext) return;
    setActionError(null);
    try {
      // 이 화면의 유일한 편집 대상 = 여행지. 현재 값을 저장합니다.
      await saveDayLocation(day.tripDayId, day.locationSummary); // PATCH /trip-days/{id}
      setDayIndex((i) => i + 1); // 저장 성공 → 다음날로
    } catch (e) {
      console.error(e);
      setActionError("저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  };
  // 최종 저장 → trips.status='completed' → 성공해야 Detail로 이동.
  const handleSave = async () => {
    setActionError(null);
    try {
      await completeTrip(TRIP_ID); // PATCH /trips/{id}  { status: 'completed' }
      router.push("/detail"); // 저장 성공 → 이동
    } catch (e) {
      console.error(e);
      setActionError("최종 저장에 실패했어요. 다시 시도해주세요.");
    }
  };
  // 실패한 날 재생성 요청 → 그 날을 generating으로. 이후 폴링이 다시 ready로 되돌립니다.
  const handleRegenerate = async () => {
    setActionError(null);
    try {
      await regenerateDay(day.tripDayId); // POST /trip-days/{id}/regenerate
      setDays((prev) =>
        prev.map((d) =>
          d.tripDayId === day.tripDayId ? {...d, genStatus: "generating"} : d,
        ),
      );
    } catch (e) {
      console.error(e);
      setActionError("재생성 요청에 실패했어요.");
    }
  };
  // 여행지 편집: 지도 피커를 엽니다. (앱 전용 — 웹은 안내 모달)
  const handleEditLocation = () => setPickerOpen(true);

  // 피커에서 위치를 고르면: 현재 날 여행지를 화면에 즉시 반영하고 바로 저장합니다.
  // (마지막 날처럼 "다음날로"를 안 거치는 경우에도 보존되도록 여기서 PATCH)
  const handlePickLocation = async (placeName: string) => {
    setPickerOpen(false);
    setActionError(null);
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? {...d, locationSummary: placeName} : d,
      ),
    );
    try {
      await saveDayLocation(day.tripDayId, placeName); // PATCH /trip-days/{id}
    } catch (e) {
      console.error(e);
      setActionError("여행지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  // [5단계] 정상 데이터가 오기 전까지의 화면 분기.
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={colors.primary} />
        <Text className="mt-3 text-textSecondary">불러오는 중…</Text>
      </View>
    );
  }
  // 에러거나 데이터가 없으면 안내 + 다시 시도 버튼.
  if (error || !trip) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-surface px-8">
        <Text className="text-center text-textSecondary">
          {error ?? "여행을 찾을 수 없어요."}
        </Text>
        <Pressable
          onPress={loadTrip}
          className="flex-row items-center gap-2 rounded-2xl bg-primary px-5 py-3"
        >
          <RotateCcw size={16} color="#FFFFFF" />
          <Text className="font-bold text-textOnPrimary">다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* ===== 헤더: 일차 표시 (뒤로가기 없음 — 순방향 일방통행) ===== */}
      <View style={{paddingTop: insets.top}}>
        <View className="mx-auto w-full max-w-[420px] px-5 py-4">
          <Text className="text-center text-base font-bold text-primary">
            {day.dayNumber}일차 · 총 {trip.days.length}일
          </Text>
        </View>
      </View>

      {/* ===== 본문 (스크롤 영역) ===== */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="mx-auto w-full max-w-[420px] gap-6 px-5 pb-8 pt-2">
          {/* --- 요약 카드: trip 대표사진 + 제목(매 페이지 동일) --- */}
          {/* (구 day.symbol 자리 폐지: 여행 단위 trips.flag 로 통일 예정. 노출은 추후 작업) */}
          <View className="flex-row items-center gap-3 rounded-3xl bg-background p-4">
            <View className="h-16 w-16 overflow-hidden rounded-2xl">
              <Image
                source={{uri: trip.representImage}}
                contentFit="cover"
                style={{width: "100%", height: "100%"}}
              />
            </View>
            <Text className="flex-1 text-center font-sans text-lg font-bold text-textPrimary">
              {trip.title}
            </Text>
          </View>

          {/* ====== 상태별 본문 ====== */}
          {day.genStatus === "ready" && (
            <>
              {/* --- 여행지(편집 O) / 날짜(읽기전용) --- */}
              <View className="flex-row gap-4">
                <View className="flex-1 gap-2">
                  <Text className="ml-1 text-sm font-bold text-textSecondary">
                    여행지
                  </Text>
                  {/* 이 화면의 유일한 편집 진입점. 탭하면 지도 피커(예정). */}
                  <Pressable
                    onPress={handleEditLocation}
                    className="flex-row items-center justify-between rounded-xl bg-background p-4"
                  >
                    <Text
                      className="flex-1 text-sm font-medium text-textPrimary"
                      numberOfLines={1}
                    >
                      {day.locationSummary || "여행지 선택"}
                    </Text>
                    <MapPin size={16} color={colors.primary} />
                  </Pressable>
                </View>
                <View className="flex-1 gap-2">
                  <Text className="ml-1 text-sm font-bold text-textSecondary">
                    날짜
                  </Text>
                  <View className="flex-row items-center justify-between rounded-xl bg-background p-4">
                    <Text className="text-sm font-medium text-textPrimary">
                      {formatDate(day.date)}
                    </Text>
                    <Calendar size={16} color={colors.textSecondary} />
                  </View>
                </View>
              </View>

              {/* --- 소제목(읽기전용) + 감정 이모지 --- */}
              <View className="gap-2">
                <Text className="ml-1 text-sm font-bold text-textSecondary">
                  소제목
                </Text>
                <View className="flex-row items-center gap-3 rounded-xl bg-background p-4">
                  <Text className="flex-1 font-sans text-md font-bold text-textPrimary">
                    {day.subtitle}
                  </Text>
                  {/* trip_days.emotion (Twemoji) */}
                  <EmojiIcon codepoint={day.emotion} size={28} />
                </View>
              </View>

              {/* --- 여행 기록(본문, 읽기전용) + 날씨 이모지 --- */}
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-textPrimary">
                    여행 기록
                  </Text>
                  {/* trip_days.weather (Twemoji 코드포인트) */}
                  <EmojiIcon codepoint={day.weather} size={22} />
                </View>
                <View className="rounded-3xl bg-background p-6">
                  <Text
                    className="font-sans text-md text-textPrimary"
                    style={{lineHeight: 22}}
                  >
                    {day.content}
                  </Text>
                  {/* 글자 수 표시 (읽기전용이지만 분량 확인용으로 유지) */}
                  <View className="mt-2 flex-row justify-end">
                    <Text className="text-[10px] font-bold text-primaryLight">
                      {day.content.length}자
                    </Text>
                  </View>
                </View>
              </View>

              {/* --- 그날 사진 (읽기전용, +버튼 없음) --- */}
              <PhotoBar photos={day.photos} />
            </>
          )}

          {/* 생성중: 진입할 일은 거의 없지만(이전 날 버튼이 비활성), 방어적으로 표시 */}
          {day.genStatus === "generating" && (
            <View className="items-center gap-3 rounded-3xl bg-background px-6 py-12">
              <ActivityIndicator color={colors.primary} />
              <Text className="text-sm font-medium text-textSecondary">
                다음 추억 생성중…
              </Text>
            </View>
          )}

          {/* 실패: 제목 + 사진 바만 남기고, 본문 자리에 다시 생성하기 */}
          {day.genStatus === "failed" && (
            <>
              <View className="items-center gap-4 rounded-3xl bg-background px-6 py-10">
                <Text className="text-center text-sm font-medium text-textSecondary">
                  이 날의 일기를 생성하지 못했어요.
                </Text>
                <Pressable
                  onPress={handleRegenerate}
                  className="flex-row items-center gap-2 rounded-2xl bg-primary px-5 py-3"
                >
                  <RotateCcw size={16} color="#FFFFFF" />
                  <Text className="font-bold text-textOnPrimary">
                    일기 다시 생성하기
                  </Text>
                </Pressable>
              </View>
              <PhotoBar photos={day.photos} />
            </>
          )}
        </View>
      </ScrollView>

      {/* ===== 하단 버튼 (ready 상태에서만 노출, 하단 고정) ===== */}
      {day.genStatus === "ready" && (
        <View
          style={{paddingBottom: insets.bottom + 12}}
          className="border-t border-muted bg-surface px-5 pt-3"
        >
          <View className="mx-auto w-full max-w-[420px]">
            {actionError && (
              <Text className="mb-2 text-center text-sm font-medium text-error">
                {actionError}
              </Text>
            )}
            {isLastDay ? (
              // 마지막 날: 최종 저장
              <Pressable
                onPress={handleSave}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4"
              >
                <Text className="font-bold text-textOnPrimary">저장하기</Text>
                <FileText size={16} color="#FFFFFF" />
              </Pressable>
            ) : canGoNext ? (
              // 다음 날 준비됨: 이동 가능
              <Pressable
                onPress={handleNext}
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4"
              >
                <Text className="font-bold text-textOnPrimary">다음날로</Text>
                <ChevronRight size={16} color="#FFFFFF" />
              </Pressable>
            ) : (
              // 다음 날 생성중: 비활성
              <View className="flex-row items-center justify-center gap-2 rounded-2xl bg-muted py-4">
                <ActivityIndicator size="small" color={colors.primaryLight} />
                <Text className="font-bold text-primaryLight">
                  다음 추억 생성중
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 여행지 지도 피커 (앱 전용 오버레이 / 웹은 안내 모달) */}
      <LocationPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickLocation}
      />
    </View>
  );
}

// 하단 "대표 사진" 바 — 그날 사진들만 가로 스크롤로 표시 (읽기전용).
function PhotoBar({photos}: {photos: {id: number; thumbnailUrl: string}[]}) {
  return (
    <View className="gap-4">
      <Text className="ml-1 text-sm font-bold text-textSecondary">
        대표 사진
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {photos.map((p) => (
          <View
            key={p.id}
            className="h-16 w-16 overflow-hidden rounded-xl border border-border"
          >
            <Image
              source={{uri: p.thumbnailUrl}}
              contentFit="cover"
              style={{width: "100%", height: "100%"}}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

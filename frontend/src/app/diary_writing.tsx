// 일기 작성(편집) 화면
// 사용자가 사진으로 만든 여행 일기를 보고 편집하는 페이지입니다.
//
// [1단계] 디자인팀 최종 목업을 React Native로 정적 변환한 상태입니다.
//   - 아직 사진 선택 / AI 생성 / 저장은 동작하지 않습니다. (각각 2, 3, 5단계에서 연결)
//   - 화면 요소는 실제 DB 컬럼에 매핑됩니다 (아래 DiaryDraft 주석 참고).
//   - 색/폰트는 다른 페이지와 동일한 팀 디자인 토큰(primary, textPrimary, font-sans)을 사용.

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Calendar, ChevronLeft, Cloud, CloudRain, CloudSnow, FileText, Plus, Sun } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Twemoji from 'react-native-twemoji';

// 디자인 토큰(색상). 아이콘 색처럼 className으로 주기 번거로운 곳에 hex로 직접 씁니다.
// 값은 tailwind.config.js의 팀 색상과 동일합니다. (settings 화면과 같은 방식)
const colors = {
  textPrimary: '#152538', // 제목·본문 등 진한 글자
  textSecondary: '#39536B', // 라벨·보조 글자
  primary: '#5B7DBB', // 메인 포인트(저장 버튼 등)
  primaryLight: '#A9C3E6', // 흐린 글자·placeholder
  border: '#A9C3E6', // 테두리·구분선
  weather: '#EAB308', // 날씨(해) 아이콘
};

// trip_days.weather 문자열 → 아이콘 매핑.
// weather 컬럼은 자유 문자열이라, 대표 케이스만 두고 기본은 '맑음'(해)으로 처리합니다.
// 실제 들어오는 값이 확정되면 여기만 늘리면 됩니다.
type WeatherIconDef = {
  Icon: React.ComponentType<{ size?: number; color?: string; fill?: string }>;
  color: string;
  filled?: boolean; // 아이콘 내부를 색으로 채울지 (해처럼)
};
const WEATHER_ICONS: Record<string, WeatherIconDef> = {
  맑음: { Icon: Sun, color: colors.weather, filled: true },
  흐림: { Icon: Cloud, color: colors.textSecondary },
  비: { Icon: CloudRain, color: colors.textSecondary },
  눈: { Icon: CloudSnow, color: colors.textSecondary },
};

// 이 화면에서 다루는 일기 데이터의 모양입니다. (각 필드 = 실제 DB 컬럼)
// 지금은 이 파일 안에만 두고, 2단계에서 frontend/src/types/diary.ts 로 옮길 예정입니다.
type DiaryDraft = {
  title: string; // trips.title          — 요약카드의 큰 제목
  destination: string; // trips.destination    — 여행지
  date: string; // trip_days.date       — "YYYY-MM-DD"
  weather: string; // trip_days.weather    — 예: "맑음" (위 WEATHER_ICONS로 아이콘 결정)
  subtitle: string; // trip_days.subtitle   — 소제목
  emotion: string; // trip_days.emotion    — Twemoji 코드포인트(hex). 예: "1f60a"
  symbol: string; // diaries.symbol       — Twemoji 코드포인트(hex). 예: "1f5fc"(🗼)
  mainImage: string; // 대표 사진 URL
  content: string; // diaries.content      — 일기 본문
  images: string[]; // photos.file_url 목록
};

// 화면 확인용 더미 데이터. 최종 목업과 비슷하게 산토리니 내용으로 맞춤.
// 3단계에서 mock 생성 함수의 결과로, 5~6단계에서 실제 DB 값으로 대체됩니다.
const DUMMY_DIARY: DiaryDraft = {
  title: '산토리니에서 보낸 잊지 못할 하루',
  destination: '그리스, 산토리니',
  date: '2024-05-01',
  weather: '맑음',
  subtitle: '에게해의 푸른 낮과 붉은 노을',
  // 목업의 감정 이모지는 🥹(1f979)인데 이 twemoji 버전에 없어서, 있는 😊(1f60a)로 대체했습니다.
  emotion: '1f60a',
  symbol: '1f5fc', // 🗼 타워
  mainImage: 'https://picsum.photos/seed/santorini-main/400/400',
  content:
    '푸른 하늘과 에메랄드빛 바다가 어우러진 산토리니. 하얀 건물과 파란 지붕이 만들어내는 풍경은 마치 그림 같았다.\n\n이아 마을 골목길을 따라 천천히 걸으며 바다를 바라보는 순간, 모든 고민이 사라지는 기분이 들었다.\n\n맛있는 음식과 여유로운 시간, 잊지 못할 하루였다.',
  images: [
    'https://picsum.photos/seed/santorini-main/400/400',
    'https://picsum.photos/seed/santorini-2/200/200',
    'https://picsum.photos/seed/santorini-3/200/200',
    'https://picsum.photos/seed/santorini-4/200/200',
    'https://picsum.photos/seed/santorini-5/200/200',
  ],
};

// "YYYY-MM-DD" → "YYYY.MM.DD (요일)". (목업의 날짜 표기와 동일)
// new Date(연, 월-1, 일) 로 만들어 시간대(UTC) 때문에 날짜가 밀리는 문제를 피합니다.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${dateStr.replace(/-/g, '.')} (${weekday})`;
}

// Twemoji 코드포인트(hex) → 실제 이모지 문자. 예: "1f5fc"→🗼, "1f1f0-1f1f7"→🇰🇷
function codepointToEmoji(codepoint: string): string {
  return codepoint
    .split('-')
    .map((cp) => String.fromCodePoint(parseInt(cp, 16)))
    .join('');
}

// 감정·상징 이모지를 Twemoji(그림) 로 그립니다.
// react-native-twemoji 는 size prop이 없어서 style 로 크기를 줘야 합니다.
// 이 라이브러리에 없는(최신) 이모지는 시스템 이모지로 자동 대체합니다.
function EmojiIcon({ codepoint, size }: { codepoint: string; size: number }) {
  const char = codepointToEmoji(codepoint);
  if (Twemoji.supportedEmojis.includes(char)) {
    return <Twemoji style={{ width: size, height: size }}>{char}</Twemoji>;
  }
  return <Text style={{ fontSize: size }}>{char}</Text>;
}

export default function DiaryWritingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets(); // 노치/홈바 영역만큼 헤더·하단바에 여백을 줍니다.

  // 편집 중인 일기 상태. 입력란을 고치면 이 값이 바뀝니다.
  const [data, setData] = useState<DiaryDraft>(DUMMY_DIARY);

  // 날씨 문자열에 맞는 아이콘. 매핑에 없으면 '맑음'으로 처리.
  const weather = WEATHER_ICONS[data.weather] ?? WEATHER_ICONS['맑음'];
  const WeatherIcon = weather.Icon;

  // 저장 동작은 아직 미구현입니다. 3단계(mock) → 5단계(실제 API)에서 채웁니다.
  const handleSave = () => {
    console.log('저장 예정 데이터:', data);
  };

  return (
    <View className="flex-1 bg-surface">
      {/* ===== 헤더 (제목 가운데, 좌측 뒤로가기) ===== */}
      <View style={{ paddingTop: insets.top }}>
        <View className="mx-auto w-full max-w-[420px] flex-row items-center px-5 py-4">
          {/* 뒤로가기: 목업엔 없지만 화면 이동을 위해 둡니다. */}
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text className="flex-1 text-center text-lg font-bold text-textPrimary">여행 기록 편집</Text>
          {/* 제목을 정확히 가운데 두기 위한 뒤로가기 아이콘과 같은 폭의 빈 칸 */}
          <View style={{ width: 24 }} />
        </View>
      </View>

      {/* ===== 본문 (가운데 영역, 스크롤됨) ===== */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="mx-auto w-full max-w-[420px] gap-6 px-5 pb-8 pt-2">
          {/* --- 요약 카드: 대표 사진 + 제목(가운데) + 상징 이모지 --- */}
          <View className="flex-row items-center gap-3 rounded-3xl bg-background p-4">
            <View className="h-16 w-16 overflow-hidden rounded-2xl">
              <Image
                source={{ uri: data.mainImage }}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
              />
            </View>
            <View className="flex-1 rounded-2xl bg-surface px-3 py-3">
              <TextInput
                value={data.title}
                onChangeText={(text) => setData({ ...data, title: text })}
                placeholder="제목 입력"
                placeholderTextColor={colors.primaryLight}
                multiline
                className="text-center font-sans text-lg font-bold text-textPrimary"
              />
            </View>
            {/* diaries.symbol (Twemoji) */}
            <EmojiIcon codepoint={data.symbol} size={40} />
          </View>

          {/* --- 정보 입력 행: 여행지 / 날짜 --- */}
          <View className="flex-row gap-4">
            {/* 여행지(trips.destination): 편집 가능 */}
            <View className="flex-1 gap-2">
              <Text className="ml-1 text-sm font-bold text-textSecondary">여행지</Text>
              <View className="rounded-xl bg-background p-4">
                <TextInput
                  value={data.destination}
                  onChangeText={(text) => setData({ ...data, destination: text })}
                  placeholder="여행지"
                  placeholderTextColor={colors.primaryLight}
                  className="text-sm font-medium text-textPrimary"
                />
              </View>
            </View>
            {/* 날짜(trip_days.date): 지금은 표시만 (날짜 선택기는 이후 단계) */}
            <View className="flex-1 gap-2">
              <Text className="ml-1 text-sm font-bold text-textSecondary">날짜</Text>
              <View className="flex-row items-center justify-between rounded-xl bg-background p-4">
                <Text className="text-sm font-medium text-textPrimary">{formatDate(data.date)}</Text>
                <Calendar size={16} color={colors.textSecondary} />
              </View>
            </View>
          </View>

          {/* --- 소제목(trip_days.subtitle) + 감정 이모지(trip_days.emotion) --- */}
          <View className="gap-2">
            <Text className="ml-1 text-sm font-bold text-textSecondary">제목</Text>
            <View className="flex-row items-center gap-3 rounded-xl bg-background p-4">
              <TextInput
                value={data.subtitle}
                onChangeText={(text) => setData({ ...data, subtitle: text })}
                placeholder="소제목 입력"
                placeholderTextColor={colors.primaryLight}
                className="flex-1 font-sans text-md font-bold text-textPrimary"
              />
              {/* trip_days.emotion (Twemoji) */}
              <EmojiIcon codepoint={data.emotion} size={28} />
            </View>
          </View>

          {/* --- 여행 기록(본문) + 날씨 아이콘 --- */}
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-textPrimary">여행 기록</Text>
              {/* trip_days.weather → 아이콘 */}
              <WeatherIcon size={22} color={weather.color} fill={weather.filled ? weather.color : undefined} />
            </View>
            <View className="rounded-3xl bg-background p-6">
              <TextInput
                value={data.content}
                onChangeText={(text) => setData({ ...data, content: text })}
                placeholder="오늘의 여정을 정리해보세요."
                placeholderTextColor={colors.primaryLight}
                multiline
                maxLength={1000}
                textAlignVertical="top"
                className="font-sans text-md text-textPrimary"
                style={{ height: 200, lineHeight: 22 }}
              />
              {/* 글자 수 표시 */}
              <View className="mt-2 flex-row justify-end">
                <Text className="text-[10px] font-bold text-primaryLight">{data.content.length}/1000</Text>
              </View>
            </View>
          </View>

          {/* --- 대표 사진: 가로 스크롤 --- */}
          <View className="gap-4">
            <Text className="ml-1 text-sm font-bold text-textSecondary">대표 사진</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2">
              {/* 첨부된 사진 썸네일들 */}
              {data.images.map((img, i) => (
                <View key={i} className="h-16 w-16 overflow-hidden rounded-xl border border-border">
                  <Image
                    source={{ uri: img }}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                </View>
              ))}
              {/* 사진 추가 버튼 (실제 선택 기능은 2단계) */}
              <Pressable className="h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-border bg-background">
                <Plus size={24} color={colors.primaryLight} />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      {/* ===== 하단 저장 버튼 (스크롤되지 않고 하단 고정) ===== */}
      <View
        style={{ paddingBottom: insets.bottom + 12 }}
        className="border-t border-muted bg-surface px-5 pt-3">
        <View className="mx-auto w-full max-w-[420px]">
          <Pressable
            onPress={handleSave}
            className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-4">
            <Text className="font-bold text-textOnPrimary">저장하기</Text>
            <FileText size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

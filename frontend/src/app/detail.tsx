import React, { useState,useEffect,useRef } from 'react';
import { View, Text, Image, ScrollView, Pressable,useWindowDimensions, FlatList} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { X, MapPin, Calendar, Plus } from 'lucide-react-native';
import Twemoji from 'react-native-twemoji';
import { getDetailPage } from '@/api/detail';
import { DetailPage, Days } from '@/types/api';

// ─────────────────────────────────────────────
// 🔧 유틸 함수 섹션
// ─────────────────────────────────────────────

/**
 * 이모지 코드포인트(hex 문자열) → 실제 이모지 문자로 변환
 * 예: "1f5fc" → 🗼 / "1f1f0-1f1f7" → 🇰🇷
 * "-"로 연결된 복합 코드포인트도 처리
 */
function codepointToEmoji(codepoint: string): string {
  return codepoint
    .split("-")
    .filter((cp) => cp.length > 0)
    .map((cp) => {
      const code = parseInt(cp, 16);
      return isNaN(code) ? "" : String.fromCodePoint(code);
    })
    .join("");
}

// ─────────────────────────────────────────────
// 🎨 이모지 렌더링 컴포넌트
// ─────────────────────────────────────────────

/**
 * 감정·상징·날씨 이모지를 Twemoji(그림 이모지) 로 렌더링
 * - Twemoji가 지원하는 이모지 → Twemoji 이미지로 표시
 * - Twemoji가 지원하지 않는 이모지 → 시스템 기본 이모지로 표시
 * - codepoint가 빈 문자열이면 아무것도 렌더링하지 않음
 * @param codepoint - 이모지 코드포인트 (hex 문자열)
 * @param size - 이모지 크기 (px)
 */
function EmojiIcon({codepoint, size}: {codepoint: string; size: number}) {
  if (!codepoint) return null;
  const char = codepointToEmoji(codepoint);
  if (Twemoji.supportedEmojis.includes(char)) {
    return <Twemoji style={{width: size, height: size}}>{char}</Twemoji>;
  }
  return <Text style={{fontSize: size}}>{char}</Text>;
}

// ─────────────────────────────────────────────
// 🌤️ 날씨 매핑 테이블
// ─────────────────────────────────────────────

/**
 * DB에 저장된 날씨 값(한글 또는 codepoint)을 이모지·텍스트로 변환하는 매핑 테이블
 * - 한글 텍스트 키: AI가 한글로 저장한 구버전 데이터 대응
 * - codepoint 키: 현재 저장 방식 대응
 * - "fe0f" 변형 선택자가 붙은 codepoint도 별도 키로 등록
 * - 매핑에 없는 값("미상", "실내" 등)은 날씨 UI 자체를 숨김
 */
const WEATHER_MAP: Record<string, { codepoint: string; label: string }> = {
  // 한글 텍스트 키
  "맑음":      { codepoint: "2600",  label: "맑음" },
  "흐림":      { codepoint: "2601",  label: "흐림" },
  "비":        { codepoint: "1f327", label: "비" },
  "눈":        { codepoint: "2744",  label: "눈" },
  // codepoint 키
  "2600":      { codepoint: "2600",  label: "맑음" },
  "2600-fe0f": { codepoint: "2600",  label: "맑음" },
  "2601":      { codepoint: "2601",  label: "흐림" },
  "1f327":     { codepoint: "1f327", label: "비" },
  "2744":      { codepoint: "2744",  label: "눈" },
};

// ─────────────────────────────────────────────
// 🖼️ 메인 이미지 추출 함수
// ─────────────────────────────────────────────

/**
 * 여행의 대표 이미지(커버 사진)를 찾아서 Image 컴포넌트로 반환
 * 1. cover_photo_id가 없거나 tripDays가 비어있으면 null 반환
 * 2. 모든 일차의 사진을 1차원 배열로 펼침
 * 3. cover_photo_id와 일치하는 사진을 찾아 Image 컴포넌트로 렌더링
 * @param item - 여행 상세 데이터 (DetailPage 타입)
 */
export function getMainImage(item: DetailPage) {
  const allPhotos = item.tripDetail.flatMap((day) => day.photos || []);
  const coverPhoto = allPhotos.find((photo) => photo.id === item.cover_photo_id);

  if (coverPhoto && coverPhoto.image_url) {
    return (
      <Image
        source={{ uri: coverPhoto.image_url }}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />
    );
  }
}

// ─────────────────────────────────────────────
// 📱 메인 컴포넌트
// ─────────────────────────────────────────────

/**
 * 여행 상세 페이지 UI 컴포넌트
 * - 상단 히어로 이미지 + 여행 기본 정보 표시
 * - Day 탭으로 일차별 상세 내용 전환
 * - 사진 슬라이더, 날씨, 감정 이모지, 일기 텍스트 표시
 */
export default function TravelDetailUI() {

  // ─────────────────────────────────────────────
  // 📐 레이아웃 & 라우터 설정
  // ─────────────────────────────────────────────

  // 기기 화면 너비 가져오기 (사진 슬라이더 너비 계산에 사용)
  const { width: windowWidth } = useWindowDimensions();
  // 카드 좌우 패딩(32px) 제외한 실제 사진 너비 계산
  const cardWidth = windowWidth - 64;
  // 사진 슬라이더(FlatList)를 코드로 제어하기 위한 ref
  const flatListRef = useRef<FlatList>(null);

  // 화면 이동 라우터
  const router = useRouter();
  // 홈에서 전달받은 여행 id와 day 파라미터
  const {id, day} = useLocalSearchParams();
  const tripId = Number(id);

  // ─────────────────────────────────────────────
  // 🗃️ 상태(State) 관리
  // ─────────────────────────────────────────────

  // API에서 가져온 여행 상세 데이터
  const [trip, setTrip] = useState<DetailPage | null>(null);
  // 데이터 로딩 중 여부
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 에러 메시지
  const [error, setError] = useState<string | null>(null);
  // 현재 활성화된 Day 탭 번호 (홈에서 전달받은 day 또는 기본값 1)
  const [activeDay, setActiveDay] = useState<number>(Number(day) || 1);
  // 현재 슬라이더에서 보이는 사진 인덱스 (도트 인디케이터용)
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  // ─────────────────────────────────────────────
  // 🌐 데이터 패칭 (API 호출)
  // ─────────────────────────────────────────────

  /**
   * 화면 진입 시 백엔드에서 여행 상세 데이터 로드
   * - tripId가 있을 때만 실행
   * - 홈에서 day를 전달받지 않은 경우 첫 번째 일차로 자동 설정
   */
  useEffect(() => {
    const loadDetailData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getDetailPage(tripId);
        console.log("🔥 백엔드가 준 진짜 데이터 구조:", JSON.stringify(data, null, 2));
        setTrip(data);

        // 홈에서 특정 day를 선택하지 않고 진입한 경우 → 첫 번째 일차로 자동 선택
        if (!day && data.tripDetail?.length > 0) {
          const sortedDays = [...data.tripDetail].sort((a, b) => a.day_number - b.day_number);
          setActiveDay(sortedDays[0].day_number);
        }
      } catch (err) {
        console.error("상세 페이지 데이터 로딩 실패:", err);
        setError("여행 상세 정보를 불러올 수 없습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    if (tripId) loadDetailData();
  }, [tripId, day]);

  // ─────────────────────────────────────────────
  // 🔄 Day 탭 변경 시 사진 슬라이더 초기화
  // ─────────────────────────────────────────────

  /**
   * Day 탭이 바뀔 때마다 사진 슬라이더를 첫 번째 사진으로 초기화
   * - 다른 Day로 이동했을 때 이전 Day의 사진 위치가 남아있지 않도록 방지
   */
  useEffect(() => {
    setActivePhotoIndex(0);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeDay]);

  // ─────────────────────────────────────────────
  // ⏳ 로딩 상태 처리
  // ─────────────────────────────────────────────

  // 데이터 로딩 중이거나 trip 데이터가 없으면 로딩 화면 표시
  if (isLoading || !trip) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-textSecondary font-sans mt-sm">기록을 불러오는 중...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // 🔀 데이터 가공
  // ─────────────────────────────────────────────

  // 여행 기본 정보 구조분해
  const { title, destination, start_date, end_date, tripDetail} = trip as any;

  // 현재 선택된 Day 탭에 해당하는 상세 데이터만 추출
  const currentDayData = tripDetail?.find((d: Days) => Number(d.day_number) === activeDay);

  // 날씨 값(한글 또는 codepoint)을 WEATHER_MAP에서 조회 → 없으면 null (날씨 UI 숨김)
  const weatherInfo = currentDayData?.weather ? WEATHER_MAP[currentDayData.weather] : null;

  // Day 탭 목록 자동 생성 (예: tripDetail이 3개면 [1, 2, 3])
  const dayTabs = tripDetail
    ? tripDetail.map((d: Days) => Number(d.day_number)).sort((a: number, b: number) => a - b)
    : [];

  // ─────────────────────────────────────────────
  // 🖥️ UI 렌더링
  // ─────────────────────────────────────────────

  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >

      {/* ── 섹션 1. 상단 히어로 이미지 영역 ─────────────────
          - 여행 대표 이미지 전체 너비로 표시
          - 그라데이션 오버레이로 텍스트 가독성 확보
          - 우측 상단 닫기(X) 버튼
          - 하단에 여행 제목 / 위치 / 날짜 표시
      ──────────────────────────────────────────────── */}
      {/* overflow-hidden과 고정 높이를 주어 아이폰에서 상단으로 탈출하는 것을 방지*/}
      <View style={{ height: 320 }} className="relative w-full overflow-hidden">
        {getMainImage(trip)}

        {/* 그라데이션 오버레이: 상단 어둡게 → 중간 투명 → 하단 배경색으로 자연스럽게 이어짐 */}
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'transparent', '#F4F6F9']}
          locations={[0, 0.5, 1]}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          className="absolute inset-0 p-md"
        >
          {/* 닫기 버튼: 이전 화면(홈)으로 돌아가기 
              pt-safe를 빼고 고정 패딩으로 바꾼 닫기 버튼 (아이폰 쏠림 방지) */}          
          <View className="flex-row justify-end pt-10 pr-4">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
            >
              <X size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* 여행 기본 정보: 제목 / 위치 / 날짜 */}
          <View className="absolute bottom-lg left-md w-full pr-md">
            <Text className="text-xl font-sans font-bold text-textPrimary mb-sm">
              {title || '여행 정보'}
            </Text>
            <View className="flex-row items-center justify-between w-full">

              {/* 위치 아이콘 + 목적지 텍스트 */}
              <View className="flex-row items-center gap-xs">
                <MapPin size={14} color="#39536B" />
                <Text className="text-sm font-sans text-textSecondary">
                  {destination || '위치 미정'}
                </Text>
              </View>

              {/* 날짜 아이콘 + 여행 기간 텍스트 (예: 26.04.01 ~ 26.04.03) */}
              <View className="flex-1 flex-row items-center gap-md flex-wrap">
                <View className="flex-row items-center gap-xs">
                  <Calendar size={14} color="#39536B" />
                  <Text className="text-sm font-sans text-textSecondary">
                    {(() => {
                      if (!start_date || !end_date) return '날짜 미정';
                      const format = (dateStr: string) => {
                        const clean = dateStr.replaceAll('-', '.');
                        return clean.startsWith('20') ? clean.slice(2) : clean;
                      };
                      return `${format(start_date)} ~ ${format(end_date)}`;
                    })()}
                  </Text>
                </View>
              </View>
              {/* 여행 대표 이모지: trip.flag가 있을 때만 표시 (테스트용 폴백: "1f30f" = 🌏) */}
              {(trip.flag || "1f30f") && (
                <View className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/70 items-center justify-center overflow-hidden">
                  <EmojiIcon codepoint={trip.flag || "1f30f"} size={26} />
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── 섹션 2. Day 탭 영역 ──────────────────────────────
          - 여행 일차(Day 1, 2, 3...)를 탭으로 표시
          - 활성 탭: 넓고 파란 배경 / 비활성 탭: 좁고 회색 배경
          - 최대 7개까지 표시, 7개 미만이면 + 버튼으로 일차 추가 가능
      ──────────────────────────────────────────────── */}
      <View className="flex-row items-end px-9 mt-sm">
        {(dayTabs?.length > 0 ? dayTabs : [1]).map((d: number) => (
          <Pressable
            key={d}
            onPress={() => { setActiveDay(d); setActivePhotoIndex(0); }}
            className={`py-xs rounded-t-lg mr-0 shadow-sm ${
              activeDay === d
                ? 'px-lg bg-primary min-w-[70px] items-center'  // 활성 탭
                : 'px-sm bg-muted min-w-[36px] items-center'    // 비활성 탭
            }`}
          >
            <Text
              className={`${
                activeDay === d
                  ? 'font-logo text-xl text-white'                      // 활성: 필기체 큰 글씨
                  : 'font-sans text-base font-bold text-textSecondary'  // 비활성: 고딕 숫자
              }`}
            >
              {activeDay === d ? `Day ${d}` : d}
            </Text>
          </Pressable>
        ))}

        {/* 일차 추가 버튼: 현재 일차가 7개 미만일 때만 표시 */}
        {dayTabs.length < 7 && (
          <Pressable
            onPress={() => router.push({ pathname: '/add', params: { trip_id: tripId } })}
            className="rounded-t-lg h-[30px] bg-muted min-w-[36px] items-center justify-center shadow-sm"
          >
            <Plus size={16} color="#39536B" strokeWidth={3} />
          </Pressable>
        )}
      </View>

      {/* ── 섹션 3. 메인 콘텐츠 카드 ────────────────────────
          - 현재 선택된 Day의 상세 내용 표시
          - 소제목 + 감정 이모지
          - 위치 / 날짜 / 날씨 정보
          - 사진 슬라이더 (여러 장일 경우 도트 인디케이터 표시)
          - 일기 본문 텍스트
      ──────────────────────────────────────────────── */}
      <View className="px-md pb-xl pt-sm -mt-[8px]">
        <View className="bg-surface rounded-lg p-md shadow-sm border border-border">

          {/* ── 3-1. 소제목 & 감정 이모지 ── */}
          <View className="flex-row justify-between items-end mb-md w-full">
            <View className="flex-1 mr-xs">
              <Text className="text-lg font-bold text-textPrimary font-sans">
                {currentDayData?.subtitle || '상세 일정이 없습니다.'}
              </Text>
            </View>
            {/* 감정 이모지: currentDayData.emotion이 있을 때만 표시 */}
            <View style={{ width: 44, height: 44, flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 2 }}>
              {currentDayData?.emotion && (
                <EmojiIcon codepoint={currentDayData.emotion} size={28} />
              )}
            </View>
          </View>

          {/* ── 3-2. 위치 / 날짜 / 날씨 정보 ── */}
          <View className="flex-row items-center gap-xs mb-sm">
            {/* 세부 위치 */}
            <MapPin size={10} color="#39536B" />
            <Text className="text-sm text-textSecondary font-sans mr-1">
              {currentDayData?.location_summary || '위치 정보 없음'}
            </Text>

            {/* 날짜: "월.일" 형식으로 표시 (예: 04.01) */}
            <Text className="text-sm text-textSecondary font-sans mr-2">
              {(() => {
                const targetDate = currentDayData?.date || start_date;
                if (!targetDate) return '날짜 미정';
                const clean = targetDate.replaceAll('-', '.');
                return clean.length >= 5 ? clean.slice(-5) : clean;
              })()}
            </Text>

            {/* 날씨 이모지 + 텍스트: weatherInfo가 있을 때만 표시 */}
            <View className="flex-row items-center gap-xs px-sm py-xs rounded-full">
              {weatherInfo && (
                <View className="flex-row items-center gap-xs">
                  <EmojiIcon codepoint={weatherInfo.codepoint} size={16} />
                  <Text className="text-sm text-textSecondary font-sans font-bold">
                    {weatherInfo.label}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── 3-3. 사진 슬라이더 ──
              - 사진이 1장 이상일 때만 렌더링
              - 가로 스크롤 / 페이지 단위로 넘김
              - 하단 도트 인디케이터로 현재 사진 위치 표시
          ── */}
          {currentDayData?.photos && currentDayData.photos.length > 0 && (
            <View style={{ width: cardWidth }} className="rounded-lg mb-md mt-md overflow-hidden">
              <FlatList
                ref={flatListRef}
                key={activeDay}
                data={currentDayData.photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item: any, index: number) => item.id?.toString() || index.toString()}
                // 현재 화면에 보이는 사진 인덱스 추적 → 도트 인디케이터 업데이트
                onViewableItemsChanged={({ viewableItems }) => {
                  if (viewableItems.length > 0) setActivePhotoIndex(viewableItems[0].index ?? 0);
                }}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item.image_url }}
                    style={{ width: cardWidth, height: 240 }}
                    className="rounded-lg"
                    resizeMode="cover"
                  />
                )}
              />

              {/* 도트 인디케이터: 사진이 2장 이상일 때만 표시 */}
              {currentDayData.photos.length > 1 && (
                <View className="flex-row justify-center items-center gap-xs py-xs">
                  {currentDayData.photos.map((_: any, i: number) => (
                    <View
                      key={i}
                      style={{
                        // 현재 보이는 사진 도트는 크게, 나머지는 작게
                        width: activePhotoIndex === i ? 8 : 6,
                        height: activePhotoIndex === i ? 8 : 6,
                        borderRadius: 4,
                        backgroundColor: activePhotoIndex === i ? '#39536B' : '#C4CDD6',
                      }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── 3-4. 일기 본문 텍스트 ── */}
          <View className="bg-muted p-md rounded-md border border-border">
            <Text className="text-textSecondary text-md font-sans">
              {currentDayData?.content || '이날의 일기 기록이 비어있습니다.'}
            </Text>
          </View>

        </View>
      </View>

    </ScrollView>
  );
}
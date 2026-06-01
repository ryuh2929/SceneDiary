import React, { useState,useEffect } from 'react';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, ChevronDown, MapPin, Plus } from 'lucide-react-native';
import Twemoji from 'react-native-twemoji';
import BottomNav from '@/components/bottom-nav';
import { getTrips } from '@/api/home';
import { Trip } from '@/types/api';

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
    .map((cp) => String.fromCodePoint(parseInt(cp, 16)))
    .join("");
}

// ─────────────────────────────────────────────
// 🎨 이모지 렌더링 컴포넌트
// ─────────────────────────────────────────────

/**
 * 감정·상징·날씨 이모지를 Twemoji(그림 이모지)로 렌더링
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
// 🖼️ 메인 이미지 추출 함수
// ─────────────────────────────────────────────

/**
 * 여행의 대표 이미지(커버 사진)를 찾아서 Image 컴포넌트로 반환
 * 1. 모든 일차의 사진을 1차원 배열로 펼침
 * 2. cover_photo_id와 일치하는 사진을 찾아 Image 컴포넌트로 렌더링
 * 3. 매칭되는 사진이 없으면 아무것도 반환하지 않음
 * @param item - 여행 데이터 (Trip 타입)
 */
export function getMainImage(item: Trip) {
  // 모든 일차(tripDays)에 흩어진 photos를 1차원 배열로 펼치기
  const allPhotos = item.tripDays.flatMap((day) => day.photos || []);

  // cover_photo_id와 일치하는 사진 찾기
  const coverPhoto = allPhotos.find((photo) => photo.id === item.cover_photo_id);

  // 매칭된 사진이 있으면 Image 컴포넌트로 렌더링
  if (coverPhoto && coverPhoto.image_url) {
    return (
      <Image
        source={{ uri: coverPhoto.image_url }}
        className="w-full h-full"
        resizeMode="cover"
      />
    );
  }
}

// ─────────────────────────────────────────────
// 📱 메인 컴포넌트
// ─────────────────────────────────────────────

/**
 * 홈 화면 컴포넌트
 * - 상단 헤더: 로고 + 연도 변경 버튼
 * - 여행 카드 리스트: 대표 이미지 / 제목 / 위치 / 아코디언 상세
 * - 우측 하단 FAB(+) 버튼: 새 여행 추가
 * - 하단 네비게이션 바
 */
export default function HomeScreen() {

  // ─────────────────────────────────────────────
  // 🗃️ 상태(State) 관리
  // ─────────────────────────────────────────────

  const router = useRouter();

  // 현재 선택된 연도 (연도별 여행 필터링에 사용)
  const [currentYear, setCurrentYear] = useState<number>(2026);

  // 아코디언 펼침 상태: 현재 펼쳐진 여행 카드의 id (없으면 null)
  const [expandedId, setExpandedId] = useState<number|null>(null);

  // API에서 가져온 여행 목록 데이터
  const [tripData, setTripData] = useState<Trip[]>([]);

  // 데이터 로딩 중 여부
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 에러 메시지
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────────────────────
  // 🌐 데이터 패칭 (API 호출)
  // ─────────────────────────────────────────────

  /**
   * 연도가 변경될 때마다 해당 연도의 여행 목록을 API에서 불러옴
   * - currentYear가 바뀔 때마다 자동 실행
   * - 로딩/에러 상태 관리 포함
   */
  useEffect(() => {
    const loadTripData = async () => {
      try {
        setIsLoading(true);   // 로딩 시작
        setError(null);       // 이전 에러 초기화
        setTripData([]);      // 이전 데이터 초기화

        const data = await getTrips(currentYear);
        console.log("API 응답 데이터:", JSON.stringify(data, null, 2));
        setTripData(data);    // 받아온 데이터 저장
      } catch (err: any) {
        setTripData([]);
        console.log("API 에러 전체:", err);
        console.log("API 에러 메시지:", err?.message);
        console.log("API 에러 응답:", err?.response?.status, err?.response?.data);
        setError("여행 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);  // 성공/실패 관계없이 로딩 종료
      }
    };

    loadTripData();
  }, [currentYear]); // currentYear가 바뀔 때만 재실행

  // ─────────────────────────────────────────────
  // 🔀 아코디언 토글 핸들러
  // ─────────────────────────────────────────────

  /**
   * 여행 카드 아코디언 펼침/접힘 토글
   * - 이미 펼쳐진 카드를 누르면 접힘
   * - 다른 카드를 누르면 해당 카드만 펼침
   * @param id - 토글할 여행 카드의 id
   */
  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // ─────────────────────────────────────────────
  // 🖥️ UI 렌더링
  // ─────────────────────────────────────────────

  return (
    <View className="flex-1 bg-background">

      {/* ── 섹션 1. 상단 헤더 ────────────────────────────────
          - 앱 로고 (SceneDiary)
          - 연도 변경: ← 이전 연도 / 현재 연도 / 다음 연도 →
      ──────────────────────────────────────────────── */}
      <View className="bg-surface pt-safe pb-md items-center border-b border-border shadow-sm">
        <Text className="text-xl font-logo text-logo mt-sm">SceneDiary</Text>
        <View className="flex-row items-center justify-center gap-xl mt-md">
          {/* 이전 연도 버튼 */}
          <Pressable onPress={() => setCurrentYear(prev => prev - 1)} className="p-xs">
            <ChevronLeft size={20} color="#39536B" />
          </Pressable>
          {/* 현재 연도 표시 */}
          <Text className="text-lg font-bold text-textPrimary font-sans">{currentYear}</Text>
          {/* 다음 연도 버튼 */}
          <Pressable onPress={() => setCurrentYear(prev => prev + 1)} className="p-xs">
            <ChevronRight size={20} color="#39536B" />
          </Pressable>
        </View>
      </View>

      {/* ── 섹션 2. 여행 카드 리스트 ────────────────────────
          - 해당 연도의 여행 목록을 카드 형태로 표시
          - 각 카드: 대표 이미지 / 날짜 뱃지 / 대표 이모지 / 제목 / 위치
          - 아코디언: 펼치면 일차별 상세 목록 표시
      ──────────────────────────────────────────────── */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 180 }}
      >
        <View className="px-md mt-lg mb-md gap-lg">
          {tripData.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <View key={item.id} className="bg-surface rounded-lg overflow-hidden shadow-sm border border-border">

                {/* ── 2-1. 대표 이미지 영역 ──
                    - 클릭 시 상세 페이지로 이동
                    - 좌상단: 날짜 뱃지 / 우상단: 여행 대표 이모지
                ── */}
                <Pressable
                  className="relative h-60 w-full"
                  onPress={() => router.push({
                    pathname: '/detail',
                    params: {
                      id: item.id,
                      title: item.title,
                      location: item.destination,
                      mainImage: item.cover_photo_id,
                      startDate: item.start_date,
                      endDate: item.end_date,
                      details: JSON.stringify(item.tripDays)
                    }
                  })}
                >
                  {/* 대표 이미지 */}
                  {getMainImage(item)}

                  {/* 날짜 뱃지: 여행 시작일 ~ 종료일 */}
                  <View className="absolute top-md left-md bg-muted rounded-md px-sm py-xs items-center shadow-sm">
                    <Text className="text-sm font-sans text-textPrimary">
                      {item.start_date} ~ {item.end_date}
                    </Text>
                  </View>

                  {/* 여행 대표 이모지: item.flag가 있을 때만 표시 */}
                  <View className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/70 items-center justify-center overflow-hidden">
                    {(item.flag || "1f30f") && (
                      <EmojiIcon codepoint={item.flag || "1f30f"} size={26} />
                    )}
                  </View>
                </Pressable>

                {/* ── 2-2. 여행 텍스트 정보 ──
                    - 여행 제목
                    - 목적지 위치
                ── */}
                <View className="p-md">
                  <Text className="text-lg font-bold text-textPrimary mb-xs font-sans">
                    {item.title}
                  </Text>
                  <View className="flex-row items-center gap-xs">
                    <MapPin size={12} color="#39536B" />
                    <Text className="text-sm text-textSecondary font-sans">
                      {item.destination}
                    </Text>
                  </View>
                </View>

                {/* ── 2-3. 아코디언 토글 버튼 ──
                    - tripDays가 1개 이상일 때만 표시
                    - 펼침: "접기" / 접힘: "여행 상세 (N일)"
                    - 화살표 아이콘: 펼침 시 180도 회전
                ── */}
                {item.tripDays?.length > 0 && (
                  <Pressable
                    onPress={() => toggleExpand(item.id)}
                    className={
                      "w-full flex-row items-center justify-center py-sm gap-xs border-t border-border " +
                      (isExpanded ? "bg-muted" : "bg-surface")
                    }
                  >
                    <Text className="text-sm text-primary font-sans">
                      {isExpanded ? '접기' : `여행 상세 (${item.tripDays?.length}일)`}
                    </Text>
                    <ChevronDown
                      size={14}
                      color="#5B7DBB"
                      style={{
                        transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                        marginLeft: 2,
                      }}
                    />
                  </Pressable>
                )}

                {/* ── 2-4. 아코디언 상세 목록 ──
                    - isExpanded가 true일 때만 렌더링
                    - 일차별 카드: 썸네일 / Day N / 감정 이모지 / 소제목 / 위치
                    - 클릭 시 해당 Day로 상세 페이지 이동
                ── */}
                {isExpanded && (
                  <View className="bg-muted px-md pb-md pt-sm gap-sm">
                    {item.tripDays.map((detail) => (
                      <Pressable
                        key={detail.id}
                        className="flex-row items-center bg-surface p-sm rounded-md shadow-sm"
                        onPress={() => router.push({
                          pathname: '/detail',
                          params: {
                            id: item.id,
                            title: detail.subtitle,
                            location: detail.location_summary,
                            mainImage: detail.represent_image,
                            startDate: item.start_date,
                            endDate: item.end_date,
                            day: detail.day_number,
                            details: JSON.stringify(item.tripDays) // 상세 일기 배열을 문자열로 변환해서 전달
                          }
                        })}
                      >
                        {/* 일차 썸네일: 첫 번째 사진의 썸네일 이미지 */}
                        {detail.photos && detail.photos.length > 0 && (
                          <Image
                            source={{ uri: detail.photos[0].thumbnail_image_url }}
                            className="w-14 h-14 rounded-md mr-md"
                            resizeMode="cover"
                          />
                        )}

                        <View className="flex-1">
                          {/* Day 번호 + 감정 이모지 */}
                          <View className="flex-row items-center justify-between mb-xs w-full pr-sm">
                            <Text className="text-sm font-bold text-primary font-sans">
                              Day {detail.day_number}
                            </Text>
                            {/* 감정 이모지: detail.emotion이 있을 때만 표시 */}
                            <View style={{ width: 28, height: 28, flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
                              {detail.emotion && (
                                <EmojiIcon codepoint={detail.emotion} size={20} />
                              )}
                            </View>
                          </View>

                          {/* 소제목 (1줄 제한) */}
                          <Text className="text-md font-bold text-textPrimary font-sans mb-xs" numberOfLines={1}>
                            {detail.subtitle}
                          </Text>

                          {/* 세부 위치 */}
                          <View className="flex-row items-center gap-xs">
                            <MapPin size={10} color="#39536B" />
                            <Text className="text-sm text-textSecondary font-sans">
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
          })}
        </View>
      </ScrollView>

      {/* ── 섹션 3. FAB (플로팅 액션 버튼) ─────────────────
          - 우측 하단 고정 위치
          - 클릭 시 새 여행 추가 페이지(/add)로 이동
      ──────────────────────────────────────────────── */}
      <Pressable
        onPress={() => router.push('/add')}
        className="absolute right-md bg-fab w-14 h-14 rounded-full items-center justify-center shadow-lg"
        style={{ zIndex: 99, bottom: 125 }}
      >
        <Plus size={32} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>

      {/* ── 섹션 4. 하단 네비게이션 바 ─────────────────────
          - 홈 / 지도 / 설정 탭 이동
      ──────────────────────────────────────────────── */}
      <BottomNav />

    </View>
  );
}
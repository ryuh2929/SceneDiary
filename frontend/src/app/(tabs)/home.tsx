import React, { useState,useEffect } from 'react';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, ChevronDown, MapPin, Plus } from 'lucide-react-native';
import Twemoji from 'react-native-twemoji';
import BottomNav from '@/components/bottom-nav';
import { getTrips } from '@/api/home';
import { Trip } from '@/types/api';        // 💡 Trip 인터페이스 임포트


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

export default function HomeScreen() {
  const router = useRouter();
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [expandedId, setExpandedId] = useState<number|null>(null);

  // 1️⃣ 서버에서 받아올 대왕 알갱이(Trip) 수납함 만들기 (처음엔 빈손이니까 null)
  const [tripData, setTripData] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 3️⃣ 화면이 켜지자마자 API를 찌르는 파수꾼(useEffect) 배치
  useEffect(() => {
    const loadTripData = async () => {
      try {
        setIsLoading(true);   // 로딩 스피너 켜기
        setError(null);       // 에러 기록 초기화
        setTripData([]);
        // 💡 방금 만든 API 함수 호출!
        const data = await getTrips(currentYear);
        console.log("API 응답 데이터:", JSON.stringify(data, null, 2));
        setTripData(data);    // 받아온 데이터를 useState 수납함에 쏙 저장
      } catch (err) {
        setTripData([]);
        setError("여행 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);  // 성공하든 실패하든 로딩 스피너 끄기
      }
    };

    loadTripData();
  }, [currentYear]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View className="flex-1 bg-background">
      
        {/* 헤더 */}
        <View className="bg-surface pt-safe pb-md items-center border-b border-border shadow-sm">
          <Text className="text-xl font-logo text-logo mt-sm">SceneDiary</Text>
          <View className="flex-row items-center justify-center gap-xl mt-md">
            <Pressable onPress={() => setCurrentYear(prev => prev - 1)} className="p-xs">
              <ChevronLeft size={20} color="#39536B" />
            </Pressable>
            {/* 연도 */}
            <Text className="text-lg font-bold text-textPrimary font-sans">{currentYear}</Text>
            <Pressable onPress={() => setCurrentYear(prev => prev + 1)} className="p-xs">
              <ChevronRight size={20} color="#39536B" />
            </Pressable>
          </View>
        </View>
        
          <ScrollView
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 180 }}
          >
      
        {/* 여행 리스트 */}
        <View className="px-md mt-lg mb-md gap-lg">
          {tripData.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <View key={item.id} className="bg-surface rounded-lg overflow-hidden shadow-sm border border-border">

                {/* 메인 이미지 */}
                <Pressable className="relative h-60 w-full" 
                          onPress={() => router.push({ pathname: '/detail', 
                                  params: { id: item.id,
                                  title: item.title,
                                  location: item.destination,
                                  mainImage: item.cover_photo_id,
                                  startDate: item.start_date,
                                  endDate: item.end_date,
                                  symbol: "",
                                  details: JSON.stringify(item.tripDays)
                                } })
                                }
                  >
                  {/* <Image source={{ uri: item.cover_photo_id }} className="w-full h-full" resizeMode="cover" /> */}

                  {/* 날짜 뱃지 */}
                  <View className="absolute top-md left-md bg-muted rounded-md px-sm py-xs items-center shadow-sm">
                    <Text className="text-sm font-sans text-textPrimary">{item.start_date} ~ {item.end_date}</Text>
                  </View>

                  {/* 심볼 */} 
                <View className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/70 items-center justify-center overflow-hidden">
                  <View
                    style={{transform: [{ scale: 0.15 }, { translateY: 10 }]}}
                  >
                    {/* <EmojiIcon codepoint={symbol} size={28} /> */}
                  </View>
                                 
                </View>

                
                </Pressable>
                {/* 텍스트 정보 */}
                <View className="p-md">
                  <Text className="text-lg font-bold text-textPrimary mb-xs font-sans">{item.title}</Text>
                  <View className="flex-row items-center gap-xs">
                    <MapPin size={12} color="#39536B" />
                    <Text className="text-sm text-textSecondary font-sans">{item.destination}</Text>
                  </View>
                </View>

                {/* 아코디언 토글 */}
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
                      style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                    marginLeft: 2, }}
                    />
                  </Pressable>
                )}

                {/* 상세 항목 */}
                {isExpanded && (
                  <View className="bg-muted px-md pb-md pt-sm gap-sm">
                    {item.tripDays.map((detail) => (
                      <Pressable
                        key={detail.id}
                        className="flex-row items-center bg-surface p-sm rounded-md shadow-sm"
                        onPress={() => router.push({ pathname: '/detail', 
                                  params: { id: item.id,
                                  title: detail.subtitle,
                                  location: detail.location_summary,
                                  mainImage: detail.represent_image,
                                  startDate: item.start_date,
                                  endDate: item.end_date,
                                  symbol: detail.symbol,
                                  day: detail.day_number,
                                  details: JSON.stringify(item.tripDays)//상세 일기 배열 데이터를 문자열로 변환해서 보냄
                                 } })
                                }
                      >
                        {/* <Image source={{ uri: detail.represent_image }} className="w-14 h-14 rounded-md mr-md" resizeMode="cover" /> */}
                              <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-xs w-full pr-sm">
                                  {/* 왼쪽: Day 텍스트 */}
                                  <Text className="text-sm font-bold text-primary font-sans">Day {detail.day_number}</Text>
                                  
                                  {/* 오른쪽: 이모지 상자 */}
                                  <View 
                                    style={{
                                      width: 28,
                                      height: 28,
                                      flexDirection: "row",
                                      justifyContent: "center",
                                      alignItems: "center",
                                    }}
                                  >
                                <View
                                  style={{
                                    transform: [{ scale: 0.15 },
                                                { translateX: 0 },
                                                { translateY: 150 }
                                              ]
                                  }}
                                >
                                  <Twemoji>{detail.emotion}</Twemoji>
                                </View>
                              </View>

                          </View>
                          {/* 타이틀 및 위치 정보 */}
                          <Text className="text-md font-bold text-textPrimary font-sans mb-xs" numberOfLines={1}>
                            {detail.subtitle}
                          </Text>
                          <View className="flex-row items-center gap-xs">
                            <MapPin size={10} color="#39536B" />
                            <Text className="text-sm text-textSecondary font-sans">{detail.location_summary}</Text>
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

      {/* FAB */}
      <Pressable
        onPress={()=>router.push('/add')}
        className="absolute right-md bg-fab w-14 h-14 rounded-full items-center justify-center shadow-lg"
        style={{ zIndex: 99, bottom: 125 }}
      >
        <Plus size={32} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>

      <BottomNav />
    </View>
  );
}
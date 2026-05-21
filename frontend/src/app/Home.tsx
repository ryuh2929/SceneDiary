import React, { useState } from 'react';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, ChevronDown, MapPin, Plus } from 'lucide-react-native';
import Twemoji from 'react-native-twemoji';
import BottomNav from '@/components/bottom-nav';
import { BlurView } from 'expo-blur';

type DayDetail = {
  id: string;
  day: number;
  title: string;
  location: string;
  image: string;
  emoji: string;
};

type TravelCard = {
  id: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  mainImage: string;
  symbol: string;
  details: DayDetail[];
};

const travelData: TravelCard[] = [
  {
    id: '1',
    title: '도쿄 벚꽃 여행',
    location: '도쿄, 일본',
    startDate: '04.01',
    endDate: '04.03',
    mainImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e',
    symbol: '🌸',
    details: [
      { id: 'd1', day: 1, title: '벚꽃 아래에서', location: '우에노공원', emoji: '🌸', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e' },
      { id: 'd2', day: 2, title: '시부야의 밤', location: '시부야', emoji: '✨', image: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26' },
      { id: 'd3', day: 3, title: '신주쿠 교엔 산책', location: '신주쿠', emoji: '🌿', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e' },
    ],
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
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
            <Text className="text-lg font-bold text-textPrimary font-sans">{currentYear}</Text>
            <Pressable onPress={() => setCurrentYear(prev => prev + 1)} className="p-xs">
              <ChevronRight size={20} color="#39536B" />
            </Pressable>
          </View>
        </View>
          <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        >
        {/* 연도 레이블 */}
        <View className="px-md mt-lg mb-md">
          <Text className="text-md font-sans text-textSecondary">{currentYear}년의 여행</Text>
        </View>

        {/* 여행 리스트 */}
        <View className="px-md gap-lg">
          {travelData.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <View key={item.id} className="bg-surface rounded-lg overflow-hidden shadow-sm border border-border">

                {/* 메인 이미지 */}
                <Pressable className="relative h-60 w-full" onPress={() => router.push({ pathname: '/Detail' as any, params: { id: item.id } })}>
                  <Image source={{ uri: item.mainImage }} className="w-full h-full" resizeMode="cover" />

                  {/* 날짜 뱃지 */}
                  <View className="absolute top-md left-md bg-muted rounded-md px-sm py-xs items-center shadow-sm">
                    <Text className="text-sm font-sans text-textPrimary">{item.startDate} ~ {item.endDate}</Text>
                  </View>

                  {/* 심볼 */}
                  <View className="absolute top-md right-md bg-surface rounded-full w-10 h-10 items-center justify-center shadow-sm">
                    <Twemoji size={10}>{item.symbol}</Twemoji>
                  </View>
                

                {/* <BlurView
                  intensity={40}
                  tint="light"
                  className="
                    absolute
                    top-3
                    right-3
                    w-12
                    h-12
                    rounded-full
                    overflow-hidden
                    items-center
                    justify-center
                  "
                  style={{
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 5,
                  }}
                >
                  <Twemoji size={18}>
                    {item.symbol}
                  </Twemoji>
                </BlurView> */}
                </Pressable>
                {/* 텍스트 정보 */}
                <View className="p-md">
                  <Text className="text-lg font-bold text-textPrimary mb-xs font-sans">{item.title}</Text>
                  <View className="flex-row items-center gap-xs">
                    <MapPin size={12} color="#39536B" />
                    <Text className="text-sm text-textSecondary font-sans">{item.location}</Text>
                  </View>
                </View>

                {/* 아코디언 토글 */}
                {item.details.length > 0 && (
                  <Pressable
                    onPress={() => toggleExpand(item.id)}
                    className={
                      "w-full flex-row items-center justify-center py-sm gap-xs border-t border-border " +
                      (isExpanded ? "bg-muted" : "bg-surface")
                    }
                  >
                    <Text className="text-sm text-primary font-sans">
                      {isExpanded ? '접기' : `여행 상세 (${item.details.length}일)`}
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
                    {item.details.map((detail) => (
                      <Pressable
                        key={detail.id}
                        className="flex-row items-center bg-surface p-sm rounded-md shadow-sm"
                        onPress={() => router.push({ pathname: '/Detail' as any, params: { id: item.id, day: detail.day } })}
                      >
                        <Image source={{ uri: detail.image }} className="w-14 h-14 rounded-md mr-md" resizeMode="cover" />
                        <View className="flex-1">
                          <View className="flex-row items-center gap-xs mb-xs">
                            <Text className="text-sm font-bold text-primary font-sans">Day {detail.day}</Text>
                            <Twemoji size={10}>{detail.emoji}</Twemoji>
                          </View>
                          <Text className="text-md font-bold text-textPrimary font-sans mb-xs" numberOfLines={1}>
                            {detail.title}
                          </Text>
                          <View className="flex-row items-center gap-xs">
                            <MapPin size={10} color="#39536B" />
                            <Text className="text-sm text-textSecondary font-sans">{detail.location}</Text>
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
        className="absolute bottom-24 right-md bg-fab w-14 h-14 rounded-full items-center justify-center shadow-lg"
        style={{ zIndex: 99 }}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>

      <BottomNav />
    </View>
  );
}
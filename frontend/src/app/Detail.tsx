import React, { useState } from 'react';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { X, MapPin, Calendar, Plus } from 'lucide-react-native';
import Twemoji from 'react-native-twemoji';

export default function TravelDetailUI() {
  const router = useRouter();
  //1. 홈에서 보낸 대량의 파라미터들을 가져옵니다.
  const { id, day, title, location, mainImage, startDate, endDate, symbol, details } = useLocalSearchParams<{
    id: string;
    day: string;
    title: string;
    location: string;
    mainImage: string;
    startDate: string;
    endDate: string;
    symbol: string;
    details: string; 
  }>();

  //2. 문자열로 압축되어 온 details 데이터를 진짜 쓸 수 있게 배열로 해제합니다.
  const parsedDetails = details ? JSON.parse(details) : [];

  // 홈에서 특정 Day를 누르고 들어왔으면 그 Day로 시작하고, 아니면 Day 1로 시작
  const [activeDay, setActiveDay] = useState(Number(day) || 1);

  //3. [중요] 전체 상세 데이터 중 '현재 활성화된 Day 탭'에 해당하는 데이터만 찾아냅니다!
  const currentDayData = parsedDetails.find((d: any) => Number(d.day) === activeDay);

  //4. 생성할 탭 목록 배열 자동 생성 (예: 데이터가 3개면 [1, 2, 3] 탭이 생김)
  const dayTabs = parsedDetails.map((d: any) => Number(d.day)).sort((a: number, b: number) => a - b);

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false} bounces={false}>

      {/* 상단 히어로 이미지 */}
      <View className="relative h-80 w-full">
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e' }}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />

        {/* 그라데이션 오버레이 */}
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'transparent', '#F4F6F9']}
          locations={[0, 0.5, 1]}
          className="absolute inset-0 p-md"
        >
          {/* 닫기 버튼 */}
          <View className="flex-row justify-end pt-safe">
            <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-black/30 items-center justify-center">
              <X size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* 타이틀 정보 */}
          <View className="absolute bottom-lg left-md">
            <Text className="text-xl font-sans font-bold text-textPrimary mb-sm">
              {title || '여행 정보'}
            </Text>
            <View className="flex-row items-center gap-md">
              <View className="flex-row items-center gap-xs">
                <MapPin size={14} color="#39536B" />
                <Text className="text-sm font-sans text-textSecondary">{location || '위치 미정'}</Text>
              </View>
              <View className="flex-row items-center gap-xs">
                <Calendar size={14} color="#39536B" />
                <Text className="text-sm font-sans text-textSecondary">
                  {startDate && endDate ? `${startDate.replaceAll('-', '.')} ~ ${endDate.replaceAll('-', '.')}`
                  : startDate || '날짜 미정'}</Text>
              </View>
              {symbol && (
                  <View
                    style={{
                      transform: [
                        { scale: 0.50 }, 
                        { translateY: 10 } 
                      ]
                    }}
                    className="w-10 h-10 rounded-full bg-white/70 items-center justify-center overflow-hidden"
                  >
                    <Twemoji>{symbol}</Twemoji>
                  </View>
                )}
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Day 탭 */}
      <View className="flex-row items-end px-md mt-sm">
        {(dayTabs.length > 0 ? dayTabs : [1]).map((d: number)=> (
          <Pressable
            key={d}
            onPress={() => setActiveDay(d)}
            className={`px-md py-xs rounded-t-lg shadow-sm ${activeDay === d ? 'bg-primary' : 'bg-muted'}`}
          >
            <Text className={`font-logo text-xl ${activeDay === d ? 'text-white' : 'text-textSecondary'}`}>Day {d}</Text>
          </Pressable>
        ))}
        <Pressable className="w-10 h-10 rounded-t-lg border border-border bg-surface items-center justify-center">
          <Plus size={20} color="#A9C3E6" />
        </Pressable>
      </View>

      {/* 메인 콘텐츠 카드 */}
      <View className="px-md mt-xs pb-xl">
        <View className="bg-surface rounded-lg p-md shadow-sm border border-border">

          {/* 소제목 & 감정 이모지 */}
          <View className="flex-row justify-between items-center mb-sm w-full">
            <Text className="text-lg font-bold text-textPrimary font-sans mb-xs" numberOfLines={1}>
          {currentDayData?.title || '벚꽃 아래에서'}
            </Text>
            {/* 오른쪽: 홈 화면 방식의 이모지 상자 스타일 그대로 적용 */}
          <View 
            style={{
              width: 28,
              height: 28,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {currentDayData?.emoji && (
              <View
                style={{
                  transform: [
                    { scale: 0.15 },
                    { translateX: 0 },
                    { translateY: 150 }
                  ]
                }}
              >
                <Twemoji>{currentDayData.emoji}</Twemoji>
              </View>
            )}
          </View>
        </View>


        {/* 📍 세부 위치 정보 연동 */}
        <View className="flex-row items-center gap-xs">
          <MapPin size={10} color="#39536B" />
          <Text className="text-sm text-textSecondary font-sans">
            {currentDayData?.location || '위치 정보 없음'}
          </Text>
          
           {/* 날짜 & 날씨 */}
            <Text className="text-sm text-textSecondary font-sans">2026-04-01</Text>
            <View className="flex-row items-center gap-xs bg-accent px-sm py-xs rounded-full">
              <Twemoji size={14}>☀️</Twemoji>
              <Text className="text-sm text-textSecondary font-sans font-bold">맑음</Text>
            </View>
          </View>

         
          {/* 본문 사진 */}
          <Image
            source={{ uri: currentDayData?.image || mainImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e' }}
            className="w-full h-60 rounded-lg mb-md"
            resizeMode="cover"
          />

          {/* 일기 텍스트 */}
          <View className="bg-muted p-md rounded-md border border-border">
            <Text className="text-textSecondary text-md font-sans">
              도쿄의 봄은 분홍빛이었다. 우에노공원 벚꽃 터널을 걸으며 꽃잎이 어깨 위에 내려앉았다.
              벤치에 앉아 도시락을 먹으며 하나미를 즐겼다. 일본의 봄은 정말 특별하다.
            </Text>
          </View>

        </View>
      </View>

    </ScrollView>
  );
}

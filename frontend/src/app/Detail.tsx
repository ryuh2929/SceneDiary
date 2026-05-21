import React, { useState } from 'react';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { X, MapPin, Calendar, Plus } from 'lucide-react-native';
import Twemoji from 'react-native-twemoji';

export default function TravelDetailUI() {
  const router = useRouter();
  const { day } = useLocalSearchParams<{ id: string; day: string }>();
  const [activeDay, setActiveDay] = useState(Number(day) || 1);

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
              도쿄 벚꽃 여행
            </Text>
            <View className="flex-row items-center gap-md">
              <View className="flex-row items-center gap-xs">
                <MapPin size={14} color="#39536B" />
                <Text className="text-sm font-sans text-textSecondary">도쿄, 일본</Text>
              </View>
              <View className="flex-row items-center gap-xs">
                <Calendar size={14} color="#39536B" />
                <Text className="text-sm font-sans text-textSecondary">2026.04.01</Text>
              </View>
              <Twemoji size={18}>🌸</Twemoji>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Day 탭 */}
      <View className="flex-row items-end px-md mt-sm">
        {[1, 2].map(d => (
          <Pressable
            key={d}
            onPress={() => setActiveDay(d)}
            className={`px-lg py-sm rounded-t-lg mr-sm shadow-sm ${activeDay === d ? 'bg-primary' : 'bg-muted'}`}
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
          <View className="flex-row justify-between items-center mb-sm">
            <Text className="text-xl font-bold text-textPrimary font-sans">
              {activeDay === 1 ? '벚꽃 아래에서' : '시부야의 밤'}
            </Text>
            <Twemoji size={28}>{activeDay === 1 ? '🌸' : '✨'}</Twemoji>
          </View>

          {/* 날짜 & 날씨 */}
          <View className="flex-row items-center gap-sm mb-md">
            <Text className="text-sm text-textSecondary font-sans">2026-04-01</Text>
            <View className="flex-row items-center gap-xs bg-accent px-sm py-xs rounded-full">
              <Twemoji size={14}>☀️</Twemoji>
              <Text className="text-sm text-textSecondary font-sans font-bold">맑음</Text>
            </View>
          </View>

          {/* 본문 사진 */}
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e' }}
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

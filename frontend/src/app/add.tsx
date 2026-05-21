import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Camera, ChevronLeft, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PendingPhoto = {
  id: string;
  uri: string;
};

const colors = {
  primary: '#5B7DBB',
  primaryLight: '#A9C3E6',
  accent: '#F6D9A6',
  background: '#F4F6F9',
  surface: '#FFFFFF',
  textPrimary: '#152538',
  textSecondary: '#39536B',
  textOnPrimary: '#FFFFFF',
  border: '#A9C3E6',
  muted: '#E8EDF5',
};

const samplePhotos: PendingPhoto[] = [
  {
    id: 'lake-town',
    uri: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
  },
  {
    id: 'travel-meal',
    uri: 'https://images.unsplash.com/photo-1544025162-d76694265947',
  },
  {
    id: 'grill-food',
    uri: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba',
  },
];

export default function AddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>(samplePhotos);
  // 웹에서도 모바일 화면 폭을 기준으로 UI가 과하게 늘어나지 않도록 최대 너비를 제한합니다.
  const screenWidth = Math.min(width, 420);
  // 3열 그리드 간격을 고려해 사진 타일 크기를 계산합니다.
  const tileSize = Math.max(88, Math.floor((screenWidth - 48 - 32) / 3));

  const nextSamplePhoto = useMemo(() => {
    // 실제 파일 선택 기능 연결 전까지는 중복되지 않은 샘플 이미지만 추가합니다.
    return samplePhotos.find((photo) => !pendingPhotos.some((current) => current.id === photo.id));
  }, [pendingPhotos]);

  const addSamplePhoto = () => {
    if (!nextSamplePhoto) {
      return;
    }

    setPendingPhotos((current) => [...current, nextSamplePhoto]);
  };

  const removePhoto = (photoId: string) => {
    setPendingPhotos((current) => current.filter((photo) => photo.id !== photoId));
  };

  const moveToAnalysis = () => {
    if (pendingPhotos.length === 0) {
      return;
    }

    // 이후 실제 분석 API 연결 시 사진 데이터를 넘기는 흐름으로 확장할 예정입니다.
    router.push('/loading');
  };

  return (
    <View className="flex-1 items-center bg-background">
      <View
        className="w-full max-w-[420px] flex-1 bg-surface"
        style={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom,
        }}>
        <View className="flex-row items-center justify-between px-lg pb-lg">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 화면으로 돌아가기"
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full">
            <ChevronLeft size={24} color={colors.textSecondary} />
          </Pressable>

          <Text className="text-lg font-bold text-primary">새로운 장면</Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-lg pb-xl"
          showsVerticalScrollIndicator={false}>
          <View className="mb-xl">
            <Text className="text-xl font-bold leading-8 text-textPrimary">
              여행의 순간을 올려주세요
            </Text>
            <Text className="mt-sm text-md leading-6 text-textSecondary">
              사진이나 영상을 선택하면 AI가 당신의 이야기를 만들어드립니다.
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 추가"
              onPress={addSamplePhoto}
              disabled={!nextSamplePhoto}
              className={`items-center justify-center rounded-lg border-2 border-dashed ${
                nextSamplePhoto ? 'border-border bg-surface' : 'border-muted bg-muted'
              }`}
              style={{ width: tileSize, height: tileSize }}>
              {/* 실제 이미지 선택 API 연결 전까지는 샘플 사진을 추가해 화면 상태를 확인합니다. */}
              <Camera size={24} color={nextSamplePhoto ? colors.primaryLight : colors.border} />
              <Text className="mt-xs text-sm font-bold text-textSecondary">사진 추가</Text>
            </Pressable>

            {pendingPhotos.map((photo) => (
              <View
                key={photo.id}
                className="overflow-hidden rounded-lg bg-muted"
                style={{ width: tileSize, height: tileSize }}>
                <Image source={{ uri: photo.uri }} className="h-full w-full" resizeMode="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="사진 삭제"
                  onPress={() => removePhoto(photo.id)}
                  className="absolute right-xs top-xs h-6 w-6 items-center justify-center rounded-full bg-textPrimary/70">
                  <X size={14} color={colors.textOnPrimary} />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>

        <View className="border-t border-muted bg-surface px-lg pb-md pt-md">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="AI로 일기 작성하기"
            disabled={pendingPhotos.length === 0}
            onPress={moveToAnalysis}
            className="overflow-hidden rounded-lg"
            style={{
              opacity: pendingPhotos.length === 0 ? 0.55 : 1,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: pendingPhotos.length === 0 ? 0 : 0.16,
              shadowRadius: 16,
              elevation: pendingPhotos.length === 0 ? 0 : 4,
            }}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="items-center justify-center py-md">
              <Text className="text-md font-extrabold text-textOnPrimary">AI로 일기 작성하기</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

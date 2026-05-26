import { LinearGradient } from 'expo-linear-gradient';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, ChevronLeft, ImagePlus, Loader2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PendingPhoto = {
  id: string;
  fileUri: string;
  thumbnailUri: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes?: number;
  width: number;
  height: number;
  displayOrder: number;
};

type LoadingPhotoParam = Pick<
  PendingPhoto,
  'fileUri' | 'thumbnailUri' | 'originalFilename' | 'mimeType' | 'fileSizeBytes' | 'width' | 'height' | 'displayOrder'
>;

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

const MAX_IMAGE_SIZE = 1024;
const THUMBNAIL_SIZE = 240;

function resizeAction(width: number, height: number, maxSize: number) {
  if (width >= height) {
    return { resize: { width: Math.min(width, maxSize) } };
  }

  return { resize: { height: Math.min(height, maxSize) } };
}

async function getFileSizeBytes(uri: string) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return undefined;
  }
}

async function buildPendingPhoto(asset: ImagePicker.ImagePickerAsset, displayOrder: number): Promise<PendingPhoto> {
  const fileImage = await ImageManipulator.manipulateAsync(
    asset.uri,
    [resizeAction(asset.width, asset.height, MAX_IMAGE_SIZE)],
    {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  const thumbnail = await ImageManipulator.manipulateAsync(
    fileImage.uri,
    [resizeAction(fileImage.width, fileImage.height, THUMBNAIL_SIZE)],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  const fileSizeBytes = await getFileSizeBytes(fileImage.uri);

  return {
    id: `${Date.now()}-${displayOrder}-${asset.assetId ?? asset.fileName ?? asset.uri}`,
    fileUri: fileImage.uri,
    thumbnailUri: thumbnail.uri,
    originalFilename: asset.fileName ?? `photo-${displayOrder + 1}.jpg`,
    mimeType: 'image/jpeg',
    fileSizeBytes,
    width: fileImage.width,
    height: fileImage.height,
    displayOrder,
  };
}

export default function AddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const contentWidth = Math.min(width, 760);
  const columnCount = contentWidth >= 700 ? 4 : 3;
  const tileSize = Math.max(88, Math.floor((contentWidth - 48 - (columnCount - 1) * 16) / columnCount));
  const bottomInset = Math.max(insets.bottom, 16);

  const pickPhotos = async () => {
    if (isPreparing) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '여행 사진을 고르려면 사진 보관함 접근을 허용해 주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,
    });

    if (result.canceled) {
      return;
    }

    setIsPreparing(true);
    try {
      const startOrder = pendingPhotos.length;
      const processedPhotos = await Promise.all(
        result.assets.map((asset, index) => buildPendingPhoto(asset, startOrder + index)),
      );
      setPendingPhotos((current) => [...current, ...processedPhotos]);
    } catch {
      Alert.alert('사진을 준비하지 못했어요', '다시 선택해 주세요.');
    } finally {
      setIsPreparing(false);
    }
  };

  const removePhoto = (photoId: string) => {
    setPendingPhotos((current) =>
      current
        .filter((photo) => photo.id !== photoId)
        .map((photo, index) => ({ ...photo, displayOrder: index })),
    );
  };

  const moveToAnalysis = () => {
    if (pendingPhotos.length === 0 || isPreparing) {
      return;
    }

    const photos: LoadingPhotoParam[] = pendingPhotos.map(
      ({ fileUri, thumbnailUri, originalFilename, mimeType, fileSizeBytes, width, height, displayOrder }) => ({
        fileUri,
        thumbnailUri,
        originalFilename,
        mimeType,
        fileSizeBytes,
        width,
        height,
        displayOrder,
      }),
    );

    router.push({
      pathname: '/loading',
      params: { photos: encodeURIComponent(JSON.stringify(photos)) },
    });
  };

  return (
    <View className="flex-1 items-center bg-background">
      <View
        className="w-full max-w-[760px] flex-1 bg-surface"
        style={{
          paddingTop: insets.top + 14,
          paddingBottom: bottomInset,
        }}>
        <View className="flex-row items-center justify-between px-lg pb-lg">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 화면으로 돌아가기"
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full">
            <ChevronLeft size={24} color={colors.textSecondary} />
          </Pressable>

          <Text className="text-lg font-bold text-primary">새 기록</Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-lg pb-xl"
          showsVerticalScrollIndicator={false}>
          <View className="mb-xl">
            <Text className="text-xl font-bold leading-8 text-textPrimary">
              1일차 사진을 골라주세요
            </Text>
            <Text className="mt-sm text-md leading-6 text-textSecondary">
              선택한 사진은 1024px 기준으로 줄이고, 글 작성 화면용 썸네일을 따로 준비해요.
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 추가"
              onPress={pickPhotos}
              disabled={isPreparing}
              className={`items-center justify-center rounded-lg border-2 border-dashed ${
                isPreparing ? 'border-muted bg-muted' : 'border-border bg-surface'
              }`}
              style={{ width: tileSize, height: tileSize }}>
              {isPreparing ? (
                <Loader2 size={24} color={colors.border} />
              ) : (
                <Camera size={24} color={colors.primaryLight} />
              )}
              <Text className="mt-xs text-sm font-bold text-textSecondary">
                {isPreparing ? '준비 중' : '사진 추가'}
              </Text>
            </Pressable>

            {pendingPhotos.map((photo) => (
              <View
                key={photo.id}
                className="overflow-hidden rounded-lg bg-muted"
                style={{ width: tileSize, height: tileSize }}>
                <Image source={{ uri: photo.thumbnailUri }} className="h-full w-full" resizeMode="cover" />
                <View className="absolute bottom-xs left-xs rounded-md bg-textPrimary/70 px-xs py-[2px]">
                  <Text className="text-xs font-bold text-textOnPrimary">{photo.displayOrder + 1}</Text>
                </View>
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

          {pendingPhotos.length === 0 ? (
            <View className="mt-2xl items-center rounded-lg bg-muted px-lg py-xl">
              <ImagePlus size={30} color={colors.primaryLight} />
              <Text className="mt-sm text-center text-sm font-bold text-textSecondary">
                사진을 여러 장 선택하면 여기에서 순서대로 확인할 수 있어요.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View className="items-center bg-surface px-lg pb-md pt-md">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="AI로 일기 작성하기"
            disabled={pendingPhotos.length === 0 || isPreparing}
            onPress={moveToAnalysis}
            className="w-full max-w-[360px] overflow-hidden rounded-lg"
            style={{
              opacity: pendingPhotos.length === 0 || isPreparing ? 0.55 : 1,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: pendingPhotos.length === 0 || isPreparing ? 0 : 0.16,
              shadowRadius: 16,
              elevation: pendingPhotos.length === 0 || isPreparing ? 0 : 4,
            }}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-14 items-center justify-center">
              <Text className="text-md font-extrabold text-textOnPrimary">
                {pendingPhotos.length > 0 ? `${pendingPhotos.length}장으로 일기 작성하기` : 'AI로 일기 작성하기'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

import { LinearGradient } from 'expo-linear-gradient';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronLeft, ImagePlus, Loader2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { uploadFirstDayPhotos } from '@/api/diary';

type PendingPhoto = {
  id: string;
  fileUri: string;
  thumbnailUri: string;
  originalFilename: string;
  mimeType: string;
  takenDate?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
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
const THUMBNAIL_SIZE = 256;
const MAX_PHOTO_COUNT = 10;

// 원본 비율을 유지하면서 긴 변만 기준 크기 이하로 줄입니다.
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

function parseExifTakenDate(exif: Record<string, unknown> | null | undefined): string | undefined {
  if (!exif) {
    return undefined;
  }

  const dateCandidates = [
    exif.SubSecDateTimeOriginal,
    exif.CompositeSubSecDateTimeOriginal,
    exif['Composite:SubSecDateTimeOriginal'],
    exif.TimeStamp,
    exif.SamsungTimeStamp,
    exif['Samsung:TimeStamp'],
    exif.DateTimeOriginal,
    exif.DateTimeDigitized,
    exif.DateTime,
    exif.CreateDate,
    exif.ModifyDate,
  ];

  const rawDate = dateCandidates.find((value) => typeof value === 'string');
  const match = typeof rawDate === 'string' ? rawDate.match(/^(20\d{2})[:/-](\d{2})[:/-](\d{2})/) : null;
  if (!match) {
    return undefined;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseGpsCoordinateValue(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const rationalMatch = value.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    const parsed = rationalMatch
      ? Number(rationalMatch[1]) / Number(rationalMatch[2])
      : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value && typeof value === 'object' && 'numerator' in value && 'denominator' in value) {
    const rational = value as { numerator: unknown; denominator: unknown };
    const numerator = parseGpsCoordinateValue(rational.numerator);
    const denominator = parseGpsCoordinateValue(rational.denominator);
    if (numerator == null || !denominator) return undefined;
    return numerator / denominator;
  }
  if (Array.isArray(value) && value.length === 3) {
    const [degrees, minutes, seconds] = value.map(parseGpsCoordinateValue);
    if (degrees == null || minutes == null || seconds == null) return undefined;
    return degrees + minutes / 60 + seconds / 3600;
  }
  return undefined;
}

function parseExifGps(exif: Record<string, unknown> | null | undefined): { latitude: number; longitude: number } | undefined {
  if (!exif) return undefined;

  const lat = exif.GPSLatitude ?? exif['GPS:GPSLatitude'];
  const lon = exif.GPSLongitude ?? exif['GPS:GPSLongitude'];
  const latRef = String(exif.GPSLatitudeRef ?? exif['GPS:GPSLatitudeRef'] ?? 'N').toUpperCase();
  const lonRef = String(exif.GPSLongitudeRef ?? exif['GPS:GPSLongitudeRef'] ?? 'E').toUpperCase();

  const latitude = parseGpsCoordinateValue(lat);
  const longitude = parseGpsCoordinateValue(lon);
  if (latitude === undefined || longitude === undefined) return undefined;

  const signedLat = latRef.startsWith('S') ? -Math.abs(latitude) : Math.abs(latitude);
  const signedLon = lonRef.startsWith('W') ? -Math.abs(longitude) : Math.abs(longitude);

  if (signedLat === 0 && signedLon === 0) return undefined;
  if (Math.abs(signedLat) > 90 || Math.abs(signedLon) > 180) return undefined;

  return { latitude: signedLat, longitude: signedLon };
}

function parseFilenameDate(filename: string | null | undefined): string | undefined {
  if (!filename) {
    return undefined;
  }

  const match = filename.match(/(20\d{2})[-_. ]?(\d{2})[-_. ]?(\d{2})/);
  if (!match) {
    return undefined;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function getSelectedDates(photos: PendingPhoto[]) {
  return Array.from(new Set(photos.map((photo) => photo.takenDate).filter(Boolean) as string[])).sort();
}

function formatDisplayDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-');
  return `${year}.${month}.${day}`;
}

function getPhotoHeading(selectedDates: string[], targetDayNumber?: number) {
  if (targetDayNumber) {
    return `${targetDayNumber}일차 여행 사진을 골라주세요`;
  }

  if (selectedDates.length === 0) {
    return '여행 사진을 골라주세요';
  }

  if (selectedDates.length === 1) {
    return `${formatDisplayDate(selectedDates[0])} 사진을 골라주세요`;
  }

  return `총 ${selectedDates.length}일치 사진을 골라주세요`;
}

function getPhotoDescription(selectedDates: string[]) {
  if (selectedDates.length <= 1) {
    return '최대 10장까지 선택할 수 있고, 글 작성 화면용 썸네일을 따로 준비해요.';
  }

  return '선택한 사진은 촬영일 기준으로 나뉘어 각 날짜의 일기로 준비돼요.';
}

function getPhotoDayLabel(photo: PendingPhoto, selectedDates: string[]) {
  if (!photo.takenDate || selectedDates.length <= 1) {
    return String(photo.displayOrder + 1);
  }

  const dayIndex = selectedDates.indexOf(photo.takenDate);
  return dayIndex >= 0 ? `${dayIndex + 1}일차` : String(photo.displayOrder + 1);
}

async function buildPendingPhoto(asset: ImagePicker.ImagePickerAsset, displayOrder: number): Promise<PendingPhoto> {
  // 리사이즈하면 EXIF가 사라지므로, 원본 asset에서 GPS를 먼저 읽습니다.
  const gps = parseExifGps(asset.exif);
  // AI 분석용 이미지는 너무 커지지 않게 줄이고, 화면 미리보기용 썸네일은 별도로 생성합니다.
  const fileImage = await ImageManipulator.manipulateAsync(
    asset.uri,
    [resizeAction(asset.width, asset.height, MAX_IMAGE_SIZE)],
    {
      compress: 0.85,
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
    takenDate: parseExifTakenDate(asset.exif) ?? parseFilenameDate(asset.fileName),
    gpsLatitude: gps?.latitude,
    gpsLongitude: gps?.longitude,
    fileSizeBytes,
    width: fileImage.width,
    height: fileImage.height,
    displayOrder,
  };
}

export default function AddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trip_id?: string; day_number?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const contentWidth = Math.min(width, 760);
  const columnCount = contentWidth >= 700 ? 4 : 3;
  const tileSize = Math.max(88, Math.floor((contentWidth - 48 - (columnCount - 1) * 16) / columnCount));
  const bottomInset = Math.max(insets.bottom, 16);
  const isPhotoLimitReached = pendingPhotos.length >= MAX_PHOTO_COUNT;
  const targetTripId = typeof params.trip_id === 'string' ? params.trip_id : undefined;
  const targetDayNumber = Number(params.day_number);
  const displayDayNumber = Number.isFinite(targetDayNumber) && targetDayNumber > 0 ? targetDayNumber : undefined;
  const selectedDates = getSelectedDates(pendingPhotos);
  const photoHeading = getPhotoHeading(selectedDates, displayDayNumber);
  const photoDescription = getPhotoDescription(selectedDates);

  const pickPhotos = async () => {
    if (isPreparing || isUploading) {
      return;
    }

    const remainingSlots = MAX_PHOTO_COUNT - pendingPhotos.length;
    if (remainingSlots <= 0) {
      Alert.alert('사진은 최대 10장까지 가능해요', '선택한 사진을 삭제한 뒤 다시 추가해 주세요.');
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
      selectionLimit: remainingSlots,
      quality: 1,
      exif: true,
      // Android 기본 Photo Picker는 GPS EXIF를 0으로 마스킹하는 경우가 있어 legacy picker를 사용합니다.
      legacy: Platform.OS === 'android',
    });

    if (result.canceled) {
      return;
    }

    setIsPreparing(true);
    try {
      const startOrder = pendingPhotos.length;
      const selectedAssets = result.assets.slice(0, remainingSlots);
      const processedPhotos = await Promise.all(
        selectedAssets.map((asset, index) => buildPendingPhoto(asset, startOrder + index)),
      );
      setPendingPhotos((current) => [...current, ...processedPhotos]);
      if (result.assets.length > remainingSlots) {
        Alert.alert('사진은 최대 10장까지 가능해요', `이번에는 ${remainingSlots}장만 추가했어요.`);
      }
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

  const moveToAnalysis = async () => {
    if (pendingPhotos.length === 0 || isPreparing || isUploading) {
      return;
    }

    setIsUploading(true);
    try {
      const uploadResponse = await uploadFirstDayPhotos(pendingPhotos, {
        tripId: targetTripId,
        dayNumber: displayDayNumber,
      });
      const photos: LoadingPhotoParam[] = uploadResponse.photos.map((photo) => ({
        fileUri: photo.fileUrl,
        thumbnailUri: photo.thumbnailUrl,
        originalFilename: photo.originalFilename ?? `photo-${photo.displayOrder + 1}.jpg`,
        mimeType: photo.mimeType ?? 'image/jpeg',
        fileSizeBytes: photo.fileSizeBytes ?? undefined,
        width: photo.width ?? 0,
        height: photo.height ?? 0,
        displayOrder: photo.displayOrder,
      }));

      router.push({
        pathname: '/loading',
        params: {
          photos: encodeURIComponent(JSON.stringify(photos)),
          tripId: String(uploadResponse.tripId),
          tripDayId: String(uploadResponse.tripDayId),
          day: String(uploadResponse.day),
          mode: 'initial',
          days: encodeURIComponent(JSON.stringify(uploadResponse.days)),
        },
      });
    } catch {
      Alert.alert('사진 업로드에 실패했어요', '서버 연결 상태를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setIsUploading(false);
    }
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

          <Text className="text-lg font-sans-bold text-primary">사진 추가</Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-lg pb-xl"
          showsVerticalScrollIndicator={false}>
          <View className="mb-xl">
            <Text className="text-xl font-sans-bold leading-8 text-textPrimary">
              {photoHeading}
            </Text>
            <Text className="mt-sm text-md leading-6 text-textSecondary">
              {photoDescription}
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 추가"
              onPress={pickPhotos}
              disabled={isPreparing || isUploading || isPhotoLimitReached}
              className={`items-center justify-center rounded-lg border-2 border-dashed ${
                isPreparing || isUploading || isPhotoLimitReached ? 'border-muted bg-muted' : 'border-border bg-surface'
              }`}
              style={{ width: tileSize, height: tileSize }}>
              {isPreparing ? (
                <Loader2 size={24} color={colors.border} />
              ) : (
                <Camera size={24} color={isPhotoLimitReached ? colors.border : colors.primaryLight} />
              )}
              <Text className="mt-xs text-sm font-sans-bold text-textSecondary">
                {isPreparing ? '준비 중' : isPhotoLimitReached ? '최대 10장' : '사진 추가'}
              </Text>
            </Pressable>

            {pendingPhotos.map((photo) => (
              <View
                key={photo.id}
                className="overflow-hidden rounded-lg bg-muted"
                style={{ width: tileSize, height: tileSize }}>
                <Image source={{ uri: photo.thumbnailUri }} className="h-full w-full" resizeMode="cover" />
                <View className="absolute bottom-xs left-xs rounded-md bg-textPrimary/70 px-xs py-[2px]">
                  <Text className="text-xs font-sans-bold text-textOnPrimary">{getPhotoDayLabel(photo, selectedDates)}</Text>
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
              <Text className="mt-sm text-center text-sm font-sans-bold text-textSecondary">
                사진을 여러 장 선택하면 여기에서 순서대로 확인할 수 있어요.
              </Text>
            </View>
          ) : (
            <Text className="mt-lg text-center text-sm font-sans-bold text-textSecondary">
              {pendingPhotos.length}/{MAX_PHOTO_COUNT}장 선택됨
            </Text>
          )}
        </ScrollView>

        <View className="items-center bg-surface px-lg pb-md pt-md">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="AI로 일기 작성하기"
            disabled={pendingPhotos.length === 0 || isPreparing || isUploading}
            onPress={moveToAnalysis}
            className="w-full max-w-[360px] overflow-hidden rounded-lg"
            style={{
              opacity: pendingPhotos.length === 0 || isPreparing || isUploading ? 0.55 : 1,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: pendingPhotos.length === 0 || isPreparing || isUploading ? 0 : 0.16,
              shadowRadius: 16,
              elevation: pendingPhotos.length === 0 || isPreparing || isUploading ? 0 : 4,
            }}>
            <LinearGradient
              colors={[colors.primary, colors.primaryLight, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-14 items-center justify-center">
              <Text className="text-md font-sans-bold text-textOnPrimary">
                {isUploading
                  ? '사진 업로드 중'
                  : pendingPhotos.length > 0
                    ? `${pendingPhotos.length}장으로 일기 작성하기`
                    : 'AI로 일기 작성하기'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

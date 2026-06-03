import { LinearGradient } from 'expo-linear-gradient';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { PermissionsAndroid } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronLeft, ImagePlus, Loader2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { uploadFirstDayPhotos } from '@/api/diary';
import { useAppThemeColors } from '@/constants/app-colors';

type PendingPhoto = {
  id: string;
  fileUri: string;
  thumbnailUri: string;
  originalFilename: string;
  mimeType: string;
  takenDate?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  // GPS 좌표를 OS 지오코딩으로 변환한 지명. 백엔드에서 trip_days.location_summary,
  // trips.destination 자동 채우기에 사용됩니다. 권한·네트워크 실패 시 undefined.
  placeName?: string;       // 일차 대표 지명 (district 우선)
  countryName?: string;     // 국가명 — trip destination "국가/도시" 의 앞부분
  cityName?: string;        // 도시명 — trip destination "국가/도시" 의 뒷부분
  fileSizeBytes?: number;
  width: number;
  height: number;
  displayOrder: number;
};

type LoadingPhotoParam = Pick<
  PendingPhoto,
  'fileUri' | 'thumbnailUri' | 'originalFilename' | 'mimeType' | 'fileSizeBytes' | 'width' | 'height' | 'displayOrder'
>;

const MAX_IMAGE_SIZE = 1024;
const THUMBNAIL_SIZE = 256;
const MAX_PHOTOS_PER_DAY = 8;
const MAX_PHOTO_SELECTION_BATCH = 80;
const PHOTO_PROCESSING_CONCURRENCY = 2;

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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = [];

  for (let start = 0; start < items.length; start += concurrency) {
    const batch = items.slice(start, start + concurrency);
    const batchResults = await Promise.all(batch.map((item, index) => mapper(item, start + index)));
    results.push(...batchResults);
  }

  return results;
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

function getPhotoDateKey(photo: PendingPhoto) {
  return photo.takenDate ?? '__unknown_date__';
}

function getDailyPhotoCounts(photos: PendingPhoto[]) {
  return photos.reduce<Record<string, number>>((counts, photo) => {
    const key = getPhotoDateKey(photo);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
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
    return `하루에 최대 ${MAX_PHOTOS_PER_DAY}장까지 선택할 수 있고, 글 작성 화면용 썸네일을 따로 준비해요.`;
  }

  return `선택한 사진은 촬영일 기준으로 나뉘고, 일차별 최대 ${MAX_PHOTOS_PER_DAY}장까지 준비돼요.`;
}

function getPhotoDayLabel(photo: PendingPhoto, selectedDates: string[]) {
  if (!photo.takenDate || selectedDates.length <= 1) {
    return String(photo.displayOrder + 1);
  }

  const dayIndex = selectedDates.indexOf(photo.takenDate);
  return dayIndex >= 0 ? `${dayIndex + 1}일차` : String(photo.displayOrder + 1);
}

// GPS 좌표 → 지명. 권한 거부·네트워크 실패 시 undefined 반환(조용히 폴백).
// iOS 는 CLGeocoder 사용 — 위치 권한 없어도 작동. Android 는 위치 권한 필요.
async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<{ placeName?: string; countryName?: string; cityName?: string } | undefined> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const first = results[0];
    if (!first) return undefined;
    // 일차 대표 지명: district(구/동급) 우선, 없으면 city, 그것도 없으면 region.
    // 예) "신주쿠", "오다이바", "강남구"
    const placeName = first.district || first.city || first.subregion || first.region || undefined;
    // trip 단위 destination 의 "국가/도시" 부분. city 가 비어있는 한국식 주소는 region 로 폴백.
    const countryName = first.country || undefined;
    const cityName = first.city || first.region || undefined;
    return { placeName, countryName, cityName };
  } catch {
    return undefined;
  }
}

async function buildPendingPhoto(asset: ImagePicker.ImagePickerAsset, displayOrder: number): Promise<PendingPhoto> {
  // 리사이즈하면 EXIF가 사라지므로, 원본 asset에서 GPS를 먼저 읽습니다.
  const gps = parseExifGps(asset.exif);
  // GPS 가 있으면 OS 지오코딩으로 지명도 미리 확보. 백엔드가 그대로 location_summary/destination 으로 사용.
  const geo = gps ? await reverseGeocode(gps.latitude, gps.longitude) : undefined;
  // 업로드용 1024px 이미지와 화면 미리보기용 256px 썸네일을 따로 만듭니다.
  // EXIF가 리사이즈 과정에서 사라질 수 있어 촬영일/GPS는 원본 asset에서 먼저 읽어 form 필드로 보냅니다.
  const uploadImage = await ImageManipulator.manipulateAsync(
    asset.uri,
    [resizeAction(asset.width, asset.height, MAX_IMAGE_SIZE)],
    {
      compress: 0.86,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  const thumbnail = await ImageManipulator.manipulateAsync(
    asset.uri,
    [resizeAction(asset.width, asset.height, THUMBNAIL_SIZE)],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  const fileSizeBytes = await getFileSizeBytes(uploadImage.uri);

  return {
    id: `${Date.now()}-${displayOrder}-${asset.assetId ?? asset.fileName ?? asset.uri}`,
    fileUri: uploadImage.uri,
    thumbnailUri: thumbnail.uri,
    originalFilename: asset.fileName ?? `photo-${displayOrder + 1}.jpg`,
    mimeType: 'image/jpeg',
    takenDate: parseExifTakenDate(asset.exif) ?? parseFilenameDate(asset.fileName),
    gpsLatitude: gps?.latitude,
    gpsLongitude: gps?.longitude,
    placeName: geo?.placeName,
    countryName: geo?.countryName,
    cityName: geo?.cityName,
    fileSizeBytes,
    width: uploadImage.width,
    height: uploadImage.height,
    displayOrder,
  };
}

export default function AddScreen() {
  const router = useRouter();
  const colors = useAppThemeColors();
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

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('사진 접근 권한이 필요해요', '여행 사진을 고르려면 사진 보관함 접근을 허용해 주세요.');
      return;
    }

    // Android 14+ 에서 사진 EXIF GPS 를 노출 받으려면 ACCESS_MEDIA_LOCATION 권한이 필수.
    // ImagePicker 의 요청은 일반 사진 접근만 다루므로 별도로 요청해야 합니다.
    // (manifest 선언은 app.config.js 의 expo-media-library 플러그인이 담당)
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request('android.permission.ACCESS_MEDIA_LOCATION' as never);
      await MediaLibrary.requestPermissionsAsync();
    }
    // 좌표 → 지명 자동 변환에 필요한 권한.
    // Android: reverseGeocodeAsync 가 위치 권한 필요 — 여기서 미리 요청.
    // iOS: 권한 없어도 CLGeocoder 가 동작하지만, 요청은 idempotent 라 무해.
    // 거부해도 흐름은 계속됨(지명 비워둔 채 업로드 → 작성 화면에서 사용자가 직접 지정).
    await Location.requestForegroundPermissionsAsync();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTO_SELECTION_BATCH,
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
      const selectedAssets = result.assets.slice(0, MAX_PHOTO_SELECTION_BATCH);
      const processedPhotos = await mapWithConcurrency(
        selectedAssets,
        PHOTO_PROCESSING_CONCURRENCY,
        (asset, index) => buildPendingPhoto(asset, startOrder + index),
      );
      const dailyCounts = getDailyPhotoCounts(pendingPhotos);
      const acceptedPhotos: PendingPhoto[] = [];
      let rejectedCount = 0;

      for (const photo of processedPhotos) {
        const key = getPhotoDateKey(photo);
        const currentCount = dailyCounts[key] ?? 0;
        if (currentCount >= MAX_PHOTOS_PER_DAY) {
          rejectedCount += 1;
          continue;
        }
        dailyCounts[key] = currentCount + 1;
        acceptedPhotos.push(photo);
      }

      setPendingPhotos((current) =>
        [...current, ...acceptedPhotos].map((photo, index) => ({ ...photo, displayOrder: index })),
      );

      if (rejectedCount > 0) {
        Alert.alert(
          `일차별 사진은 최대 ${MAX_PHOTOS_PER_DAY}장까지 가능해요`,
          `${rejectedCount}장은 같은 날짜 사진이 너무 많아서 추가하지 않았어요.`,
        );
      } else if (result.assets.length > MAX_PHOTO_SELECTION_BATCH) {
        Alert.alert('사진을 일부만 추가했어요', `이번에는 ${MAX_PHOTO_SELECTION_BATCH}장만 추가했어요.`);
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

      router.replace({
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
    <View className="flex-1 items-center bg-background dark:bg-dark-background">
      <View
        className="w-full max-w-[760px] flex-1 bg-surface dark:bg-dark-surface"
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
            <Text className="text-xl font-sans-bold leading-8 text-textPrimary dark:text-dark-textPrimary">
              {photoHeading}
            </Text>
            <Text className="mt-sm text-md leading-6 text-textSecondary dark:text-dark-textSecondary">
              {photoDescription}
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 추가"
              onPress={pickPhotos}
              disabled={isPreparing || isUploading}
              className={`items-center justify-center rounded-lg border-2 border-dashed ${
                isPreparing || isUploading
                  ? 'border-muted bg-muted dark:border-dark-muted dark:bg-dark-muted'
                  : 'border-border bg-surface dark:border-dark-border dark:bg-dark-surface'
              }`}
              style={{ width: tileSize, height: tileSize }}>
              {isPreparing ? (
                <Loader2 size={24} color={colors.border} />
              ) : (
                <Camera size={24} color={colors.primaryLight} />
              )}
              <Text className="mt-xs text-sm font-sans-bold text-textSecondary dark:text-dark-textSecondary">
                {isPreparing ? '준비 중' : '사진 추가'}
              </Text>
            </Pressable>

            {pendingPhotos.map((photo) => (
              <View
                key={photo.id}
                className="overflow-hidden rounded-lg bg-muted dark:bg-dark-muted"
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
            <View className="mt-sm items-center rounded-lg bg-muted px-lg py-xl dark:bg-dark-muted">
              <ImagePlus size={30} color={colors.primaryLight} />
              <Text className="mt-sm text-center text-sm font-sans-bold text-textSecondary dark:text-dark-textSecondary">
                사진을 여러 장 선택하면 여기에서 순서대로 확인할 수 있어요.
              </Text>
            </View>
          ) : (
            <Text className="mt-lg text-center text-sm font-sans-bold text-textSecondary dark:text-dark-textSecondary">
              {pendingPhotos.length}장 선택됨 · 일차별 최대 {MAX_PHOTOS_PER_DAY}장
            </Text>
          )}
        </ScrollView>

        <View className="items-center bg-surface px-lg pb-md pt-md dark:bg-dark-surface">
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

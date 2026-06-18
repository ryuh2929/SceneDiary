type ReverseGeocodeAddress = {
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  name?: string | null;
  formattedAddress?: string | null;
};

function clean(value?: string | null) {
  const text = value?.trim();
  return text || undefined;
}

export function getShortPlaceName(address: ReverseGeocodeAddress | undefined) {
  if (!address) return undefined;

  // 사진 EXIF GPS와 지도 선택 위치가 같은 기준의 짧은 지명으로 저장되도록 맞춥니다.
  return (
    clean(address.district) ||
    clean(address.city) ||
    clean(address.subregion) ||
    clean(address.region) ||
    clean(address.name) ||
    clean(address.formattedAddress)
  );
}

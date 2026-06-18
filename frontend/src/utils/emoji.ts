export const DEFAULT_FLAG_CODEPOINT = "1f30d";

const COUNTRY_TO_FLAG_CODEPOINT: Record<string, string> = {
  "대한민국": "1f1f0-1f1f7",
  "한국": "1f1f0-1f1f7",
  "South Korea": "1f1f0-1f1f7",
  "Korea": "1f1f0-1f1f7",
  "Republic of Korea": "1f1f0-1f1f7",
  "중국": "1f1e8-1f1f3",
  "China": "1f1e8-1f1f3",
  "일본": "1f1ef-1f1f5",
  "Japan": "1f1ef-1f1f5",
  "대만": "1f1f9-1f1fc",
  "Taiwan": "1f1f9-1f1fc",
  "홍콩": "1f1ed-1f1f0",
  "Hong Kong": "1f1ed-1f1f0",
  "태국": "1f1f9-1f1ed",
  "Thailand": "1f1f9-1f1ed",
  "베트남": "1f1fb-1f1f3",
  "Vietnam": "1f1fb-1f1f3",
  "필리핀": "1f1f5-1f1ed",
  "Philippines": "1f1f5-1f1ed",
  "싱가포르": "1f1f8-1f1ec",
  "Singapore": "1f1f8-1f1ec",
  "말레이시아": "1f1f2-1f1fe",
  "Malaysia": "1f1f2-1f1fe",
  "인도네시아": "1f1ee-1f1e9",
  "Indonesia": "1f1ee-1f1e9",
  "몽골": "1f1f2-1f1f3",
  "Mongolia": "1f1f2-1f1f3",
  "프랑스": "1f1eb-1f1f7",
  "France": "1f1eb-1f1f7",
  "영국": "1f1ec-1f1e7",
  "United Kingdom": "1f1ec-1f1e7",
  "UK": "1f1ec-1f1e7",
  "독일": "1f1e9-1f1ea",
  "Germany": "1f1e9-1f1ea",
  "이탈리아": "1f1ee-1f1f9",
  "Italy": "1f1ee-1f1f9",
  "스페인": "1f1ea-1f1f8",
  "Spain": "1f1ea-1f1f8",
  "스위스": "1f1e8-1f1ed",
  "Switzerland": "1f1e8-1f1ed",
  "네덜란드": "1f1f3-1f1f1",
  "Netherlands": "1f1f3-1f1f1",
  "오스트리아": "1f1e6-1f1f9",
  "Austria": "1f1e6-1f1f9",
  "체코": "1f1e8-1f1ff",
  "Czech Republic": "1f1e8-1f1ff",
  "포르투갈": "1f1f5-1f1f9",
  "Portugal": "1f1f5-1f1f9",
  "미국": "1f1fa-1f1f8",
  "USA": "1f1fa-1f1f8",
  "United States": "1f1fa-1f1f8",
  "United States of America": "1f1fa-1f1f8",
  "캐나다": "1f1e8-1f1e6",
  "Canada": "1f1e8-1f1e6",
  "호주": "1f1e6-1f1fa",
  "Australia": "1f1e6-1f1fa",
  "뉴질랜드": "1f1f3-1f1ff",
  "New Zealand": "1f1f3-1f1ff",
  "괌": "1f1ec-1f1fa",
  "Guam": "1f1ec-1f1fa",
  "사이판": "1f1f2-1f1f5",
  "Saipan": "1f1f2-1f1f5",
};

const CODEPOINT_PATTERN = /^[0-9a-fA-F]+(?:-[0-9a-fA-F]+)*$/;

export function codepointToEmoji(value: string | null | undefined): string {
  const codepoint = value?.trim();
  if (!codepoint) return "";
  if (!CODEPOINT_PATTERN.test(codepoint)) return codepoint;

  return codepoint
    .split("-")
    .map((cp) => {
      const parsed = Number.parseInt(cp, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .join("");
}

export function getFlagCodepoint(countryName: string | null | undefined): string {
  const country = countryName?.trim();
  if (!country) return DEFAULT_FLAG_CODEPOINT;

  const exactMatch = COUNTRY_TO_FLAG_CODEPOINT[country];
  if (exactMatch) return exactMatch;

  const lowerCountry = country.toLowerCase();
  const matchedKey = Object.keys(COUNTRY_TO_FLAG_CODEPOINT).find(
    (key) => key.toLowerCase() === lowerCountry,
  );
  return matchedKey ? COUNTRY_TO_FLAG_CODEPOINT[matchedKey] : DEFAULT_FLAG_CODEPOINT;
}

export function resolveTripFlagCodepoint(
  flag: string | null | undefined,
  destination: string | null | undefined,
): string {
  const normalizedFlag = flag?.trim();
  if (normalizedFlag && normalizedFlag !== DEFAULT_FLAG_CODEPOINT) {
    return normalizedFlag;
  }

  const countryName = destination?.split(/[\/,]/)[0]?.trim();
  return getFlagCodepoint(countryName) || normalizedFlag || DEFAULT_FLAG_CODEPOINT;
}

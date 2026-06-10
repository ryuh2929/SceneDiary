// 딕셔너리에 매핑할 국가 이름들을 정의합니다.
export const COUNTRY_TO_FLAG: Record<string, string> = {
  // 🇰🇷 아시아
  '대한민국': '1f1f0-1f1f7',
  'South Korea': '1f1f0-1f1f7',
  '중국': '1f1e8-1f1f3',
  'China': '1f1e8-1f1f3',
  '일본': '1f1ef-1f1f5',
  'Japan': '1f1ef-1f1f5',
  '대만': '1f1f9-1f1fc',
  'Taiwan': '1f1f9-1f1fc',
  '홍콩': '1f1ed-1f1f0',
  'Hong Kong': '1f1ed-1f1f0',
  '태국': '1f1f0-1f1ed',
  'Thailand': '1f1f0-1f1ed',
  '베트남': '1f1fb-1f1f3',
  'Vietnam': '1f1fb-1f1f3',
  '필리핀': '1f1f5-1f1ed',
  'Philippines': '1f1f5-1f1ed',
  '싱가포르': '1f1f8-1f1ec',
  'Singapore': '1f1f8-1f1ec',
  '말레이시아': '1f1f2-1f1fe',
  'Malaysia': '1f1f2-1f1fe',
  '인도네시아': '1f1ee-1f1e9',
  'Indonesia': '1f1ee-1f1e9',
  '몽골': '1f1f2-1f1f3',
  'Mongolia': '1f1f2-1f1f3',

  // 🇪🇺 유럽
  '프랑스': '1f1eb-1f1f7',
  'France': '1f1eb-1f1f7',
  '영국': '1f1ec-1f1e7',
  'United Kingdom': '1f1ec-1f1e7',
  'UK': '1f1ec-1f1e7',
  '독일': '1f1e9-1f1ea',
  'Germany': '1f1e9-1f1ea',
  '이탈리아': '1f1ee-1f1f9',
  'Italy': '1f1ee-1f1f9',
  '스페인': '1f1ea-1f1f8',
  'Spain': '1f1ea-1f1f8',
  '스위스': '1f1e8-1f1ed',
  'Switzerland': '1f1e8-1f1ed',
  '네덜란드': '1f1f3-1f1f1',
  'Netherlands': '1f1f3-1f1f1',
  '오스트리아': '1f1e6-1f1f9',
  'Austria': '1f1e6-1f1f9',
  '체코': '1f1e4-1f1ff',
  'Czech Republic': '1f1e4-1f1ff',
  '포르투갈': '1f1f5-1f1f9',
  'Portugal': '1f1f5-1f1f9',

  // 🇺🇸 아메리카 / 오세아니아
  '미국': '1f1fa-1f1f8',
  'USA': '1f1fa-1f1f8',
  'United States': '1f1fa-1f1f8',
  '캐나다': '1f1e8-1f1e6',
  'Canada': '1f1e8-1f1e6',
  '호주': '1f1e6-1f1fa',
  'Australia': '1f1e6-1f1fa',
  '뉴질랜드': '1f1f3-1f1ff',
  'New Zealand': '1f1f3-1f1ff',
  '괌': '1f1ec-1f1fa',
  'Guam': '1f1ec-1f1fa',
  '사이판': '1f1f2-1f1f5', // 북마리아나 제도 대표 코드
  'Saipan': '1f1f2-1f1f5',
};

/**
 * 백엔드에서 내려온 국가명(text)을 받아 Twemoji 코드포인트로 변환합니다.
 * 매핑된 국가가 없거나 유효하지 않으면 테스트용 지구본('1f30d')을 반환합니다.
 */
export function getFlagCodepoint(countryName: string | null | undefined): string {
  if (!countryName) {
    return '1f30d'; // 국가명이 없으면 지구본
  }
  
  // 앞뒤 공백 제거 후 딕셔너리에서 매핑 코드 찾기
  const trimmedName = countryName.trim();
  
  // 매핑 데이터가 있으면 해당 코드포인트 반환, 없으면 지구본 반환
  return COUNTRY_TO_FLAG[trimmedName] || '1f30d'; 
}


export function findCountryFromAddress(address: string): string {
  if (!address) return '';
  
  const cleanText = address.toLowerCase();
  
  // 딕셔너리 내부 키(France, 일본, 대한민국 등)를 돌며 주소에 들어있는지 확인
  for (const key of Object.keys(COUNTRY_TO_FLAG)) {
    if (cleanText.includes(key.toLowerCase())) {
      return key; // 매칭되는 국가명(딕셔너리 Key) 반환
    }
  }
  
  return '';
}
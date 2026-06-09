// 딕셔너리에 매핑할 국가 이름들을 정의합니다.
const COUNTRY_TO_FLAG: Record<string, string> = {
  '대한민국': '1f1f0-1f1f7',
  'South Korea': '1f1f0-1f1f7',
  '중국': '1f1e8-1f1f3',
  'China': '1f1e8-1f1f3',
  '일본': '1f1ef-1f1f5',
  'Japan': '1f1ef-1f1f5',
  '미국': '1f1fa-1f1f8',
  'USA': '1f1fa-1f1f8',
  '프랑스': '1f1eb-1f1f7',
  'France': '1f1eb-1f1f7',
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
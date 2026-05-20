/** @type {import('tailwindcss').Config} */
module.exports = {

  // ✅ 1. NativeWind preset (필수)
  presets: [require("nativewind/preset")],

  // ✅ 2. 스타일 적용할 파일 경로
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],

  // ✅ 3. 디자인 시스템
  theme: {
    extend: {

      // 3-1. 색상
      colors: {
			  // 메인 색상
			  primary: "#5B7DBB",       // 메인 버튼, 포인트 색상
			  primaryLight: "#A9C3E6",  // 보조 버튼, Day 탭 활성화
			
			  // 로고
			  logo: "#5B7DBB",          // 메인 로고 색상
			  logoSub: "#A9C3E6",       // 로고 하단 텍스트 색상
			
			  // 스플래시 & 로고 배경
			  splashDark: "#152538",    // 가장 어두운 네이비
			  splashMid: "#1C2E43",     // 중간 네이비
			  splashLight: "#39536B",   // 밝은 네이비
			
			  // 배경
			  background: "#F4F6F9",    // 앱 전체 배경
			  surface: "#FFFFFF",       // 카드, 모달, 입력창 배경
			
			  // 텍스트
			  textPrimary: "#152538",   // 제목, 본문 텍스트
			  textSecondary: "#39536B", // 보조 텍스트
			  textOnPrimary: "#FFFFFF", // 버튼 위 텍스트
			
			  // UI 요소
			  accent: "#F6D9A6",        // 포인트 장식, 배지
			  border: "#A9C3E6",        // 카드 테두리, 구분선
			  tabActive: "#5B7DBB",     // 하단 탭 활성화
			  tabInactive: "#39536B",   // 하단 탭 비활성화
			  badge: "#1C2E43",         // 날짜 뱃지 배경
			  fab: "#1C2E43",           // + 플로팅 버튼
			  toggle: "#5B7DBB",        // 토글 활성화
			  
			  muted: "#E8EDF5",            // 비활성 영역 배경 (칩, 탭 등)
			  input: "#FFFFFF",            // 입력창 배경
			
			  // 상태 (임의 추가)
			  error: "#ef4444",         // 에러 메시지
			  success: "#22c55e",       // 성공 메시지
			  disabled: "#A9C3E6",      // 비활성 버튼
			  
			  // 다크모드
			  dark: {
			    background: "#152538",
			    card: "#1C2E43",
			    primary: "#5B7DBB",
			    secondary: "#39536B",
			    accent: "#F6D9A6",
			    foreground: "#DDE3EE",
			    muted: "#1E3A52",          // 비활성 영역 배경
			    mutedForeground: "#A9C3E6",
			    input: "#243D52",          // 입력창 배경
			    border: "#2A4560",
			    destructive: "#B91C1C",
			  },
			},

      // 3-2. 폰트
      fontFamily: {
        logo: ["DancingScript"],       // 로고 → font-logo
        sans: ["GowunDodum"],          // 기본 → font-sans
      },

      // 3-3. 폰트 사이즈
      fontSize: {
			  sm: 12,    // 날짜, 위치 등 작은 텍스트
			  md: 14,    // 기본 본문
			  lg: 18,    // 소제목
			  xl: 24,    // 제목, 헤더
			},

      // 3-4. 간격 (spacing)
      spacing: {
			  xs: 4,    // 아주 좁은 간격
			  sm: 8,    // 작은 간격
			  md: 16,   // 기본 간격
			  lg: 24,   // 넓은 간격
			  xl: 32,   // 아주 넓은 간격
			},

      // 3-5. 테두리 반경
      borderRadius: {
			  sm: 4,     // 살짝 둥글게
			  md: 8,     // 기본 카드
			  lg: 16,    // 크게 둥글게
			  full: 9999, // 완전 원형 (버튼, 뱃지)
			},

    },
  },

  // ✅ 4. 플러그인
  plugins: [],
};

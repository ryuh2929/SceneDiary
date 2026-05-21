// 테스트를 위한 임시 데이터 폴더 입니다. 실제 DB와 연결 후에는 삭제 예정

import type { SymbolViewProps } from 'expo-symbols';

export type PersonaTag = {
  id: string;
  label: string;
  selected: boolean;
};

export type AppSymbolName = Extract<SymbolViewProps['name'], object>;

export type TravelType = {
  id: string;
  title: string;
  description: string;
  icon: AppSymbolName;
};

export type SettingsToggle = {
  id: 'darkMode' | 'pushNotification';
  label: string;
  enabled: boolean;
  icon: AppSymbolName;
};

export type SettingsProfile = {
  nickname: string;
  persona: {
    title: string;
    description: string;
    tags: PersonaTag[];
  };
  travelType: TravelType;
  toggles: SettingsToggle[];
};

// DB가 붙기 전까지 화면을 바로 확인할 수 있도록 서버 응답과 비슷한 형태로 더미 데이터를 분리해둡니다.
export const dummySettingsProfile: SettingsProfile = {
  nickname: '기록하는 여행자',
  persona: {
    title: '글 작성 페르소나',
    description: '감성적이고 문학적인 표현',
    tags: [
      { id: 'poetic', label: '시적인', selected: true },
      { id: 'daily', label: '일상적', selected: false },
      { id: 'adventurous', label: '모험가', selected: false },
      { id: 'romantic', label: '로맨틱', selected: false },
    ],
  },
  travelType: {
    id: 'explorer',
    title: '탐험가',
    description: '새로운 곳을 끊임없이 찾아다니는 타입',
    icon: {
      ios: 'safari',
      android: 'explore',
      web: 'explore',
    },
  },
  toggles: [
    {
      id: 'darkMode',
      label: '다크 모드',
      enabled: false,
      icon: {
        ios: 'moon',
        android: 'dark_mode',
        web: 'dark_mode',
      },
    },
    {
      id: 'pushNotification',
      label: '푸시 알림',
      enabled: true,
      icon: {
        ios: 'bell',
        android: 'notifications',
        web: 'notifications',
      },
    },
  ],
};

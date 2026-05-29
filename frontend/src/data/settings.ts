export type PersonaTag = {
  id: string;
  label: string;
  description: string;
  selected: boolean;
};

export type TravelTypeIconName = 'NotebookPen';

export type TravelType = {
  id: string;
  title: string;
  description: string;
  icon: TravelTypeIconName;
};

export type SettingsToggle = {
  id: 'darkMode' | 'pushNotification';
  label: string;
  enabled: boolean;
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
      {
        id: 'poetic',
        label: '시적인',
        description: '감성적이고 문학적인 표현',
        selected: true,
      },
      {
        id: 'daily',
        label: '일상적',
        description: '담백하고 자연스러운 표현',
        selected: false,
      },
      {
        id: 'adventurous',
        label: '모험가',
        description: '생동감 있고 활동적인 표현',
        selected: false,
      },
      {
        id: 'romantic',
        label: '로맨틱',
        description: '따뜻하고 감성적인 표현',
        selected: false,
      },
    ],
  },
  travelType: {
    id: 'explorer',
    title: '탐험가',
    description: '새로운 곳을 끊임없이 찾아다니는 타입',
    icon: 'NotebookPen',
  },
  toggles: [
    {
      id: 'darkMode',
      label: '다크 모드',
      enabled: false,
    },
    {
      id: 'pushNotification',
      label: '푸시 알림',
      enabled: true,
    },
  ],
};

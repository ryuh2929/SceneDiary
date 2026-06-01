export type PersonaTag = {
  id: string;
  label: string;
  description: string;
  selected: boolean;
};

// DB/API에서 내려오는 여행 유형 아이콘 이름입니다.
// lucide-react-native에서 실제로 import할 수 있는 PascalCase 컴포넌트명만 허용합니다.
export type TravelTypeIconName =
  | 'Flower2'
  | 'Camera'
  | 'Compass'
  | 'Trees'
  | 'TreePalm'
  | 'TentTree'
  | 'Binoculars'
  | 'FlameKindling'
  | 'PartyPopper'
  | 'Martini'
  | 'Beer'
  | 'BottleWine'
  | 'Wine'
  | 'Hamburger'
  | 'Sandwich'
  | 'Utensils'
  | 'TicketsPlane'
  | 'Map'
  | 'Helicopter'
  | 'Ship'
  | 'CarFront'
  | 'Amphora'
  | 'Landmark'
  | 'FerrisWheel'
  | 'RollerCoaster'
  | 'Mountain'
  | 'Coffee'
  | 'Building'
  | 'Castle'
  | 'Hotel'
  | 'House'
  | 'Sailboat'
  | 'FishingHook'
  | 'Fish'
  | 'IceCreamBowl'
  | 'Soup'
  | 'CookingPot'
  | 'Cookie'
  | 'Dog'
  | 'Snail'
  | 'Squirrel'
  | 'Turtle'
  | 'Bird'
  | 'Bug'
  | 'Origami'
  | 'Footprints'
  | 'Rose'
  | 'Baby'
  | 'CircleDollarSign'
  | 'Snowflake'
  | 'Sun'
  | 'NotebookPen';

export type TravelType = {
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
  profileImageUrl?: string | null;
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
  profileImageUrl: null,
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
    title: '탐험가',
    description: '새로운 곳을 끊임없이 찾아다니는 타입',
    icon: 'Compass',
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

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
  nickname: '오늘의 여행자',
  profileImageUrl: null,
  persona: {
    title: '글 작성 페르소나',
    description: '담백하고 자연스러운 표현',
    tags: [
      {
        id: 'daily',
        label: '일상적',
        description: '담백하고 자연스러운 표현',
        selected: true,
      },
      {
        id: 'playful',
        label: '유쾌한',
        description: '가볍고 재치 있는 표현',
        selected: false,
      },
      {
        id: 'poetic',
        label: '시적인',
        description: '감성적이고 문학적인 표현',
        selected: false,
      },
      {
        id: 'romantic',
        label: '로맨틱',
        description: '따뜻하고 사랑이 넘치는 표현',
        selected: false,
      },
    ],
  },
  travelType: {
    title: '이름 없는 여행자',
    description: '아직 여행 기록이 많지 않아 가능성을 넓게 품고 있는 타입입니다.',
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

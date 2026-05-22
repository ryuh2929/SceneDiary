// 테스트용 임시 mock 데이터입니다. 백엔드가 꺼져 있어도 화면을 확인할 수 있습니다.
// (settings.ts 와 같은 방식 — DB 붙기 전까지 서버 응답과 비슷한 형태로 분리)
// 5~6단계에서 실제 API 응답으로 교체됩니다.
//
// 출처: 실제 DB의 trips.id = 1 ("신시모-제부-부산-포항, 바다의 빛과 시간 여행") 5일치 전사.
//
// 실제 데이터를 옮기며 손본 부분 (모두 추적 가능하게 주석으로 표시):
//   - weather: DB엔 한글("맑음","실내","미상","흐림")로 들어있으나, 계획대로 Twemoji
//     코드포인트로 "통일"하기로 결정 → 코드포인트로 변환해 넣음(원본 한글은 옆 주석).
//     ※ 생성기가 weather를 한글(그것도 "실내/미상" 같은 날씨 아닌 값)로 뱉는 건 백엔드 후속 수정 대상.
//   - symbol: 원래 DB가 비어있어, 2026-05-21에 일기 내용에 맞는 상징을 DB(diaries.symbol)에 채움 → 그 값 그대로 사용.
//   - 사진 URL: DB값이 "test_images/..." 로컬 경로라 브라우저에서 안 열림 →
//     picsum 임시 이미지로 대체. 단, photos.id·개수·순서는 실제 그대로 유지.
//   - genStatus: 실제 5일 모두 생성 완료(ready). 생성중/실패 화면을 보려면
//     아래 4·5일차의 genStatus를 'generating' / 'failed' 로 잠깐 바꿔 확인.

import type { TripDiary } from '@/types/diary_writing';

export const dummyTripDiary: TripDiary = {
  tripId: 1,
  title: '신시모-제부-부산-포항, 바다의 빛과 시간 여행',
  representImage: 'https://picsum.photos/seed/sd-cover/400/400', // trips.cover_photo_id = 1 (안 열려서 placeholder)
  status: 'completed',
  days: [
    // ── 1일차 ──
    {
      tripDayId: 1,
      dayNumber: 1,
      date: '2026-05-01',
      locationSummary: '신시모도',
      weather: '2600', // ☀️ (원본 "맑음")
      subtitle: '시모도의 빛으로 적신 갯벌',
      emotion: '1f60c', // 😌
      symbol: '1f30a', // 🌊 갯벌·바다
      content:
        '신시모도에 발을 디딘 날, 세상의 모든 소음이 저만치 흩어지는 기분이었다. 잔잔한 파도 소리를 배경음악 삼아, 갯벌 산책로를 거닐 때마다 가슴이 벅차게 고요해졌다. 푸른 하늘 아래 펼쳐진 수평선은 끝없이 이어져, 마치 영혼을 씻어내는 듯했다. 자연이 만들어낸 섬세한 질감과 고요한 해안도로의 조화 속에서, 비로소 진정한 평화가 머문다는 것을 느낀 하루였다.',
      photos: [
        { id: 1, thumbnailUrl: 'https://picsum.photos/seed/sd-1/200/200', fileUrl: 'https://picsum.photos/seed/sd-1/800/800' },
        { id: 2, thumbnailUrl: 'https://picsum.photos/seed/sd-2/200/200', fileUrl: 'https://picsum.photos/seed/sd-2/800/800' },
        { id: 3, thumbnailUrl: 'https://picsum.photos/seed/sd-3/200/200', fileUrl: 'https://picsum.photos/seed/sd-3/800/800' },
      ],
      genStatus: 'ready',
    },
    // ── 2일차 ──
    {
      tripDayId: 2,
      dayNumber: 2,
      date: '2026-05-02',
      locationSummary: '제부도',
      weather: '1f3e0', // 🏠 (원본 "실내" — 날씨 아님, 생성기 점검 필요)
      subtitle: '제부의 오후, 일상의 빛과 맛',
      emotion: '1f604', // 😄
      symbol: '1f41a', // 🐚 조개·바다
      content:
        '제부도는 언제나 나에게 빛으로 가득 찬 공간이다. 친구들과 테이블에 앉아 웃고, 카메라에 활기찬 순간들을 담는 시간은 그 자체로 기쁨의 파노라마였다. 숯불 위에서 지글거리는 조개구이 냄새와 함께, 바깥에서 느긋하게 나른한 햇살 아래를 배회하는 고양이의 평화로운 모습이 마음을 감쌌다. 모든 것이 소란스러우면서도 조용하고, 가장 완벽한 즐거움이 머무는 날이었다. 이곳의 작은 빛들이 일상에 작은 마법을 건네준다.',
      photos: [
        { id: 4, thumbnailUrl: 'https://picsum.photos/seed/sd-4/200/200', fileUrl: 'https://picsum.photos/seed/sd-4/800/800' },
        { id: 5, thumbnailUrl: 'https://picsum.photos/seed/sd-5/200/200', fileUrl: 'https://picsum.photos/seed/sd-5/800/800' },
        { id: 6, thumbnailUrl: 'https://picsum.photos/seed/sd-6/200/200', fileUrl: 'https://picsum.photos/seed/sd-6/800/800' },
      ],
      genStatus: 'ready',
    },
    // ── 3일차 ──
    {
      tripDayId: 3,
      dayNumber: 3,
      date: '2026-05-03',
      locationSummary: '율동공원, 성남',
      weather: '2601', // ☁️ (원본 "미상=알 수 없음" → 중립 처리)
      subtitle: '밤하늘 아래, 빛과 이야기가 머무는 곳',
      emotion: '1f60c', // 😌
      symbol: '1f525', // 🔥 모닥불·캠핑
      content:
        '캠핑장에서 맞이한 고요한 저녁. 어스름이 드리운 공원 공기는 이미 하루의 피로를 씻어주는 듯 고요했어요. 모닥불을 중심으로 친구들과 앉아 나누는 대화는 작은 빛처럼 따뜻하게 주변을 감쌌죠. 밤이 깊어질수록 장작 타는 활활한 불꽃이 주는 붉은 기운은, 우리가 함께 만들어가는 추억들의 빛깔 같았습니다. 이 평온함 속에서, 우리는 잠시 잊고 있던 일상의 속도를 멈추고 오직 서로의 존재와 자연의 숨결에 집중할 수 있었습니다.',
      photos: [
        { id: 7, thumbnailUrl: 'https://picsum.photos/seed/sd-7/200/200', fileUrl: 'https://picsum.photos/seed/sd-7/800/800' },
        { id: 8, thumbnailUrl: 'https://picsum.photos/seed/sd-8/200/200', fileUrl: 'https://picsum.photos/seed/sd-8/800/800' },
        { id: 9, thumbnailUrl: 'https://picsum.photos/seed/sd-9/200/200', fileUrl: 'https://picsum.photos/seed/sd-9/800/800' },
      ],
      genStatus: 'ready',
    },
    // ── 4일차 ── (생성중 버튼을 보려면 genStatus를 'generating'으로 바꾸세요)
    {
      tripDayId: 4,
      dayNumber: 4,
      date: '2026-05-04',
      locationSummary: '부산',
      weather: '2600', // ☀️ (원본 "맑음")
      subtitle: '도시와 바다가 안아준 날',
      emotion: '1f60c', // 😌
      symbol: '1f309', // 🌉 현수교·도시
      content:
        '비행기 통로를 거닐 때부터 느껴지던 낯선 설렘은, 이 넓은 부산의 풍경을 마주하자 깊은 평온으로 변모했다. 광활한 도시의 거미줄 같은 전경을 내려다보며 문명 속의 웅장함을 느끼고, 이윽고 바닷가로 나섰을 때 그 모든 복잡함이 일시에 씻겨나갔다. 현수교 너머로 펼쳐진 푸른 수평선은 끝없이 마음을 채워주었고, 도심의 활기와 바다의 고요함이 완벽하게 조화된 이 순간에, 나는 비로소 마음의 여백을 찾았다.',
      photos: [
        { id: 10, thumbnailUrl: 'https://picsum.photos/seed/sd-10/200/200', fileUrl: 'https://picsum.photos/seed/sd-10/800/800' },
        { id: 11, thumbnailUrl: 'https://picsum.photos/seed/sd-11/200/200', fileUrl: 'https://picsum.photos/seed/sd-11/800/800' },
        { id: 12, thumbnailUrl: 'https://picsum.photos/seed/sd-12/200/200', fileUrl: 'https://picsum.photos/seed/sd-12/800/800' },
        { id: 13, thumbnailUrl: 'https://picsum.photos/seed/sd-13/200/200', fileUrl: 'https://picsum.photos/seed/sd-13/800/800' },
      ],
      genStatus: 'ready',
    },
    // ── 5일차 (마지막) ── (실패 화면을 보려면 genStatus를 'failed'로 바꾸세요)
    {
      tripDayId: 5,
      dayNumber: 5,
      date: '2026-05-05',
      locationSummary: '포항항',
      weather: '2601', // ☁️ (원본 "흐림")
      subtitle: '흐린 날의 포항 항해일기',
      emotion: '1f60c', // 😌
      symbol: '2693', // ⚓ 항구·등대
      content:
        '어제는 구름이 짙게 드리운 포항항의 풍경 속에서 시간을 흘려보냈다. 넓게 펼쳐진 해변을 따라 걷는 사람들처럼, 나 역시 일상의 잔잔한 흐름에 몸을 맡기는 기분이었다. 흰 등대와 바다의 웅장함이 주는 평온함 덕분에 마음속 복잡했던 감정들이 씻겨 내려가는 듯했다. 거대한 손 조형물과 푸른 잔디가 어우러진 곳에서 잠시 멈춰, 이 모든 순간의 고요한 아름다움을 카메라에 담았다. 포항이라는 장소가 내 마음에 깊은 안식처를 선물해 준 하루였다.',
      photos: [
        { id: 14, thumbnailUrl: 'https://picsum.photos/seed/sd-14/200/200', fileUrl: 'https://picsum.photos/seed/sd-14/800/800' },
        { id: 15, thumbnailUrl: 'https://picsum.photos/seed/sd-15/200/200', fileUrl: 'https://picsum.photos/seed/sd-15/800/800' },
        { id: 16, thumbnailUrl: 'https://picsum.photos/seed/sd-16/200/200', fileUrl: 'https://picsum.photos/seed/sd-16/800/800' },
        { id: 17, thumbnailUrl: 'https://picsum.photos/seed/sd-17/200/200', fileUrl: 'https://picsum.photos/seed/sd-17/800/800' },
      ],
      genStatus: 'ready',
    },
  ],
};

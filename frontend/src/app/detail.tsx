import React, { useState,useEffect } from 'react';
import { View, Text, Image, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { X, MapPin, Calendar, Plus } from 'lucide-react-native';
// import Twemoji from 'react-native-twemoji';
import { getDetailPage } from '@/api/detail';
import { Trip,Days } from '@/types/api';

const Twemoji = ({ children }: { children: string }) => <Text>{children}</Text>;

export default function TravelDetailUI() {
  const router = useRouter();

  //홈에서 id와 누른 day 정보 접수
  const {id,day} = useLocalSearchParams();
  const tripId = Number(id);

  // 1️⃣ API 데이터를 수납할 상태 선언
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  //2. 문자열로 압축되어 온 details 데이터를 진짜 쓸 수 있게 배열로 해제합니다.
  // const parsedDetails = details ? JSON.parse(details) : [];

  // 홈에서 특정 Day를 누르고 들어왔으면 그 Day로 시작하고, 아니면 Day 1로 시작
  // 2️⃣ 현재 어떤 Day 탭이 활성화되어 있는지 관리
  const [activeDay, setActiveDay] = useState<number>(Number(day) || 1);

  // 3️⃣ 화면이 켜지면 백엔드에서 부모+자식 데이터 통째로 긁어오기
  useEffect(() => {
    const loadDetailData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getDetailPage(tripId);
        console.log("🔥 백엔드가 준 진짜 데이터 구조:", JSON.stringify(data, null, 2));
        setTrip(data);
        
        // 만약 홈에서 특정 day를 안 누르고 들어왔다면, 데이터의 첫 번째 일자로 자동 선택
        if (!day && data.tripDays?.length > 0) {
          const sortedDays = [...data.tripDays].sort((a, b) => a.day_number - b.day_number);
          setActiveDay(sortedDays[0].day_number);
        }
      } catch (err) {
        console.error("상세 페이지 데이터 로딩 실패:", err);
        setError("여행 상세 정보를 불러올 수 없습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    if (tripId) loadDetailData();
  }, [tripId, day]);

  if (isLoading || !trip) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        {/* <ActivityIndicator size="large" color="#39536B" /> */}
        <Text className="text-textSecondary font-sans mt-sm">기록을 불러오는 중...</Text>
      </View>
    );
  }

  // 5️⃣ 실시간 데이터 가공 처리 영역
  const { title, destination, start_date, end_date, tripDetail} = trip as any;

  //3. [중요] 전체 상세 데이터 중 '현재 활성화된 Day 탭'에 해당하는 데이터만 찾아냅니다!
  // tripDays 배열에서 현재 선택된 activeDay 데이터 추출
  const currentDayData = tripDetail?.find((d: Days) => Number(d.day_number) === activeDay);

  //4. 생성할 탭 목록 배열 자동 생성 (예: 데이터가 3개면 [1, 2, 3] 탭이 생김)
  const dayTabs = tripDetail ? tripDetail.map((d: Days) => Number(d.day_number)).sort((a: number, b: number) => a - b) : [];

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false} bounces={false}>

      {/* 상단 히어로 이미지 */}
      <View className="relative h-80 w-full">
        {/* <Image
          source={{uri: currentDayData?.represent_image || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e'  }}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        /> */}

        {/* 그라데이션 오버레이 */}
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'transparent', '#F4F6F9']}
          locations={[0, 0.5, 1]}
          className="absolute inset-0 p-md"
        >
          {/* 닫기 버튼 */}
          <View className="flex-row justify-end pt-safe">
            <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full bg-black/30 items-center justify-center">
              <X size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* 타이틀 정보 */}
          <View className="absolute bottom-lg left-md w-full pr-md">
            <Text className="text-xl font-sans font-bold text-textPrimary mb-sm">
              {title || '여행 정보'}
            </Text>
            <View className="flex-row items-center justify-between w-full">

              {/* 위치 영역 */}
              <View className="flex-row items-center gap-xs">
                <MapPin size={14} color="#39536B" />
                <Text className="text-sm font-sans text-textSecondary">{destination  || '위치 미정'}</Text>
              </View>
              <View className="flex-1 flex-row items-center gap-md flex-wrap">
              {/* 날짜 영역 */}
              <View className="flex-row items-center gap-xs">
                <Calendar size={14} color="#39536B" />
                <Text className="text-sm font-sans text-textSecondary">
                  {(() => {
                    if (!start_date || !end_date) return '날짜 미정';
                    
                    //만약 데이터가 이미 '04.01' 형태로 들어온 경우 앞의 연도를 강제로 붙여줍니다.
                    const format = (dateStr: string) => {
                      const clean = dateStr.replaceAll('-', '.');
                      return clean.startsWith('20') ? clean.slice(2) : clean; // '2026.04.01' -> '26.04.01'
                    };

                    return `${format(start_date)} ~ ${format(end_date)}`;
                  })()}
                </Text>
              </View>
              </View>
              {/* 심볼 */}
              {currentDayData?.symbol && (
                <View className="w-10 h-10 items-center justify-center overflow-hidden">
                  <View
                    style={{
                      transform: [
                        { scale: 0.15 }, 
                        { translateY: -30 } 
                      ]
                    }}
                    
                  >
                    <Twemoji>{String.fromCodePoint(parseInt(currentDayData.symbol, 16))}</Twemoji>
                  </View>
                </View>
                )}
            </View>
          </View>
        </LinearGradient>
      </View>

      
      {/* Day 탭 */}
        <View className="flex-row items-end px-9 mt-sm">
          {(dayTabs?.length > 0 ? dayTabs : [1]).map((d: number) => (
            <Pressable
              key={d}
              onPress={() => setActiveDay(d)}
              // activeDay일 때는 px-lg(크게), 아닐 때는 px-sm(정확히 숫자만 감싸게 고정)으로 크기를 이원화
              className={`py-xs rounded-t-lg mr-xs shadow-sm ${
                activeDay === d 
                  ? 'px-lg bg-primary min-w-[70px] items-center' // 활성화 탭: 넓은 패딩 + 최소 너비 지정으로 듬직하게
                  : 'px-sm bg-muted min-w-[36px] items-center'   // 일반 숫자 탭: 좁은 패딩 + 정사각형에 가까운 콤팩트한 크기
              }`}
            >
              <Text
                className={`${
                  activeDay === d 
                    ? 'font-logo text-xl text-white' // 선택 시 필기체 느낌의 큰 글씨
                    : 'font-sans text-base font-bold text-textSecondary' // 미선택 시 깔끔한 고딕 숫자
                }`}
              >
                {activeDay === d ? `Day ${d}` : d}
              </Text>
            </Pressable>
          ))}

          {/* 최대 7개 미만일 때만 + 버튼 표시 */}
          {dayTabs.length < 7 && (
            <Pressable onPress={()=>router.push({pathname: '/add', params: { trip_id: tripId }})}
            className=" rounded-t-lg h-[30px] bg-muted min-w-[36px] items-center justify-center shadow-sm">
              <Plus size={16} color="#39536B" strokeWidth={3} />
            </Pressable>
          )}
        </View>

      {/* 메인 콘텐츠 카드 */}
      <View className="px-md  pb-xl pt-sm -mt-[8px]">
        <View className="bg-surface rounded-lg p-md shadow-sm border border-border">

          {/* 소제목 & 감정 이모지 */}
          <View className="flex-row justify-between items-end mb-md w-full">
            <View className="flex-1 mr-xs">
              <Text className="text-lg font-bold text-textPrimary font-sans">
                {currentDayData?.subtitle || '상세 일정이 없습니다.'}
              </Text>
            </View>
            {/* 오른쪽: 홈 화면 방식의 이모지 상자 스타일 그대로 적용 */}
          <View 
            style={{
              width: 44,
              height: 44,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              marginTop: 2,
            }}
          >
            {currentDayData?.emotion && (
              <View
                style={{
                  transform: [
                    { scale:2 },
                  ]
                }}
              >
                <Twemoji>{String.fromCodePoint(parseInt(currentDayData.emotion, 16))}</Twemoji>
              </View>
            )}
          </View>
        </View>


        {/* 📍 세부 위치 정보 연동 */}
        <View className="flex-row items-center gap-xs mb-sm">
          <MapPin size={10} color="#39536B" />
          <Text className="text-sm text-textSecondary font-sans mr-1">
            {currentDayData?.location_summary || '위치 정보 없음'}
          </Text>
          
           {/* 날짜 & 날씨 */}
            <Text className="text-sm text-textSecondary font-sans mr-2">
              {(() => {
                const targetDate = currentDayData?.date || start_date;
                if (!targetDate) return '날짜 미정';

                const clean = targetDate.replaceAll('-', '.');
                //뒤에서부터 5글자만 남겨서 항상 '월.일' (예: 04.01) 형식만 쏙 뽑아냅니다.
                return clean.length >= 5 ? clean.slice(-5) : clean;
              })()}
            </Text>
            <View className="flex-row items-center gap-xs px-sm py-xs rounded-full">
             <Text className="text-sm text-textSecondary font-sans font-bold">
               {currentDayData?.weather ? `☀️ ${currentDayData.weather}` : '☀️ 맑음'}
            </Text>
            </View>
          </View>

         
          {/* 본문 사진 */}
          {/* <Image
            source={{ uri: currentDayData?.represent_image || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e' }}
            className="w-full h-60 rounded-lg mb-md mt-md"
            resizeMode="cover"
          /> */}

          {/* 일기 텍스트 */}
          <View className="bg-muted p-md rounded-md border border-border">
            <Text className="text-textSecondary text-md font-sans">
              {currentDayData?.content || '이날의 일기 기록이 비어있습니다.'}
            </Text>
          </View>

        </View>
      </View>

    </ScrollView>
  );
}

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { Home, Map, Settings, LucideIcon } from 'lucide-react-native';

type NavItem = {
  path: '/' | '/map' | '/settings';
  icon: LucideIcon;
  label: string;
};

const navItems: NavItem[] = [
  { path: '/', icon: Home, label: '홈' },
  { path: '/map', icon: Map, label: '지도' },
  { path: '/settings', icon: Settings, label: '설정' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    /* 
       [컨테이너] 
       - bg-surface: 화이트 배경 (#FFFFFF)
       - border-t border-border: 상단 테두리 (#A9C3E6)
       - pb-safe: iOS 노치/하단 바 대응 (NativeWind v4 전용)
    */
    <View className="absolute bottom-0 left-0 right-0 z-50 bg-surface border-t border-border pb-safe shadow-lg">
      <View className="flex-row items-center justify-around h-16 px-md">
        {navItems.map(({ path, icon: Icon, label }) => {
          // 현재 경로와 일치하는지 확인
          const isActive = pathname === path;
          
          // 활성화 여부에 따른 색상 결정 (config 내 정의된 색상 사용)
          const iconColor = isActive ? "#5B7DBB" : "#39536B"; // tabActive : tabInactive

          return (
            <Link key={path} href={path} asChild>
              <Pressable 
                className={`flex-1 flex-col items-center justify-center py-xs rounded-md ${
                  isActive ? 'opacity-100' : 'opacity-70'
                }`}
              >
                {/* 
                   [아이콘] 
                   - text-tabActive (#5B7DBB) / text-tabInactive (#39536B)
                */}
                <Icon
                  size={24}
                  color={iconColor}
                  strokeWidth={isActive ? 2.5 : 2}
                />

                {/* 
                   [텍스트]
                   - font-sans: GowunDodum 폰트 적용
                   - text-sm: 12px 적용
                */}
                <Text 
                  className={`text-sm font-sans mt-xs ${
                    isActive ? 'text-tabActive font-bold' : 'text-tabInactive'
                  }`}
                >
                  {label}
                </Text>
                
                {/* 
                   [활성화 표시 점]
                   - bg-primary (#5B7DBB)
                */}
                {isActive && (
                  <View className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}
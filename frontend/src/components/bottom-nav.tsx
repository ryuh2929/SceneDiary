import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Link, usePathname,Href } from 'expo-router';
import { Home, Map, Settings, LucideIcon } from 'lucide-react-native';

type NavItem = {
  // path: '/(tabs)' | '/(tabs)/map' | '/(tabs)/settings';
  path: string;
  href: any;
  icon: LucideIcon;
  label: string;
};

const navItems: NavItem[] = [
  { path: 'home', href: '/(tabs)', icon: Home, label: '홈' },
  { path: 'map', href: '/(tabs)/map', icon: Map, label: '지도' },
  { path: 'settings', href: '/(tabs)/settings', icon: Settings, label: '설정' },
];

export default function BottomNav() {
  const pathname = usePathname();       
          

  return (
    <View className="absolute bottom-0 left-0 right-0 z-50 bg-surface border-t border-border pb-safe shadow-lg">
      <View className="flex-row items-center justify-around h-16 px-md">
        {navItems.map(({ path, href, icon: Icon, label }) => {
          
          // 단순 일치가 아니라 조건별로 활성화 탭을 묶어줌
          let isActive = false;
          
          if (path === 'map') {
            isActive = pathname.startsWith('/map');
          } else if (path === 'settings') {
            isActive = pathname.startsWith('/settings');
          } else if (path === 'home') {
            // 현재 경로가 지도나 설정이 아니라면
            // 무조건 '홈' 탭이 활성화된 것으로 판단하여 불을 켜줍니다!
            isActive = !pathname.startsWith('/map') && !pathname.startsWith('/settings');
          }
          
          // 테일윈드 씹힘 방지를 위한 헥사코드 강제 바인딩 스타일
          const activeColor = "#5B7DBB";
          const inactiveColor = "#39536B";
          const iconColor = isActive ? activeColor : inactiveColor;

          return (
            <Link key={label} href={href} asChild>
              <Pressable 
                className="flex-1 flex-col items-center justify-center py-xs rounded-md"
                style={{ opacity: isActive ? 1 : 0.7 }}
              >
                {/* 아이콘 색상 및 두께 제어 */}
                <Icon
                  size={24}
                  color={iconColor}
                  strokeWidth={isActive ? 2.5 : 2}
                />

                {/* 텍스트 컬러 스타일 안정화 */}
                <Text 
                  className={`text-sm font-sans mb-1 mt-xs ${isActive ? 'font-sans-bold' : ''}`}
                  style={{ color: iconColor }} 
                >
                  {label}
                </Text>
                
                {/* 하단 활성화 블루 점 점등 */}
                {isActive && (
                  <View 
                    className="absolute bottom-1 w-1 h-1 rounded-full" 
                    style={{ backgroundColor: "#F6D9A6" }}
                  />
                )}
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}
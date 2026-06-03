// store/userStore.ts
import { create } from 'zustand';
import { SettingsProfile } from '@/data/settings';//타입 임포트

// 1. 전역으로 관리할 상태들의 타입을 정의
type UserState = {
  userProfile: SettingsProfile | null;
  setUserProfile: (profile: SettingsProfile) => void; // 프로필을 전역에 저장하는 함수
  clearUserProfile: () => void;
};

// 2. 진짜 값을 가질 수 있는 전역 저장소(Store) 생성
export const useUserStore = create<UserState>((set) => ({
  userProfile: null,// 👈 진짜 데이터가 저장되는 공간!
  setUserProfile: (profile) => set({ userProfile: profile }),
  clearUserProfile: () => set({ userProfile: null }),
}));

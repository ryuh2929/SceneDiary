import { useEffect } from 'react';

import { ensureCurrentUser } from '@/services/user-api';

// 이 훅은 앱이 시작될 때 userUuid를 준비하고, DB에 해당 유저가 없으면 기본 유저를 생성합니다.
// 실제 설정 API에서도 같은 ensure 함수를 다시 호출하므로, 여기서 실패해도 화면 전체를 막지는 않습니다.
export function useUserUuidBootstrap() {
  useEffect(() => {
    const prepareUser = async () => {
      try {
        await ensureCurrentUser();
      } catch (error) {
        // userUuid 준비나 유저 생성 실패는 이후 API 호출에서 다시 시도할 수 있으므로 앱 실행을 중단하지 않습니다.
        console.warn('userUuid 준비 또는 유저 생성에 실패했습니다.', error);
      }
    };

    prepareUser();
  }, []);
}

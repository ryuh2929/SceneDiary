import { useEffect } from 'react';

import { getOrCreateDeviceId } from '@/services/device-id';

// 이 훅은 앱이 시작될 때 deviceId를 미리 준비하는 역할을 합니다.
// 실제 설정 API에서도 같은 함수를 다시 호출하므로, 여기서 실패해도 화면 전체를 막지는 않습니다.
export function useDeviceIdBootstrap() {
  useEffect(() => {
    const prepareDeviceId = async () => {
      try {
        await getOrCreateDeviceId();
      } catch (error) {
        // deviceId 준비 실패는 네트워크 문제가 아니라 로컬 저장소 문제일 가능성이 큽니다.
        // 이후 API 호출에서 다시 시도할 수 있도록 여기서는 앱 실행을 중단하지 않습니다.
        console.warn('deviceId 준비에 실패했습니다.', error);
      }
    };

    prepareDeviceId();
  }, []);
}

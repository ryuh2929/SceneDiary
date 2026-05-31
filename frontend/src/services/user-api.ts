import { getApiBaseUrl } from '@/services/api-base-url';
import { getOrCreateUserUuid } from '@/services/user-uuid';

type EnsureUserResponse = {
  id: number;
  user_uuid: string;
  created: boolean;
};

let ensureUserPromise: Promise<string> | null = null;

export async function ensureUser(userUuid: string) {
  const response = await fetch(`${getApiBaseUrl()}/users/ensure`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_uuid: userUuid }),
  });

  if (!response.ok) {
    throw new Error('Failed to ensure user.');
  }

  return (await response.json()) as EnsureUserResponse;
}

export async function ensureCurrentUser() {
  // 앱 시작 훅과 설정 API가 동시에 호출되어도 같은 user_uuid로 중복 생성 요청을 보내지 않도록 Promise를 공유합니다.
  if (!ensureUserPromise) {
    ensureUserPromise = getOrCreateUserUuid()
      .then(async (userUuid) => {
        await ensureUser(userUuid);
        return userUuid;
      })
      .catch((error) => {
        // 네트워크나 백엔드 오류로 실패하면 다음 API 호출에서 다시 생성 보장을 시도할 수 있게 캐시를 비웁니다.
        ensureUserPromise = null;
        throw error;
      });
  }

  return ensureUserPromise;
}

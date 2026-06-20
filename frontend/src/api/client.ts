// frontend/src/api/client.ts
import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

// 백엔드 주소를 알아냅니다.
//   1) 실기기/Expo 실행 중이면 Metro 가 알려주는 개발 PC 의 IP:8000 ← 1순위
//   2) 그 외(웹)는 localhost:8000
//
// EXPO_PUBLIC_API_URL 같은 env 변수는 일부러 안 봅니다.
// 빌드 시점에 박힌 옛 IP 가 새 네트워크에서 안 닿는 문제가 반복되어,
// Metro 가 알려주는 실제 호스트를 항상 우선으로 씁니다.
// (api/diary.ts 가 동작하는 것과 같은 패턴)
function getApiBaseUrl() {
  if (Platform.OS !== "web" && Constants.expoConfig?.hostUri) {
    const host = Constants.expoConfig.hostUri.split(":")[0];
    return `http://${host}:8000`;
  }

  return "http://localhost:8000";
}

const apiUrl = getApiBaseUrl();
console.log("확인용 주소:", apiUrl);

const client = axios.create({
  baseURL: apiUrl,
});

export default client;

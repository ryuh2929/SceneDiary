// frontend/src/api/client.ts
import axios from "axios";

import { getApiBaseUrl } from "@/services/api-base-url";

// 백엔드 주소 계산은 한 곳(services/api-base-url.ts)으로 통일합니다.
//   1) EXPO_PUBLIC_API_BASE_URL 이 있으면 그것 (standalone 빌드에서 LAN 주소 주입용)
//   2) 없으면 Metro 가 알려주는 개발 PC 의 IP:8000 (로컬 개발 — 옛 IP 박히는 문제 없음)
//   3) 그 외(웹)는 localhost:8000
const apiUrl = getApiBaseUrl();
console.log("확인용 주소:", apiUrl);

const client = axios.create({
  baseURL: apiUrl,
});

export default client;

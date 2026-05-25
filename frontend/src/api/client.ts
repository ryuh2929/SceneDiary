// frontend/src/api/client.ts
import axios from "axios";
import Constants from "expo-constants"; // 👈 추가

// process.env 대신 Constants.expoConfig.extra를 사용합니다.
const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;

console.log("확인용 주소:", apiUrl); // 이제 여기서 값이 찍히는지 확인!

const client = axios.create({
  baseURL: apiUrl,
});

export default client;

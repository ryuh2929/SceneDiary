import "dotenv/config";
import path from "path";
import dotenv from "dotenv";

// 한 단계 위의 폴더(프로젝트 루트)에 있는 .env 파일을 로드합니다.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default {
  expo: {
    name: "SceneDiary",
    slug: "scenediary",
    version: "1.0.0",
    icon: "./assets/images/icon.png",
    scheme: "frontend",
    updates: {
      enabled: false, // 배포 업데이트 확인을 끕니다 (로컬 개발용)
      fallbackToCacheTimeout: 0,
    },
    ios: {
      bundleIdentifier: "com.aura.scenediary",
      supportsTablet: true,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      package: "com.aura.scenediary",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-web-browser",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "이 앱은 여행 기록을 위해 위치 정보가 필요합니다.",
        },
      ],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#208AEF",
          android: {
            image: "./assets/images/splash-icon.png",
            imageWidth: 76,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    owner: "my-team-name", // 팀 이름을 아무거나 적으세요
    extra: {
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      eas: {
        projectId: "550e8400-e29b-41d4-a716-446655440000", // 임의의 UUID를 생성해서 넣으세요
      },
    },
  },
};

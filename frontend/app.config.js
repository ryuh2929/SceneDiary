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
    userInterfaceStyle: "automatic",
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
      icon: "./assets/images/android-icon-triangle-foreground.png",
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
      "expo-video",
      [
        "expo-build-properties",
        {
          android: {
            // 개발/테스트용: 백엔드가 http(평문 LAN)라서 release(preview) 빌드에서도
            // 평문 통신을 허용해야 연결됨. (debug/Expo Go 는 원래 허용이라 지금까진 됐던 것)
            usesCleartextTraffic: true,
          },
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission:
            "이 앱은 여행 사진의 위치 정보를 읽기 위해 사진 접근 권한이 필요합니다.",
          savePhotosPermission: "이 앱은 사진 저장 권한이 필요합니다.",
          isAccessMediaLocationEnabled: true,
          isSilenceAudioSourcePermission: false,
        },
      ],
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
          backgroundColor: "#152538",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
          android: {
            backgroundColor: "#152538",
            image: "./assets/images/splash-icon.png",
            imageWidth: 76,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY:
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      eas: {
        // 로컬 .env에 EXPO_PUBLIC_EAS_PROJECT_ID가 있으면 그 값(개인 계정), 없으면 팀 공유 ID 사용
        projectId:
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
          "7a721926-fa9a-470f-ace4-f4aa3666005c",
      },
    },
  },
};

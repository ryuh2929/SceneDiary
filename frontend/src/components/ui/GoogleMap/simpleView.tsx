// 📄 따로 만든 파일: MapCard.tsx
import { View, Text, Image, TouchableOpacity } from "react-native";
import { router, useRouter } from "expo-router";
import { Twemoji } from "react-native-twemoji";
// import { FontAwesome5 } from "@expo/vector-icons";
import { Days } from "@/types/api"; // 👈 API 타입 불러오기
interface SimpleViewProps {
  item: Days;
}
export default function SimpleView({ item }: SimpleViewProps) {
  return (
    <View className="absolute bottom-28 left-5 right-5 bg-white p-4 rounded-3xl shadow-lg">
      <TouchableOpacity
        onPress={() => {
          if (!item || !item.id) {
            console.log("아이템 정보가 없습니다!");
            return;
          }
          router.push({
            pathname: "/detail",
            params: { id: `${item.id}` },
          });
        }}
      >
        <View className="flex-row items-center space-x-2">
          <View>
            <Text className="text-xl font-bold p-3">{item.subtitle}</Text>
            <View className="flex-row p-3">
              <Text className="text-sm text-gray-500">
                📍 {item.location_summary}
              </Text>
              <Text>{item.date}</Text>
            </View>
          </View>
          <View className="ml-2">
            {item.emotion ? (
              <Twemoji emoji={item.emotion} size={24} />
            ) : (
              <Text>🙂</Text> // 데이터가 없을 때의 대체재
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

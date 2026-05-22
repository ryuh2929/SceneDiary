// 📄 따로 만든 파일: MapCard.tsx
import { View, Text, Image, TouchableOpacity } from "react-native";
import { router, useRouter } from "expo-router";
import { Twemoji } from "react-native-twemoji";
// import { FontAwesome5 } from "@expo/vector-icons";

interface SimpleViewProps {
  item: {
    id: number; //시리얼 번호
    location: string;
    emoji: string;
    day: string;
    title: string;
    img: string;
    iconName: string;
    // 필요한 다른 데이터들...
  };
}

export default function SimpleView({ item }: SimpleViewProps) {
  return (
    <View className="absolute bottom-28 left-5 right-5 bg-white p-4 rounded-3xl shadow-lg">
      <TouchableOpacity
        onPress={() => {
          router.push({
            pathname: "/Detail",
            params: { id: item.id },
          });
        }}
      >
        <View className="flex-row items-center space-x-2">
          <Image
            source={{ uri: item.img }}
            className="w-[48px] h-[48px] rounded-full"
          />
          <View>
            <Text className="text-xl font-bold p-3">{item.title}</Text>
            <View className="flex-row p-3">
              <Text className="text-sm text-gray-500">📍 {item.location}</Text>
              <Text>{item.location}</Text>
              <Text>{item.day}</Text>
            </View>
          </View>
          <View className="ml-2">
            {/* <FontAwesome5 name={item.iconName} size={56} color="#FF6B6B" /> */}
            <Twemoji emoji={item.emoji} size={24}></Twemoji>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

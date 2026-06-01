import {
  View,
  Text,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Days } from "@/types/api";
import { router, useRouter } from "expo-router";
import { MapPin, Calendar } from "lucide-react-native";

interface SimpleViewProps {
  item: Days;
}

function EmojiIcon({ codepoint, size }: { codepoint: string; size: number }) {
  if (!codepoint) return null;
  const char = codepointToEmoji(codepoint);

  return <Text style={{ fontSize: size }}>{char}</Text>;
}

function codepointToEmoji(codepoint: string): string {
  return codepoint
    .split("-")
    .map((cp) => String.fromCodePoint(parseInt(cp, 16)))
    .join("");
}

export default function SimpleView({ item }: SimpleViewProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const photo =
    item.photos?.find((p) => p.id === item.represent_image) || item.photos?.[0];

  const horizontalMargin = width * 0.03;
  const bottomOffset = height * 0.085 + insets.bottom;
  const imageSize = Math.min(width * 0.2, 88);
  const cardPadding = width * 0.015;
  const borderRadius = width * 0.05;
  const emojiSize = Math.min(width * 0.1, 42);

  return (
    <View
      style={{
        position: "absolute",
        left: horizontalMargin,
        right: horizontalMargin,
        bottom: bottomOffset,
        backgroundColor: "#FFFFFF",
        padding: cardPadding,
        borderRadius,
        shadowColor: "#000000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 8,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          router.push({
            pathname: "/detail",
            params: {
              id: item.trip_id,
              day: item.day_number,
            },
          })
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {photo && (
            <View
              style={{
                width: imageSize,
                height: imageSize,
                borderRadius: imageSize * 0.2,
                overflow: "hidden",
                marginRight: width * 0.02,
              }}
            >
              <Image
                source={{ uri: photo.thumbnail_image_url }}
                style={{ width: imageSize, height: imageSize }}
                resizeMode="cover"
              />
            </View>
          )}

          <View className="flex-1">
            <Text
              className="text-lg text-black font-sans-bold"
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.subtitle}
            </Text>

            <View className="mt-2 flex-row items-center">
              <Text
                className="text-sm text-gray-500 font-sans-bold"
                numberOfLines={1}
              >
                <MapPin size={imageSize * 0.15} color="#39536B" />{" "}
                {item.location_summary}
              </Text>

              <Text
                className="text-sm text-gray-500 flex-1 ml-2"
                numberOfLines={1}
              >
                <Calendar size={imageSize * 0.15} color="#39536B" /> {item.date}
              </Text>
            </View>
          </View>

          <View>
            <EmojiIcon codepoint={item.emotion ?? ""} size={emojiSize} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

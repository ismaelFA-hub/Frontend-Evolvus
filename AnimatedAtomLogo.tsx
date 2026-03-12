import { View } from "react-native";
import { Image } from "expo-image";

interface Props {
  size?: number;
  intensity?: "low" | "medium" | "high";
}

export default function AnimatedAtomLogo({ size = 140 }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
      }}
    >
      <Image
        source={require("../assets/images/logo-3d.gif")}
        style={{ width: size, height: size }}
        contentFit="cover"
        cachePolicy="none"
        autoplay
      />
    </View>
  );
}

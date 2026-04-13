import { View, Text } from "react-native";
import { Image } from "expo-image";
import { cn } from "../../lib/utils";

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: { container: "w-8 h-8", text: "text-xs", px: 32 },
  md: { container: "w-10 h-10", text: "text-sm", px: 40 },
  lg: { container: "w-14 h-14", text: "text-lg", px: 56 },
  xl: { container: "w-20 h-20", text: "text-2xl", px: 80 },
};

export default function Avatar({ uri, name, size = "md", className }: AvatarProps) {
  const s = sizeMap[size];
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  if (uri) {
    return (
      <Image
        source={{ uri }}
        className={cn(s.container, "rounded-full", className)}
        style={{ width: s.px, height: s.px, borderRadius: s.px / 2 }}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View
      className={cn(
        s.container,
        "rounded-full bg-primary/30 items-center justify-center",
        className
      )}
    >
      <Text className={cn("text-primary-light font-sans-bold", s.text)}>
        {initials}
      </Text>
    </View>
  );
}

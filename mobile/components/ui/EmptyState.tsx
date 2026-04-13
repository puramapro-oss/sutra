import { View, Text } from "react-native";
import Button from "./Button";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = "📭",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-5xl mb-4">{icon}</Text>
      <Text className="text-white text-xl font-sans-bold text-center mb-2">
        {title}
      </Text>
      <Text className="text-white/50 text-center font-sans mb-6">
        {description}
      </Text>
      {actionLabel && onAction && (
        <Button onPress={onAction}>{actionLabel}</Button>
      )}
    </View>
  );
}

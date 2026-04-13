import { View, Text } from "react-native";
import { cn } from "../../lib/utils";

interface ProgressBarProps {
  progress: number;
  label?: string;
  showPercentage?: boolean;
  color?: string;
  className?: string;
}

export default function ProgressBar({
  progress,
  label,
  showPercentage = false,
  color = "bg-primary",
  className,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View className={cn("w-full", className)}>
      {(label || showPercentage) && (
        <View className="flex-row justify-between mb-1.5">
          {label && (
            <Text className="text-white/60 text-sm font-sans">{label}</Text>
          )}
          {showPercentage && (
            <Text className="text-white/40 text-sm font-sans">
              {Math.round(clampedProgress)}%
            </Text>
          )}
        </View>
      )}
      <View className="h-2 bg-white/10 rounded-full overflow-hidden">
        <View
          className={cn("h-full rounded-full", color)}
          style={{ width: `${clampedProgress}%` }}
        />
      </View>
    </View>
  );
}

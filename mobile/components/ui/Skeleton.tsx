import { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
  width?: number;
  height?: number;
  borderRadius?: number;
}

export default function Skeleton({
  className,
  width,
  height = 20,
  borderRadius = 8,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={cn("bg-white/10", className)}
      style={[{ opacity, width, height, borderRadius }]}
    />
  );
}

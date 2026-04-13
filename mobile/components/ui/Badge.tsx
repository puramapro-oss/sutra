import { View, Text } from "react-native";
import { cn } from "../../lib/utils";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "secondary";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-white/10",
  primary: "bg-primary/20",
  success: "bg-success/20",
  warning: "bg-warning/20",
  error: "bg-error/20",
  secondary: "bg-secondary/20",
};

const textStyles: Record<BadgeVariant, string> = {
  default: "text-white/70",
  primary: "text-primary-light",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  secondary: "text-secondary",
};

export default function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <View className={cn("px-2.5 py-1 rounded-full self-start", variantStyles[variant], className)}>
      <Text className={cn("text-xs font-sans-medium", textStyles[variant])}>
        {children}
      </Text>
    </View>
  );
}

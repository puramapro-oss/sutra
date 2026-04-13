import { View, type ViewProps } from "react-native";
import { cn } from "../../lib/utils";

interface CardProps extends ViewProps {
  variant?: "glass" | "solid" | "outline";
}

export default function Card({
  variant = "glass",
  className,
  children,
  ...props
}: CardProps) {
  const variantStyles = {
    glass: "bg-white/5 border border-white/[0.06]",
    solid: "bg-white/10",
    outline: "border border-white/10 bg-transparent",
  };

  return (
    <View
      className={cn("rounded-2xl p-4", variantStyles[variant], className)}
      {...props}
    >
      {children}
    </View>
  );
}

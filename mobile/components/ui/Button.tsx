import { TouchableOpacity, Text, ActivityIndicator, type TouchableOpacityProps } from "react-native";
import * as Haptics from "expo-haptics";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  outline: "border border-white/10 bg-transparent",
  ghost: "bg-transparent",
  danger: "bg-error",
};

const variantTextStyles: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-white",
  ghost: "text-white/60",
  danger: "text-white",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-2 rounded-lg",
  md: "px-5 py-3 rounded-xl",
  lg: "px-6 py-4 rounded-2xl",
};

const sizeTextStyles: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  icon,
  children,
  onPress,
  className,
  ...props
}: ButtonProps) {
  const handlePress = async (e: any) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <TouchableOpacity
      className={cn(
        "flex-row items-center justify-center",
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && "opacity-50",
        className
      )}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            className={cn(
              "font-sans-bold text-center",
              variantTextStyles[variant],
              sizeTextStyles[size],
              icon ? "ml-2" : ""
            )}
          >
            {children}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

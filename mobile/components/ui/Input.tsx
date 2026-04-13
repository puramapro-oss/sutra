import { useState } from "react";
import { View, TextInput, Text, TouchableOpacity, type TextInputProps } from "react-native";
import { cn } from "../../lib/utils";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export default function Input({
  label,
  error,
  icon,
  rightIcon,
  onRightIconPress,
  className,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-white/60 text-sm mb-1.5 font-sans-medium">
          {label}
        </Text>
      )}
      <View
        className={cn(
          "flex-row items-center bg-white/5 rounded-xl border px-4",
          isFocused ? "border-primary" : "border-white/[0.06]",
          error ? "border-error" : ""
        )}
      >
        {icon && <View className="mr-3">{icon}</View>}
        <TextInput
          className={cn(
            "flex-1 text-white text-base py-3.5 font-sans",
            className
          )}
          placeholderTextColor="rgba(255,255,255,0.3)"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text className="text-error text-sm mt-1 font-sans">{error}</Text>
      )}
    </View>
  );
}

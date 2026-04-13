import { Modal as RNModal, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { cn } from "../../lib/utils";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ visible, onClose, title, children, className }: ModalProps) {
  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <TouchableOpacity
          className="flex-1 bg-black/60 justify-end"
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View
              className={cn(
                "bg-[#0A0A0F] rounded-t-3xl border-t border-white/[0.06] px-6 pt-4 pb-8",
                className
              )}
            >
              <View className="w-10 h-1 bg-white/20 rounded-full self-center mb-4" />
              {title && (
                <Text className="text-white text-xl font-sans-bold mb-4">
                  {title}
                </Text>
              )}
              {children}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

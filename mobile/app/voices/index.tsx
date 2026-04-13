import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { VOICES, THEME } from "../../lib/constants";
import { Card, Button, Badge } from "../../components/ui";

export default function VoicesScreen() {
  const router = useRouter();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const playPreview = async (voiceId: string) => {
    try {
      if (playingId === voiceId) {
        setPlayingId(null);
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPlayingId(voiceId);

      // Audio preview - simulate playback duration
      setTimeout(() => {
        setPlayingId(null);
      }, 3000);
    } catch (err) {
      setPlayingId(null);
      Alert.alert("Erreur", "Impossible de lire l'apercu audio.");
    }
  };

  const selectVoice = (voiceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedId(voiceId);
  };

  const confirmSelection = () => {
    if (!selectedId) {
      Alert.alert("Erreur", "Selectionne une voix.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const getGenderIcon = (gender: string) => {
    return gender === "male" ? "man" : "woman";
  };

  const getGenderLabel = (gender: string) => {
    return gender === "male" ? "Masculine" : "Feminine";
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="voices-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="voices-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Voix</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        <Card className="mb-6 p-4">
          <Text className="text-white font-sans-bold text-base mb-1">Choisis ta voix</Text>
          <Text className="text-white/40 font-sans text-sm">
            Chaque voix est optimisee pour la narration video. Ecoute un apercu avant de choisir.
          </Text>
        </Card>

        {VOICES.map((voice) => {
          const isSelected = selectedId === voice.id;
          const isPlaying = playingId === voice.id;

          return (
            <TouchableOpacity
              key={voice.id}
              onPress={() => selectVoice(voice.id)}
              testID={`voice-card-${voice.id}`}
            >
              <Card
                className={`mb-3 ${isSelected ? "border border-primary" : ""}`}
              >
                <View className="flex-row items-center">
                  <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${isSelected ? "bg-primary/20" : "bg-white/10"}`}>
                    <Ionicons
                      name={getGenderIcon(voice.gender)}
                      size={24}
                      color={isSelected ? THEME.primary : THEME.textSecondary}
                    />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className={`font-sans-bold text-lg ${isSelected ? "text-primary-light" : "text-white"}`}>
                        {voice.name}
                      </Text>
                      <Badge variant={voice.gender === "male" ? "secondary" : "primary"}>
                        {getGenderLabel(voice.gender)}
                      </Badge>
                    </View>
                    <Text className="text-white/40 font-sans text-sm mt-0.5">
                      Voix {voice.gender === "male" ? "masculine" : "feminine"} naturelle
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => playPreview(voice.id)}
                    className={`w-10 h-10 rounded-full items-center justify-center ${isPlaying ? "bg-primary" : "bg-white/10"}`}
                    testID={`play-voice-${voice.id}`}
                  >
                    <Ionicons
                      name={isPlaying ? "pause" : "play"}
                      size={18}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>

                {isSelected && (
                  <View className="mt-3 pt-3 border-t border-white/[0.06]">
                    <View className="flex-row items-center">
                      <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                      <Text className="text-success font-sans text-sm ml-1">Selectionnee</Text>
                    </View>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}

        <Button
          onPress={confirmSelection}
          disabled={!selectedId}
          testID="confirm-voice"
          className="mt-4"
        >
          Confirmer la selection
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

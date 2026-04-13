import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { THEME } from "../../lib/constants";
import { Card, Button, Badge } from "../../components/ui";

interface VideoStyle {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  color: string;
}

const STYLES: VideoStyle[] = [
  {
    id: "cinematic",
    name: "Cinematique",
    description: "Plans larges, transitions douces, atmosphere grandiose. Ideal pour le storytelling.",
    icon: "🎬",
    tags: ["Pro", "Premium"],
    color: "#8B5CF6",
  },
  {
    id: "vlog",
    name: "Vlog",
    description: "Style dynamique, coupes rapides, face camera. Parfait pour les reseaux sociaux.",
    icon: "📹",
    tags: ["Populaire"],
    color: "#F59E0B",
  },
  {
    id: "documentary",
    name: "Documentaire",
    description: "Narration posee, images d'illustration, sous-titres. Format educatif.",
    icon: "🎞",
    tags: ["Educatif"],
    color: "#06B6D4",
  },
  {
    id: "dynamic",
    name: "Dynamique",
    description: "Rythme soutenu, effets visuels, musique energique. Impact maximal.",
    icon: "⚡",
    tags: ["TikTok", "Reels"],
    color: "#EF4444",
  },
  {
    id: "minimal",
    name: "Minimaliste",
    description: "Epure, texte anime, fond uni. Elegant et professionnel.",
    icon: "✨",
    tags: ["Clean"],
    color: "#10B981",
  },
  {
    id: "retro",
    name: "Retro",
    description: "Grain de film, couleurs chaudes, effets vintage. Ambiance nostalgique.",
    icon: "📼",
    tags: ["Artistique"],
    color: "#F472B6",
  },
  {
    id: "news",
    name: "Flash info",
    description: "Presentation formelle, bandeaux, incrustation. Format journal.",
    icon: "📰",
    tags: ["Actualite"],
    color: "#3B82F6",
  },
  {
    id: "tutorial",
    name: "Tutoriel",
    description: "Etapes numerotees, fleches, zooms. Pedagogique et clair.",
    icon: "📚",
    tags: ["Educatif", "How-to"],
    color: "#22C55E",
  },
  {
    id: "storytelling",
    name: "Storytelling",
    description: "Narration immersive, musique emotionnelle, plans rapproches. Captivant.",
    icon: "📖",
    tags: ["Emotion"],
    color: "#D946EF",
  },
  {
    id: "podcast",
    name: "Podcast visuel",
    description: "Ondes audio, fond colore, sous-titres animes. Contenu audio en video.",
    icon: "🎙",
    tags: ["Audio"],
    color: "#14B8A6",
  },
];

export default function StylesScreen() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectStyle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedId(id);
  };

  const confirmSelection = () => {
    if (!selectedId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="styles-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="styles-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Styles video</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        <Card className="mb-6 p-4">
          <Text className="text-white font-sans-bold text-base mb-1">Choisis ton style</Text>
          <Text className="text-white/40 font-sans text-sm">
            Le style determine l'ambiance visuelle de ta video : transitions, rythme, et mise en scene.
          </Text>
        </Card>

        {STYLES.map((style) => {
          const isSelected = selectedId === style.id;

          return (
            <TouchableOpacity
              key={style.id}
              onPress={() => selectStyle(style.id)}
              testID={`style-card-${style.id}`}
            >
              <Card className={`mb-3 ${isSelected ? "border border-primary" : ""}`}>
                <View className="flex-row items-start">
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: `${style.color}20` }}
                  >
                    <Text className="text-2xl">{style.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className={`font-sans-bold text-base ${isSelected ? "text-primary-light" : "text-white"}`}>
                        {style.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                      )}
                    </View>
                    <Text className="text-white/40 font-sans text-sm mb-2">{style.description}</Text>
                    <View className="flex-row gap-1">
                      {style.tags.map((tag) => (
                        <Badge key={tag} variant="default">{tag}</Badge>
                      ))}
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}

        <Button
          onPress={confirmSelection}
          disabled={!selectedId}
          testID="confirm-style"
          className="mt-4"
        >
          Confirmer le style
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { THEME } from "../../lib/constants";
import { Card, Button, ProgressBar } from "../../components/ui";

const STEPS = [
  {
    icon: "videocam" as const,
    title: "Cree ta premiere video",
    description:
      "Va dans Creer, ecris ton idee et laisse SUTRA generer une video pro en quelques minutes.",
    tip: "Commence par 15 secondes.",
  },
  {
    icon: "color-palette" as const,
    title: "Personnalise ton style",
    description: "Explore les styles visuels et templates pour trouver ton identite.",
    tip: "Le style Cinematique est le plus populaire.",
  },
  {
    icon: "mic" as const,
    title: "Clone ta voix",
    description: "Enregistre 30 secondes pour creer un clone IA de ta voix.",
    tip: "Parle clairement dans un endroit calme.",
  },
  {
    icon: "rocket" as const,
    title: "Active le Mode Autonome",
    description: "Configure themes, planning, et laisse SUTRA publier automatiquement.",
    tip: "1 video/semaine pour commencer.",
  },
  {
    icon: "share-social" as const,
    title: "Publie sur tes reseaux",
    description: "Connecte YouTube, Instagram, TikTok via Zernio.",
    tip: "Publie a 12h et 18h-20h.",
  },
  {
    icon: "people" as const,
    title: "Invite tes amis",
    description: "50% du 1er paiement + 10% a vie sur chaque filleul.",
    tip: "3 filleuls = abo rembourse.",
  },
  {
    icon: "wallet" as const,
    title: "Gagne de l'argent",
    description: "Points, cashback, concours, parrainage, mode createur.",
    tip: "Consulte /financer pour rembourser ton abo.",
  },
  {
    icon: "trophy" as const,
    title: "Monte en niveau",
    description: "Chaque action donne de l'XP. Eveille → Conscient → Aligne → Illumine → Unifie.",
    tip: "Le streak multiplie tes gains x10.",
  },
];

export default function GuideScreen() {
  const router = useRouter();
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(0);

  const toggle = (i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(expanded === i ? null : i);
  };

  const markDone = (i: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const progress = completed.size / STEPS.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.background }}>
      <ScrollView className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">Guide SUTRA</Text>
            <Text className="text-white/50 text-sm">
              8 etapes pour maitriser SUTRA
            </Text>
          </View>
        </View>

        {/* Progress */}
        <View className="mb-6">
          <ProgressBar progress={progress} />
          <Text className="text-white/30 text-xs mt-1">
            {completed.size}/{STEPS.length} terminees ({Math.round(progress * 100)}%)
          </Text>
        </View>

        {/* Steps */}
        {STEPS.map((step, i) => {
          const isDone = completed.has(i);
          const isOpen = expanded === i;

          return (
            <TouchableOpacity
              key={i}
              onPress={() => toggle(i)}
              className={`mb-2 rounded-xl border p-4 ${
                isOpen
                  ? "bg-violet-500/[0.06] border-violet-500/30"
                  : "bg-white/[0.03] border-white/[0.08]"
              }`}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <View
                  className={`w-9 h-9 rounded-lg items-center justify-center mr-3 ${
                    isDone
                      ? "bg-green-500/20"
                      : isOpen
                        ? "bg-violet-500/20"
                        : "bg-white/5"
                  }`}
                >
                  {isDone ? (
                    <Ionicons name="checkmark" size={18} color="#10B981" />
                  ) : (
                    <Ionicons
                      name={step.icon}
                      size={18}
                      color={isOpen ? "#8B5CF6" : "#ffffff50"}
                    />
                  )}
                </View>
                <Text
                  className={`flex-1 text-sm font-semibold ${
                    isDone ? "text-green-400 line-through" : "text-white"
                  }`}
                >
                  {i + 1}. {step.title}
                </Text>
                <Ionicons
                  name={isOpen ? "chevron-down" : "chevron-forward"}
                  size={16}
                  color="#ffffff30"
                />
              </View>

              {isOpen && (
                <View className="mt-3 ml-12">
                  <Text className="text-white/60 text-sm mb-2">
                    {step.description}
                  </Text>
                  <View className="bg-violet-500/[0.06] border border-violet-500/20 rounded-lg p-3 mb-3">
                    <Text className="text-violet-300 text-xs">
                      💡 {step.tip}
                    </Text>
                  </View>
                  <Button
                    onPress={() => markDone(i)}
                    variant={isDone ? "secondary" : "outline"}
                    size="sm"
                  >
                    {isDone ? "Termine ✓" : "Marquer comme fait"}
                  </Button>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}

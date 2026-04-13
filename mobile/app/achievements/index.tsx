import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { THEME } from "../../lib/constants";
import { Card, Badge, Skeleton, EmptyState, ProgressBar } from "../../components/ui";
import type { Achievement, UserAchievement } from "../../types/database";

interface AchievementsData {
  achievements: Array<
    Achievement & {
      unlocked: boolean;
      unlocked_at: string | null;
      progress: number;
      target: number;
    }
  >;
  total_xp: number;
  unlocked_count: number;
}

export default function AchievementsScreen() {
  const router = useRouter();
  const [data, setData] = useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAchievements = useCallback(async () => {
    try {
      const res = await apiFetch<AchievementsData>("/api/achievements");
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger les succes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAchievements();
  }, [fetchAchievements]);

  return (
    <SafeAreaView className="flex-1 bg-background" testID="achievements-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="achievements-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Succes</Text>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={80} className="rounded-2xl mb-4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={100} className="rounded-2xl mb-3" />
          ))}
        </View>
      ) : !data ? (
        <EmptyState
          icon="🏆"
          title="Succes indisponibles"
          description="Impossible de charger tes succes."
          actionLabel="Reessayer"
          onAction={fetchAchievements}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
        >
          {/* Stats */}
          <Card className="mb-6 p-4">
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text className="text-white text-2xl font-sans-bold">{data.unlocked_count}</Text>
                <Text className="text-white/40 font-sans text-xs">Debloques</Text>
              </View>
              <View className="w-px bg-white/10" />
              <View className="items-center flex-1">
                <Text className="text-white text-2xl font-sans-bold">{data.achievements.length}</Text>
                <Text className="text-white/40 font-sans text-xs">Total</Text>
              </View>
              <View className="w-px bg-white/10" />
              <View className="items-center flex-1">
                <Text className="text-primary-light text-2xl font-sans-bold">{data.total_xp}</Text>
                <Text className="text-white/40 font-sans text-xs">XP gagnes</Text>
              </View>
            </View>
            <ProgressBar
              progress={(data.unlocked_count / data.achievements.length) * 100}
              showPercentage
              label="Progression globale"
              className="mt-4"
            />
          </Card>

          {/* Achievements Grid */}
          {data.achievements.map((achievement) => (
            <Card
              key={achievement.id}
              className={`mb-3 ${!achievement.unlocked ? "opacity-50" : ""}`}
              testID={`achievement-${achievement.key}`}
            >
              <View className="flex-row items-start">
                <View className="w-12 h-12 rounded-xl bg-white/10 items-center justify-center mr-3">
                  <Text className="text-2xl">{achievement.icon}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Text className="text-white font-sans-bold text-base flex-1">
                      {achievement.name}
                    </Text>
                    {achievement.unlocked && (
                      <Ionicons name="checkmark-circle" size={18} color={THEME.success} />
                    )}
                  </View>
                  <Text className="text-white/50 font-sans text-sm mb-2">
                    {achievement.description}
                  </Text>
                  <View className="flex-row items-center gap-2 mb-2">
                    <Badge variant="primary">+{achievement.xp_reward} XP</Badge>
                    <Badge variant="secondary">+{achievement.points_reward} pts</Badge>
                  </View>
                  {!achievement.unlocked && (
                    <ProgressBar
                      progress={(achievement.progress / achievement.target) * 100}
                      label={`${achievement.progress} / ${achievement.target}`}
                      showPercentage
                    />
                  )}
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

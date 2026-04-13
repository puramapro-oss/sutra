import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
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
import { formatPrice, formatDate } from "../../lib/utils";
import { Card, Badge, Skeleton, EmptyState, Avatar, ProgressBar } from "../../components/ui";

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  avatar: string | null;
  score: number;
  referrals: number;
  subscriptions: number;
  active_days: number;
  missions: number;
}

interface ContestData {
  leaderboard: LeaderboardEntry[];
  my_rank: number | null;
  my_score: number;
  period: string;
  period_end: string;
  pool_amount: number;
  score_breakdown: {
    referrals: number;
    subscriptions: number;
    active_days: number;
    missions: number;
  };
}

export default function ContestScreen() {
  const router = useRouter();
  const [data, setData] = useState<ContestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchContest = useCallback(async () => {
    try {
      const res = await apiFetch<ContestData>("/api/contest");
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger le classement.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchContest();
  }, [fetchContest]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchContest();
  }, [fetchContest]);

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return { emoji: "🥇", color: "#FFD700" };
    if (rank === 2) return { emoji: "🥈", color: "#C0C0C0" };
    if (rank === 3) return { emoji: "🥉", color: "#CD7F32" };
    return { emoji: `#${rank}`, color: THEME.textSecondary };
  };

  const getRewardPercentage = (rank: number) => {
    const rewards: Record<number, number> = {
      1: 2, 2: 1, 3: 0.7, 4: 0.5, 5: 0.4,
      6: 0.3, 7: 0.275, 8: 0.275, 9: 0.275, 10: 0.275,
    };
    return rewards[rank] ?? 0;
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="contest-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="contest-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Classement hebdo</Text>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={120} className="rounded-2xl mb-4" />
          <Skeleton height={80} className="rounded-2xl mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={60} className="rounded-2xl mb-2" />
          ))}
        </View>
      ) : !data ? (
        <EmptyState
          icon="🏆"
          title="Classement indisponible"
          description="Impossible de charger le concours."
          actionLabel="Reessayer"
          onAction={fetchContest}
        />
      ) : (
        <FlatList
          data={data.leaderboard}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
          ListHeaderComponent={
            <View className="mb-6">
              {/* Period & Pool */}
              <Card className="mb-4 p-6 items-center">
                <Text className="text-5xl mb-2">🏆</Text>
                <Text className="text-white font-sans-bold text-lg mb-1">Concours de la semaine</Text>
                <Text className="text-white/40 font-sans text-sm mb-3">
                  Termine le {formatDate(data.period_end)}
                </Text>
                <Text className="text-primary-light text-3xl font-sans-bold">
                  {formatPrice(data.pool_amount)}
                </Text>
                <Text className="text-white/40 font-sans text-sm">a gagner (6% du CA)</Text>
              </Card>

              {/* My Score */}
              <Card className="mb-4 p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white font-sans-bold text-base">Ton score</Text>
                  {data.my_rank && (
                    <Badge variant={data.my_rank <= 10 ? "success" : "default"}>
                      Rang #{data.my_rank}
                    </Badge>
                  )}
                </View>
                <Text className="text-white text-3xl font-sans-bold mb-4" testID="my-score">
                  {data.my_score} pts
                </Text>

                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white/60 font-sans text-sm">Parrainages ({data.score_breakdown.referrals})</Text>
                    <Text className="text-white font-sans-medium text-sm">
                      +{data.score_breakdown.referrals * 10} pts
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white/60 font-sans text-sm">Abonnements ({data.score_breakdown.subscriptions})</Text>
                    <Text className="text-white font-sans-medium text-sm">
                      +{data.score_breakdown.subscriptions * 50} pts
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white/60 font-sans text-sm">Jours actifs ({data.score_breakdown.active_days})</Text>
                    <Text className="text-white font-sans-medium text-sm">
                      +{data.score_breakdown.active_days * 5} pts
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-white/60 font-sans text-sm">Missions ({data.score_breakdown.missions})</Text>
                    <Text className="text-white font-sans-medium text-sm">
                      +{data.score_breakdown.missions * 3} pts
                    </Text>
                  </View>
                </View>
              </Card>

              <Text className="text-white text-lg font-sans-bold mb-3">Top 10</Text>
            </View>
          }
          renderItem={({ item }) => {
            const rankDisplay = getRankDisplay(item.rank);
            const reward = getRewardPercentage(item.rank);
            return (
              <Card
                className={`mb-2 ${item.rank <= 3 ? "border border-white/10" : ""}`}
                testID={`leaderboard-${item.rank}`}
              >
                <View className="flex-row items-center">
                  <Text className="text-lg w-8 text-center" style={{ color: rankDisplay.color }}>
                    {rankDisplay.emoji}
                  </Text>
                  <Avatar uri={item.avatar} name={item.full_name} size="sm" />
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-sans-medium">{item.full_name}</Text>
                    <Text className="text-white/40 font-sans text-xs">
                      {item.referrals} parr. | {item.active_days}j actifs | {item.missions} missions
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-white font-sans-bold">{item.score} pts</Text>
                    {reward > 0 && (
                      <Text className="text-success font-sans text-xs">{reward}% CA</Text>
                    )}
                  </View>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="📊"
              title="Aucun participant"
              description="Le classement est vide pour cette semaine."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

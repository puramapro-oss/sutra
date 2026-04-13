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
import { useAuthStore } from "../../lib/store";
import { THEME } from "../../lib/constants";
import { formatPoints } from "../../lib/utils";
import { Card, Badge, Skeleton, EmptyState, Avatar } from "../../components/ui";

interface LeaderboardUser {
  rank: number;
  user_id: string;
  full_name: string;
  avatar: string | null;
  points: number;
  level: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardUser[];
  my_rank: number | null;
  my_points: number;
  period: "all_time" | "weekly";
}

export default function ClassementScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<"all_time" | "weekly">("all_time");

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await apiFetch<LeaderboardData>(
        `/api/points?action=leaderboard&period=${period}`
      );
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger le classement.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const togglePeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPeriod((p) => (p === "all_time" ? "weekly" : "all_time"));
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: "bg-yellow-500/20", text: "#FFD700", emoji: "🥇" };
    if (rank === 2) return { bg: "bg-gray-400/20", text: "#C0C0C0", emoji: "🥈" };
    if (rank === 3) return { bg: "bg-orange-400/20", text: "#CD7F32", emoji: "🥉" };
    return { bg: "bg-white/5", text: THEME.textSecondary, emoji: `#${rank}` };
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="classement-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="classement-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4 flex-1">Classement</Text>
      </View>

      {/* Period Toggle */}
      <View className="flex-row mx-4 mb-4 bg-white/5 rounded-xl p-1">
        <TouchableOpacity
          className={`flex-1 py-2.5 rounded-lg items-center ${period === "all_time" ? "bg-primary" : ""}`}
          onPress={() => { setPeriod("all_time"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          testID="period-all-time"
        >
          <Text className={`font-sans-medium text-sm ${period === "all_time" ? "text-white" : "text-white/60"}`}>
            Tous les temps
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2.5 rounded-lg items-center ${period === "weekly" ? "bg-primary" : ""}`}
          onPress={() => { setPeriod("weekly"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          testID="period-weekly"
        >
          <Text className={`font-sans-medium text-sm ${period === "weekly" ? "text-white" : "text-white/60"}`}>
            Cette semaine
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={80} className="rounded-2xl mb-4" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={56} className="rounded-2xl mb-2" />
          ))}
        </View>
      ) : !data ? (
        <EmptyState
          icon="📊"
          title="Classement indisponible"
          description="Impossible de charger le classement."
          actionLabel="Reessayer"
          onAction={fetchLeaderboard}
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
            data.my_rank ? (
              <Card className="mb-6 p-4 border border-primary/30">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
                    <Text className="text-primary-light font-sans-bold">#{data.my_rank}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-sans-bold">Ta position</Text>
                    <Text className="text-white/40 font-sans text-sm">
                      {formatPoints(data.my_points)} points
                    </Text>
                  </View>
                  <Badge variant="primary">Niv. {user?.level ?? 1}</Badge>
                </View>
              </Card>
            ) : null
          }
          renderItem={({ item }) => {
            const style = getRankStyle(item.rank);
            const isMe = item.user_id === user?.id;
            return (
              <Card
                className={`mb-2 ${isMe ? "border border-primary/30" : ""}`}
                testID={`rank-${item.rank}`}
              >
                <View className="flex-row items-center">
                  <Text className="text-lg w-10 text-center" style={{ color: style.text }}>
                    {style.emoji}
                  </Text>
                  <Avatar uri={item.avatar} name={item.full_name} size="sm" />
                  <View className="ml-3 flex-1">
                    <Text className={`font-sans-medium ${isMe ? "text-primary-light" : "text-white"}`}>
                      {item.full_name}{isMe ? " (toi)" : ""}
                    </Text>
                    <Text className="text-white/40 font-sans text-xs">Niveau {item.level}</Text>
                  </View>
                  <Text className="text-white font-sans-bold">{formatPoints(item.points)}</Text>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="🏅"
              title="Aucun participant"
              description="Le classement est vide pour le moment."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

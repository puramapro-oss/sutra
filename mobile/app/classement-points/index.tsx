import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { THEME } from "../../lib/constants";
import { Card, Skeleton } from "../../components/ui";

interface RankedUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  purama_points: number;
  level: number;
  streak: number;
}

function formatPoints(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const RANK_COLORS = ["#F59E0B", "#94A3B8", "#EA580C"];

export default function ClassementPointsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<RankedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await apiFetch<{ users: RankedUser[] }>("/api/points/leaderboard");
      setUsers(data.users || []);
    } catch {
      // Defaults
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const renderItem = ({ item, index }: { item: RankedUser; index: number }) => {
    const rank = index + 1;
    const isMe = item.id === user?.id;
    const color = rank <= 3 ? RANK_COLORS[rank - 1] : "#ffffff40";

    return (
      <View
        className={`flex-row items-center p-3 rounded-xl mb-2 ${
          isMe
            ? "bg-violet-500/[0.08] border border-violet-500/30"
            : rank <= 3
              ? "bg-white/[0.04] border border-white/[0.08]"
              : "bg-white/[0.02]"
        }`}
      >
        {/* Rank */}
        <View className="w-8 items-center mr-3">
          {rank <= 3 ? (
            <Ionicons
              name={rank === 1 ? "trophy" : "medal"}
              size={20}
              color={color}
            />
          ) : (
            <Text className="text-white/40 text-sm font-bold">{rank}</Text>
          )}
        </View>

        {/* Avatar */}
        <View className="w-9 h-9 rounded-full bg-white/10 items-center justify-center mr-3">
          <Text className="text-white/50 text-xs font-bold">
            {(item.full_name || "?")[0]?.toUpperCase()}
          </Text>
        </View>

        {/* Name */}
        <View className="flex-1">
          <Text
            className={`text-sm font-medium ${isMe ? "text-violet-300" : "text-white/80"}`}
            numberOfLines={1}
          >
            {item.full_name || "Createur anonyme"}
            {isMe ? " (toi)" : ""}
          </Text>
          <Text className="text-white/30 text-xs">
            Niv. {item.level || 1}
            {item.streak > 0 ? ` · ${item.streak}j` : ""}
          </Text>
        </View>

        {/* Points */}
        <View className="items-end">
          <Text
            className="text-sm font-bold"
            style={{ color: rank <= 3 ? color : "#ffffff70" }}
          >
            {formatPoints(item.purama_points)}
          </Text>
          <Text className="text-white/20 text-[10px]">pts</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.background }}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 mb-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View>
          <Text className="text-white text-xl font-bold">Classement Points</Text>
          <Text className="text-white/50 text-sm">Top 50 createurs SUTRA</Text>
        </View>
      </View>

      {loading ? (
        <View className="px-4 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchLeaderboard();
              }}
              tintColor="#8B5CF6"
            />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="trophy-outline" size={48} color="#ffffff20" />
              <Text className="text-white/40 text-sm mt-3">
                Aucun classement pour le moment
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

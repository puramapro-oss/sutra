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
import { Card, Badge, Skeleton, EmptyState, Avatar } from "../../components/ui";
import type { LotteryDraw } from "../../types/database";

interface WinnerWithProfile {
  id: string;
  draw_id: string;
  user_id: string;
  rank: number;
  amount_won: number;
  profile?: { full_name: string; avatar: string | null };
}

interface LotteryData {
  current_draw: LotteryDraw | null;
  my_tickets: number;
  past_draws: Array<
    Omit<LotteryDraw, "winners"> & {
      winners: WinnerWithProfile[];
    }
  >;
  ticket_sources: Array<{ source: string; count: number }>;
}

export default function LotteryScreen() {
  const router = useRouter();
  const [data, setData] = useState<LotteryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLottery = useCallback(async () => {
    try {
      const res = await apiFetch<LotteryData>("/api/lottery");
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger la loterie.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLottery();
  }, [fetchLottery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLottery();
  }, [fetchLottery]);

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      inscription: "Inscription",
      parrainage: "Parrainage",
      mission: "Mission",
      partage: "Partage",
      note: "Avis store",
      challenge: "Challenge",
      streak: "Serie",
      abo: "Abonnement",
      achat_points: "Achat points",
    };
    return labels[source] ?? source;
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="lottery-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="lottery-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Tirage mensuel</Text>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={180} className="rounded-2xl mb-4" />
          <Skeleton height={80} className="rounded-2xl mb-4" />
          <Skeleton height={60} className="rounded-2xl mb-2" />
          <Skeleton height={60} className="rounded-2xl" />
        </View>
      ) : !data ? (
        <EmptyState
          icon="🎰"
          title="Loterie indisponible"
          description="Impossible de charger les donnees de la loterie."
          actionLabel="Reessayer"
          onAction={fetchLottery}
        />
      ) : (
        <FlatList
          data={data.past_draws}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
          ListHeaderComponent={
            <View className="mb-6">
              {/* Current Draw */}
              {data.current_draw && (
                <Card className="mb-4 p-6 items-center">
                  <Text className="text-5xl mb-3">🎰</Text>
                  <Badge
                    variant={data.current_draw.status === "live" ? "success" : "secondary"}
                    className="mb-3"
                  >
                    {data.current_draw.status === "live" ? "En cours" : "A venir"}
                  </Badge>
                  <Text className="text-white text-lg font-sans-bold mb-1">Prochain tirage</Text>
                  <Text className="text-white/60 font-sans text-sm mb-4">
                    {formatDate(data.current_draw.draw_date)}
                  </Text>
                  <Text className="text-primary-light text-3xl font-sans-bold mb-2">
                    {formatPrice(data.current_draw.pool_amount)}
                  </Text>
                  <Text className="text-white/40 font-sans text-sm">Cagnotte totale</Text>
                </Card>
              )}

              {/* My Tickets */}
              <Card className="mb-4 p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white font-sans-bold text-base">Tes tickets</Text>
                  <View className="flex-row items-center bg-primary/20 px-3 py-1 rounded-full">
                    <Ionicons name="ticket" size={14} color={THEME.primary} />
                    <Text className="text-primary-light font-sans-bold text-sm ml-1" testID="ticket-count">
                      {data.my_tickets}
                    </Text>
                  </View>
                </View>

                {data.ticket_sources.length > 0 ? (
                  data.ticket_sources.map((source) => (
                    <View key={source.source} className="flex-row items-center justify-between py-1.5">
                      <Text className="text-white/60 font-sans text-sm">{getSourceLabel(source.source)}</Text>
                      <Text className="text-white font-sans-medium text-sm">+{source.count}</Text>
                    </View>
                  ))
                ) : (
                  <Text className="text-white/40 font-sans text-sm">
                    Gagne des tickets en parrainant, completant des missions, et partageant !
                  </Text>
                )}
              </Card>

              <Text className="text-white text-lg font-sans-bold mb-3">Tirages precedents</Text>
            </View>
          }
          renderItem={({ item: draw }) => (
            <Card className="mb-3" testID={`draw-${draw.id}`}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white font-sans-bold">{formatDate(draw.draw_date)}</Text>
                <Badge variant="success">{formatPrice(draw.pool_amount)}</Badge>
              </View>
              {draw.winners.map((winner) => (
                <View key={winner.id} className="flex-row items-center py-1.5">
                  <Text className="text-lg w-8">{getRankEmoji(winner.rank)}</Text>
                  <Avatar uri={winner.profile?.avatar} name={winner.profile?.full_name} size="sm" />
                  <Text className="text-white font-sans text-sm ml-2 flex-1">
                    {winner.profile?.full_name ?? "Utilisateur"}
                  </Text>
                  <Text className="text-success font-sans-bold text-sm">{formatPrice(winner.amount_won)}</Text>
                </View>
              ))}
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="Aucun tirage passe"
              description="Le premier tirage aura lieu bientot !"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

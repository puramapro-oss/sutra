import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../lib/store";
import { apiFetch } from "../../lib/api";
import { Card, Badge, Avatar, Skeleton } from "../../components/ui";
import { formatPoints } from "../../lib/utils";
import type { Video, DailyGift } from "../../types/database";

interface DashboardData {
  videos: Video[];
  stats: { total_videos: number; total_views: number; total_likes: number };
  daily_gift_available: boolean;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const [videosRes, statsRes] = await Promise.all([
        apiFetch<{ videos: Video[] }>("/api/auto/videos?limit=5"),
        apiFetch<{ stats: DashboardData["stats"]; daily_gift_available: boolean }>("/api/points"),
      ]);
      setData({
        videos: videosRes.videos || [],
        stats: statsRes.stats || { total_videos: 0, total_views: 0, total_likes: 0 },
        daily_gift_available: statsRes.daily_gift_available || false,
      });
    } catch {
      setData({
        videos: [],
        stats: { total_videos: 0, total_views: 0, total_likes: 0 },
        daily_gift_available: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B5CF6"
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between py-4">
          <View className="flex-row items-center">
            <Avatar
              uri={user?.avatar}
              name={user?.full_name}
              size="md"
            />
            <View className="ml-3">
              <Text className="text-white/50 text-sm font-sans">Bonjour</Text>
              <Text className="text-white text-lg font-sans-bold">
                {user?.full_name || "Réalisateur"}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.push("/notifications")}
              className="bg-white/5 w-10 h-10 rounded-full items-center justify-center"
              testID="nav-notifications"
            >
              <Text className="text-lg">🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              className="bg-white/5 w-10 h-10 rounded-full items-center justify-center"
              testID="nav-settings"
            >
              <Text className="text-lg">⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan & Points */}
        <Card className="mb-4">
          <View className="flex-row justify-between items-center">
            <View>
              <Badge variant="primary">{user?.plan?.toUpperCase() || "FREE"}</Badge>
              <Text className="text-white/40 text-xs font-sans mt-2">
                {user?.credits || 0} crédits restants
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-primary text-xl font-sans-bold">
                {formatPoints(user?.purama_points || 0)}
              </Text>
              <Text className="text-white/40 text-xs font-sans">
                Purama Points
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            className="flex-1 bg-primary/20 rounded-2xl p-4 items-center"
            onPress={() => router.push("/(tabs)/create")}
            testID="quick-create"
          >
            <Text className="text-2xl mb-1">🎬</Text>
            <Text className="text-white text-sm font-sans-bold">Créer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-secondary/20 rounded-2xl p-4 items-center"
            onPress={() => router.push("/templates")}
            testID="quick-templates"
          >
            <Text className="text-2xl mb-1">📋</Text>
            <Text className="text-white text-sm font-sans-bold">Templates</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-success/20 rounded-2xl p-4 items-center"
            onPress={() => router.push("/autopilot")}
            testID="quick-autopilot"
          >
            <Text className="text-2xl mb-1">🤖</Text>
            <Text className="text-white text-sm font-sans-bold">Autopilot</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-warning/20 rounded-2xl p-4 items-center"
            onPress={() => router.push("/boutique")}
            testID="quick-boutique"
          >
            <Text className="text-2xl mb-1">🎁</Text>
            <Text className="text-white text-sm font-sans-bold">Boutique</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <Text className="text-white text-lg font-sans-bold mb-3">
          Tes statistiques
        </Text>
        <View className="flex-row gap-3 mb-4">
          {loading ? (
            <>
              <Skeleton className="flex-1" height={80} borderRadius={16} />
              <Skeleton className="flex-1" height={80} borderRadius={16} />
              <Skeleton className="flex-1" height={80} borderRadius={16} />
            </>
          ) : (
            <>
              <Card className="flex-1 items-center">
                <Text className="text-white text-xl font-sans-bold">
                  {data?.stats.total_videos || 0}
                </Text>
                <Text className="text-white/40 text-xs font-sans">Vidéos</Text>
              </Card>
              <Card className="flex-1 items-center">
                <Text className="text-white text-xl font-sans-bold">
                  {data?.stats.total_views || 0}
                </Text>
                <Text className="text-white/40 text-xs font-sans">Vues</Text>
              </Card>
              <Card className="flex-1 items-center">
                <Text className="text-white text-xl font-sans-bold">
                  {user?.streak || 0}
                </Text>
                <Text className="text-white/40 text-xs font-sans">Streak</Text>
              </Card>
            </>
          )}
        </View>

        {/* Menu Grid */}
        <Text className="text-white text-lg font-sans-bold mb-3">
          Explorer
        </Text>
        <View className="flex-row flex-wrap gap-3 mb-4">
          {[
            { emoji: "💰", name: "Wallet", route: "/wallet" },
            { emoji: "👥", name: "Parrainage", route: "/referral" },
            { emoji: "🏆", name: "Concours", route: "/contest" },
            { emoji: "🎰", name: "Tirage", route: "/lottery" },
            { emoji: "🏅", name: "Succès", route: "/achievements" },
            { emoji: "📊", name: "Analytics", route: "/analytics" },
            { emoji: "🏅", name: "Classement", route: "/classement" },
            { emoji: "🤝", name: "Partenaire", route: "/partenaire" },
          ].map((item) => (
            <TouchableOpacity
              key={item.route}
              className="w-[23%] bg-white/5 rounded-xl p-3 items-center border border-white/[0.06]"
              onPress={() => router.push(item.route as any)}
            >
              <Text className="text-xl mb-1">{item.emoji}</Text>
              <Text className="text-white/60 text-[10px] font-sans text-center">
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Videos */}
        <Text className="text-white text-lg font-sans-bold mb-3">
          Dernières vidéos
        </Text>
        {loading ? (
          <View className="gap-3 mb-8">
            <Skeleton height={80} borderRadius={16} />
            <Skeleton height={80} borderRadius={16} />
          </View>
        ) : data?.videos.length === 0 ? (
          <Card className="items-center py-8 mb-8">
            <Text className="text-3xl mb-2">🎬</Text>
            <Text className="text-white/50 font-sans text-center">
              Aucune vidéo pour l'instant. Crée ta première !
            </Text>
          </Card>
        ) : (
          <View className="gap-3 mb-8">
            {data?.videos.map((video) => (
              <TouchableOpacity
                key={video.id}
                onPress={() => router.push(`/editor?id=${video.id}` as any)}
              >
                <Card className="flex-row items-center">
                  <View className="w-16 h-16 bg-primary/20 rounded-xl items-center justify-center mr-3">
                    <Text className="text-2xl">🎥</Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-white font-sans-bold"
                      numberOfLines={1}
                    >
                      {video.title}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <Badge
                        variant={
                          video.status === "ready"
                            ? "success"
                            : video.status === "generating"
                            ? "warning"
                            : video.status === "failed"
                            ? "error"
                            : "default"
                        }
                      >
                        {video.status === "ready"
                          ? "Prête"
                          : video.status === "generating"
                          ? "En cours..."
                          : video.status === "failed"
                          ? "Échouée"
                          : "Brouillon"}
                      </Badge>
                      <Text className="text-white/30 text-xs font-sans">
                        {video.quality}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View className="h-4" />
      </ScrollView>
    </SafeAreaView>
  );
}

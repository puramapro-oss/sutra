import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { THEME } from "../../lib/constants";
import { Card, Badge, Skeleton, EmptyState } from "../../components/ui";

interface AnalyticsData {
  overview: {
    total_views: number;
    total_likes: number;
    total_shares: number;
    total_videos: number;
    views_change: number;
    likes_change: number;
    shares_change: number;
  };
  top_videos: Array<{
    id: string;
    title: string;
    views: number;
    likes: number;
    shares: number;
    thumbnail_url: string | null;
  }>;
  daily_views: Array<{ date: string; count: number }>;
  platforms: Array<{ name: string; views: number; percentage: number }>;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("7d");

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await apiFetch<AnalyticsData>(`/api/analytics?period=${period}`);
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger les analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const changeColor = (change: number) => (change >= 0 ? "text-success" : "text-error");
  const changeIcon = (change: number) => (change >= 0 ? "trending-up" : "trending-down");

  const maxDailyViews = data ? Math.max(...data.daily_views.map((d) => d.count), 1) : 1;
  const chartWidth = Dimensions.get("window").width - 64;

  return (
    <SafeAreaView className="flex-1 bg-background" testID="analytics-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="analytics-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Analytics</Text>
      </View>

      {/* Period Selector */}
      <View className="flex-row mx-4 mb-4 bg-white/5 rounded-xl p-1">
        {(["7d", "30d", "all"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            className={`flex-1 py-2 rounded-lg items-center ${period === p ? "bg-primary" : ""}`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPeriod(p);
            }}
            testID={`period-${p}`}
          >
            <Text className={`font-sans-medium text-sm ${period === p ? "text-white" : "text-white/60"}`}>
              {p === "7d" ? "7 jours" : p === "30d" ? "30 jours" : "Tout"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={100} className="rounded-2xl mb-4" />
          <Skeleton height={160} className="rounded-2xl mb-4" />
          <Skeleton height={80} className="rounded-2xl mb-2" />
          <Skeleton height={80} className="rounded-2xl" />
        </View>
      ) : !data ? (
        <EmptyState
          icon="📊"
          title="Analytics indisponibles"
          description="Impossible de charger les analytics."
          actionLabel="Reessayer"
          onAction={fetchAnalytics}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
        >
          {/* Overview Stats */}
          <View className="flex-row gap-3 mb-4">
            <Card className="flex-1 p-3">
              <View className="flex-row items-center mb-1">
                <Ionicons name="eye" size={14} color={THEME.primary} />
                <Text className="text-white/40 font-sans text-xs ml-1">Vues</Text>
              </View>
              <Text className="text-white text-xl font-sans-bold" testID="total-views">
                {formatNumber(data.overview.total_views)}
              </Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name={changeIcon(data.overview.views_change)} size={12} color={data.overview.views_change >= 0 ? THEME.success : THEME.error} />
                <Text className={`font-sans text-xs ml-0.5 ${changeColor(data.overview.views_change)}`}>
                  {Math.abs(data.overview.views_change)}%
                </Text>
              </View>
            </Card>
            <Card className="flex-1 p-3">
              <View className="flex-row items-center mb-1">
                <Ionicons name="heart" size={14} color={THEME.error} />
                <Text className="text-white/40 font-sans text-xs ml-1">Likes</Text>
              </View>
              <Text className="text-white text-xl font-sans-bold">
                {formatNumber(data.overview.total_likes)}
              </Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name={changeIcon(data.overview.likes_change)} size={12} color={data.overview.likes_change >= 0 ? THEME.success : THEME.error} />
                <Text className={`font-sans text-xs ml-0.5 ${changeColor(data.overview.likes_change)}`}>
                  {Math.abs(data.overview.likes_change)}%
                </Text>
              </View>
            </Card>
            <Card className="flex-1 p-3">
              <View className="flex-row items-center mb-1">
                <Ionicons name="share-social" size={14} color={THEME.secondary} />
                <Text className="text-white/40 font-sans text-xs ml-1">Partages</Text>
              </View>
              <Text className="text-white text-xl font-sans-bold">
                {formatNumber(data.overview.total_shares)}
              </Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name={changeIcon(data.overview.shares_change)} size={12} color={data.overview.shares_change >= 0 ? THEME.success : THEME.error} />
                <Text className={`font-sans text-xs ml-0.5 ${changeColor(data.overview.shares_change)}`}>
                  {Math.abs(data.overview.shares_change)}%
                </Text>
              </View>
            </Card>
          </View>

          {/* Mini Bar Chart */}
          {data.daily_views.length > 0 && (
            <Card className="mb-4 p-4">
              <Text className="text-white font-sans-bold text-base mb-4">Vues par jour</Text>
              <View className="flex-row items-end h-24" style={{ width: chartWidth - 32 }}>
                {data.daily_views.map((day, i) => {
                  const barHeight = Math.max(4, (day.count / maxDailyViews) * 80);
                  return (
                    <View
                      key={day.date}
                      className="flex-1 items-center mx-0.5"
                    >
                      <View
                        className="bg-primary rounded-t-sm w-full"
                        style={{ height: barHeight }}
                      />
                    </View>
                  );
                })}
              </View>
              <View className="flex-row justify-between mt-1">
                <Text className="text-white/30 font-sans text-[10px]">
                  {data.daily_views[0]?.date?.slice(5) ?? ""}
                </Text>
                <Text className="text-white/30 font-sans text-[10px]">
                  {data.daily_views[data.daily_views.length - 1]?.date?.slice(5) ?? ""}
                </Text>
              </View>
            </Card>
          )}

          {/* Platform Breakdown */}
          {data.platforms.length > 0 && (
            <Card className="mb-4 p-4">
              <Text className="text-white font-sans-bold text-base mb-3">Par plateforme</Text>
              {data.platforms.map((platform) => (
                <View key={platform.name} className="mb-3 last:mb-0">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-white font-sans text-sm">{platform.name}</Text>
                    <Text className="text-white/60 font-sans text-sm">
                      {formatNumber(platform.views)} ({platform.percentage}%)
                    </Text>
                  </View>
                  <View className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${platform.percentage}%` }}
                    />
                  </View>
                </View>
              ))}
            </Card>
          )}

          {/* Top Videos */}
          <Text className="text-white text-lg font-sans-bold mb-3">Top videos</Text>
          {data.top_videos.length > 0 ? (
            data.top_videos.map((video, i) => (
              <TouchableOpacity
                key={video.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/editor", params: { id: video.id } });
                }}
                testID={`top-video-${video.id}`}
              >
                <Card className="mb-2">
                  <View className="flex-row items-center">
                    <Text className="text-white/40 font-sans-bold text-lg w-8">#{i + 1}</Text>
                    <View className="flex-1">
                      <Text className="text-white font-sans-medium" numberOfLines={1}>{video.title}</Text>
                      <View className="flex-row items-center mt-1 gap-3">
                        <View className="flex-row items-center">
                          <Ionicons name="eye" size={12} color={THEME.textSecondary} />
                          <Text className="text-white/40 font-sans text-xs ml-1">{formatNumber(video.views)}</Text>
                        </View>
                        <View className="flex-row items-center">
                          <Ionicons name="heart" size={12} color={THEME.textSecondary} />
                          <Text className="text-white/40 font-sans text-xs ml-1">{formatNumber(video.likes)}</Text>
                        </View>
                        <View className="flex-row items-center">
                          <Ionicons name="share-social" size={12} color={THEME.textSecondary} />
                          <Text className="text-white/40 font-sans text-xs ml-1">{formatNumber(video.shares)}</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={THEME.textSecondary} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyState
              icon="📹"
              title="Aucune video"
              description="Cree ta premiere video pour voir les analytics."
              actionLabel="Creer une video"
              onAction={() => router.push("/create")}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

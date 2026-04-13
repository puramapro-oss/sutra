import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Switch,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { THEME } from "../../lib/constants";
import { Card, Button, Badge, Skeleton, EmptyState } from "../../components/ui";

interface AutoConfig {
  is_active: boolean;
  default_style: string;
  default_duration: number;
  publish_platforms: string[];
  auto_publish: boolean;
}

interface AutoVideo {
  id: string;
  title: string;
  status: string;
  scheduled_for: string;
  views: number;
  likes: number;
  thumbnail_url: string | null;
}

export default function AutoModeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [config, setConfig] = useState<AutoConfig | null>(null);
  const [videos, setVideos] = useState<AutoVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [configRes, videosRes] = await Promise.all([
        apiFetch<AutoConfig>("/api/auto/config").catch(() => null),
        apiFetch<{ videos: AutoVideo[] }>("/api/auto/videos?limit=10").catch(() => ({ videos: [] as AutoVideo[] })),
      ]);
      if (configRes) setConfig(configRes);
      setVideos(videosRes?.videos || []);
    } catch {
      // Defaults
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
    else setLoading(false);
  }, [user, fetchData]);

  const toggleActive = async () => {
    if (!config) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newActive = !config.is_active;
    setConfig({ ...config, is_active: newActive });
    try {
      await apiFetch("/api/auto/config", {
        method: "PATCH",
        body: { is_active: newActive },
      });
    } catch {
      setConfig({ ...config, is_active: !newActive });
    }
  };

  const statusColors: Record<string, string> = {
    published: "text-green-400",
    ready: "text-blue-400",
    generating_video: "text-yellow-400",
    planning: "text-white/40",
    failed: "text-red-400",
  };

  const statusLabels: Record<string, string> = {
    published: "Publiee",
    ready: "Prete",
    generating_video: "En cours",
    planning: "Planifiee",
    failed: "Echouee",
    pending_approval: "A valider",
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.background }}>
      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor="#8B5CF6"
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">Mode Autonome</Text>
            <Text className="text-white/50 text-sm">
              SUTRA cree et publie pour toi
            </Text>
          </View>
        </View>

        {loading ? (
          <View className="gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </View>
        ) : (
          <>
            {/* Toggle card */}
            <Card className="p-5 mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-4">
                  <View className="w-12 h-12 rounded-xl bg-violet-500/20 items-center justify-center mr-3">
                    <Ionicons name="sparkles" size={24} color="#8B5CF6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">
                      Mode Autonome
                    </Text>
                    <Text className="text-white/40 text-xs">
                      {config?.is_active
                        ? "SUTRA publie automatiquement"
                        : "Active pour automatiser"}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={config?.is_active ?? false}
                  onValueChange={toggleActive}
                  trackColor={{ false: "#ffffff15", true: "#8B5CF680" }}
                  thumbColor={config?.is_active ? "#8B5CF6" : "#ffffff60"}
                  testID="auto-toggle"
                />
              </View>
            </Card>

            {/* Config summary */}
            {config && (
              <Card className="p-4 mb-4">
                <Text className="text-white/60 text-xs font-medium mb-3">
                  Configuration
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Badge variant="default">{config.default_style}</Badge>
                  <Badge variant="default">{config.default_duration}s</Badge>
                  <Badge variant={config.auto_publish ? "success" : "warning"}>
                    {config.auto_publish ? "Auto-publish" : "Approbation"}
                  </Badge>
                  {config.publish_platforms?.map((p) => (
                    <Badge key={p} variant="default">{p}</Badge>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL("https://sutra.purama.dev/auto/settings")
                  }
                  className="mt-3"
                >
                  <Text className="text-violet-400 text-xs">
                    Configurer sur le web →
                  </Text>
                </TouchableOpacity>
              </Card>
            )}

            {/* Recent videos */}
            <Text className="text-white font-semibold mb-3">
              Dernieres videos
            </Text>
            {videos.length === 0 ? (
              <EmptyState
                icon="videocam"
                title="Aucune video autonome"
                description="Active le mode auto pour commencer."
              />
            ) : (
              <View className="gap-3 mb-4">
                {videos.map((video) => (
                  <Card key={video.id} className="p-4">
                    <View className="flex-row items-center">
                      <View className="w-12 h-12 rounded-lg bg-white/5 items-center justify-center mr-3">
                        <Ionicons name="play" size={20} color="#ffffff50" />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-white text-sm font-medium"
                          numberOfLines={1}
                        >
                          {video.title || "Video sans titre"}
                        </Text>
                        <Text
                          className={`text-xs ${statusColors[video.status] || "text-white/40"}`}
                        >
                          {statusLabels[video.status] || video.status}
                        </Text>
                      </View>
                      {video.views > 0 && (
                        <View className="items-end">
                          <Text className="text-white/60 text-xs">
                            {video.views} vues
                          </Text>
                          <Text className="text-white/30 text-[10px]">
                            {video.likes} likes
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                ))}
              </View>
            )}

            {/* Web link for full management */}
            <Button
              onPress={() =>
                Linking.openURL("https://sutra.purama.dev/auto")
              }
              variant="outline"
              testID="auto-web"
            >
              Gerer sur le web
            </Button>
          </>
        )}

        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}

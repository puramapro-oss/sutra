import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlatList } from "react-native";
import { Image } from "expo-image";
import { apiFetch } from "../../lib/api";
import { useVideoStore } from "../../lib/store";
import { Card, Badge, EmptyState, Skeleton } from "../../components/ui";
import { formatRelativeDate } from "../../lib/utils";
import type { Video } from "../../types/database";

export default function LibraryScreen() {
  const router = useRouter();
  const { refreshTrigger } = useVideoStore();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "ready" | "generating" | "draft">("all");

  const fetchVideos = useCallback(async () => {
    try {
      const data = await apiFetch<{ videos: Video[] }>("/api/auto/videos");
      setVideos(data.videos || []);
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos, refreshTrigger]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVideos();
    setRefreshing(false);
  };

  const filtered = filter === "all"
    ? videos
    : videos.filter((v) => v.status === filter);

  const statusLabel = (status: string) => {
    switch (status) {
      case "ready": return "Prête";
      case "generating": return "En cours";
      case "published": return "Publiée";
      case "failed": return "Échouée";
      default: return "Brouillon";
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "ready": return "success" as const;
      case "generating": return "warning" as const;
      case "published": return "primary" as const;
      case "failed": return "error" as const;
      default: return "default" as const;
    }
  };

  const renderVideo = ({ item }: { item: Video }) => (
    <TouchableOpacity
      className="mb-3 mx-4"
      onPress={() => router.push(`/editor?id=${item.id}` as any)}
    >
      <Card className="flex-row items-center">
        <View className="w-20 h-14 bg-primary/20 rounded-xl items-center justify-center mr-3 overflow-hidden">
          {item.thumbnail_url ? (
            <Image
              source={{ uri: item.thumbnail_url }}
              style={{ width: 80, height: 56, borderRadius: 12 }}
              contentFit="cover"
            />
          ) : (
            <Text className="text-2xl">🎥</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-white font-sans-bold" numberOfLines={1}>
            {item.title}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            <Badge variant={statusVariant(item.status)}>
              {statusLabel(item.status)}
            </Badge>
            <Text className="text-white/30 text-xs font-sans">
              {formatRelativeDate(item.created_at)}
            </Text>
          </View>
        </View>
        <Text className="text-white/30 text-xs font-sans">{item.quality}</Text>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 py-4">
        <Text className="text-white text-2xl font-sans-bold">Bibliothèque</Text>
        <Text className="text-white/50 font-sans mt-1">
          {videos.length} vidéo{videos.length > 1 ? "s" : ""}
        </Text>
      </View>

      {/* Filters */}
      <View className="flex-row gap-2 px-4 mb-4">
        {(["all", "ready", "generating", "draft"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            className={`px-3 py-1.5 rounded-full ${
              filter === f ? "bg-primary" : "bg-white/5"
            }`}
            onPress={() => setFilter(f)}
          >
            <Text
              className={`text-sm font-sans ${
                filter === f ? "text-white" : "text-white/50"
              }`}
            >
              {f === "all" ? "Toutes" : f === "ready" ? "Prêtes" : f === "generating" ? "En cours" : "Brouillons"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="px-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={80} borderRadius={16} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📹"
          title="Aucune vidéo"
          description="Crée ta première vidéo pour la voir ici"
          actionLabel="Créer une vidéo"
          onAction={() => router.push("/(tabs)/create")}
        />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderVideo}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8B5CF6"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

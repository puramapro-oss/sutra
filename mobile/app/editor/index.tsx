import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { THEME } from "../../lib/constants";
import { formatDate, formatRelativeDate } from "../../lib/utils";
import { Card, Button, Badge, Skeleton, EmptyState } from "../../components/ui";
import type { Video } from "../../types/database";

export default function EditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVideo = useCallback(async () => {
    if (!params.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch<{ video: Video }>(`/api/auto/videos?id=${params.id}`);
      setVideo(res.video);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger la video.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVideo();
  }, [fetchVideo]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "draft": return { label: "Brouillon", variant: "default" as const, icon: "document-outline", color: THEME.textSecondary };
      case "generating": return { label: "En generation", variant: "warning" as const, icon: "hourglass", color: THEME.warning };
      case "ready": return { label: "Pret", variant: "success" as const, icon: "checkmark-circle", color: THEME.success };
      case "published": return { label: "Publie", variant: "primary" as const, icon: "globe", color: THEME.primary };
      case "failed": return { label: "Echoue", variant: "error" as const, icon: "alert-circle", color: THEME.error };
      default: return { label: status, variant: "default" as const, icon: "help-circle", color: THEME.textSecondary };
    }
  };

  const openVideo = () => {
    if (video?.video_url) {
      Linking.openURL(video.video_url);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="editor-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="editor-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4 flex-1" numberOfLines={1}>
          {video?.title ?? "Video"}
        </Text>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={200} className="rounded-2xl mb-4" />
          <Skeleton height={100} className="rounded-2xl mb-4" />
          <Skeleton height={60} className="rounded-2xl" />
        </View>
      ) : !video ? (
        <EmptyState
          icon="🎬"
          title="Video introuvable"
          description="Cette video n'existe pas ou a ete supprimee."
          actionLabel="Retour"
          onAction={() => router.back()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
        >
          {/* Thumbnail Preview */}
          {video.thumbnail_url ? (
            <View className="mb-4 rounded-2xl overflow-hidden">
              <Image
                source={{ uri: video.thumbnail_url }}
                className="w-full aspect-video"
                contentFit="cover"
                transition={200}
              />
              {video.video_url && (
                <TouchableOpacity
                  className="absolute inset-0 items-center justify-center bg-black/30"
                  onPress={openVideo}
                  testID="play-video"
                >
                  <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center">
                    <Ionicons name="play" size={32} color="#fff" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Card className="mb-4 items-center py-12">
              <Ionicons name="videocam-off" size={48} color={THEME.textTertiary} />
              <Text className="text-white/40 font-sans text-sm mt-2">Apercu non disponible</Text>
            </Card>
          )}

          {/* Status & Info */}
          <Card className="mb-4 p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Badge variant={getStatusConfig(video.status).variant}>
                {getStatusConfig(video.status).label}
              </Badge>
              <Text className="text-white/40 font-sans text-sm">
                {formatRelativeDate(video.created_at)}
              </Text>
            </View>
            <Text className="text-white font-sans-bold text-xl mb-2">{video.title}</Text>
            {video.description && (
              <Text className="text-white/60 font-sans text-sm mb-3">{video.description}</Text>
            )}

            <View className="flex-row gap-4 mb-3">
              <View className="flex-row items-center">
                <Ionicons name="time" size={14} color={THEME.textSecondary} />
                <Text className="text-white/40 font-sans text-sm ml-1">
                  {video.duration ? `${video.duration}s` : "N/A"}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="film" size={14} color={THEME.textSecondary} />
                <Text className="text-white/40 font-sans text-sm ml-1">{video.quality}</Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="resize" size={14} color={THEME.textSecondary} />
                <Text className="text-white/40 font-sans text-sm ml-1">{video.format}</Text>
              </View>
            </View>

            <View className="flex-row gap-2">
              <Badge variant="secondary">{video.niche}</Badge>
              {video.style && <Badge variant="default">{video.style}</Badge>}
              <Badge variant="default">{video.voice}</Badge>
            </View>
          </Card>

          {/* Stats */}
          <Card className="mb-4 p-4">
            <Text className="text-white font-sans-bold text-base mb-3">Performance</Text>
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Ionicons name="eye" size={20} color={THEME.primary} />
                <Text className="text-white text-xl font-sans-bold mt-1">{video.views}</Text>
                <Text className="text-white/40 font-sans text-xs">Vues</Text>
              </View>
              <View className="w-px bg-white/10" />
              <View className="items-center flex-1">
                <Ionicons name="heart" size={20} color={THEME.error} />
                <Text className="text-white text-xl font-sans-bold mt-1">{video.likes}</Text>
                <Text className="text-white/40 font-sans text-xs">Likes</Text>
              </View>
              <View className="w-px bg-white/10" />
              <View className="items-center flex-1">
                <Ionicons name="share-social" size={20} color={THEME.secondary} />
                <Text className="text-white text-xl font-sans-bold mt-1">{video.shares}</Text>
                <Text className="text-white/40 font-sans text-xs">Partages</Text>
              </View>
            </View>
          </Card>

          {/* Published Platforms */}
          {video.published_platforms.length > 0 && (
            <Card className="mb-4 p-4">
              <Text className="text-white font-sans-bold text-base mb-2">Publie sur</Text>
              <View className="flex-row flex-wrap gap-2">
                {video.published_platforms.map((platform) => (
                  <Badge key={platform} variant="success">{platform}</Badge>
                ))}
              </View>
            </Card>
          )}

          {/* Script */}
          {video.script && (
            <Card className="mb-4 p-4">
              <Text className="text-white font-sans-bold text-base mb-2">Script</Text>
              <Text className="text-white/60 font-sans text-sm">{video.script}</Text>
            </Card>
          )}

          {/* Actions */}
          <View className="gap-3 mt-2">
            {video.status === "ready" && (
              <Button
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({ pathname: "/publish", params: { video_id: video.id } });
                }}
                testID="publish-video"
                icon={<Ionicons name="rocket" size={18} color="#fff" />}
              >
                Publier cette video
              </Button>
            )}
            {video.video_url && (
              <Button
                variant="outline"
                onPress={openVideo}
                testID="view-full-video"
                icon={<Ionicons name="play-circle" size={18} color="#fff" />}
              >
                Voir la video complete
              </Button>
            )}
            <Button
              variant="outline"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: "/storyboard", params: { video_id: video.id } });
              }}
              testID="view-storyboard"
              icon={<Ionicons name="layers" size={18} color="#fff" />}
            >
              Voir le storyboard
            </Button>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

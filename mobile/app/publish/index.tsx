import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { THEME } from "../../lib/constants";
import { Card, Button, Badge, Skeleton, EmptyState, Input } from "../../components/ui";

interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  enabled: boolean;
  username: string | null;
}

interface PublishData {
  platforms: PlatformConfig[];
  pending_videos: Array<{
    id: string;
    title: string;
    status: string;
    thumbnail_url: string | null;
  }>;
  recent_publications: Array<{
    id: string;
    video_title: string;
    platform: string;
    published_at: string;
    status: string;
  }>;
}

const PLATFORM_ICONS: Record<string, string> = {
  youtube: "logo-youtube",
  tiktok: "logo-tiktok",
  instagram: "logo-instagram",
  facebook: "logo-facebook",
  twitter: "logo-twitter",
  linkedin: "logo-linkedin",
  pinterest: "logo-pinterest",
  snapchat: "logo-snapchat",
  reddit: "logo-reddit",
  telegram: "paper-plane",
  whatsapp: "logo-whatsapp",
  discord: "logo-discord",
  twitch: "logo-twitch",
  threads: "at",
};

export default function PublishScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ video_id?: string }>();
  const [data, setData] = useState<PublishData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(params.video_id ?? null);
  const [caption, setCaption] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch<PublishData>("/api/auto/publish");
      setData(res);
      setSelectedPlatforms(res.platforms.filter((p) => p.connected && p.enabled).map((p) => p.id));
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger les plateformes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const togglePlatform = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handlePublish = async () => {
    if (!selectedVideo) {
      Alert.alert("Erreur", "Selectionne une video a publier.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      Alert.alert("Erreur", "Selectionne au moins une plateforme.");
      return;
    }

    setPublishing(true);
    try {
      await apiFetch("/api/auto/publish", {
        method: "POST",
        body: {
          video_id: selectedVideo,
          platforms: selectedPlatforms,
          caption: caption.trim() || undefined,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Publication lancee !", `Ta video sera publiee sur ${selectedPlatforms.length} plateforme(s).`);
      fetchData();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Erreur lors de la publication.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="publish-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="publish-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Publier</Text>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={60} className="rounded-2xl mb-4" />
          <Skeleton height={200} className="rounded-2xl mb-4" />
          <Skeleton height={100} className="rounded-2xl" />
        </View>
      ) : !data ? (
        <EmptyState
          icon="📡"
          title="Publication indisponible"
          description="Impossible de charger les plateformes de publication."
          actionLabel="Reessayer"
          onAction={fetchData}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
        >
          {/* Video Selection */}
          <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
            Video a publier
          </Text>
          {data.pending_videos.length > 0 ? (
            <Card className="mb-4 p-4">
              {data.pending_videos.map((video) => (
                <TouchableOpacity
                  key={video.id}
                  className={`flex-row items-center py-2.5 ${video.id !== data.pending_videos[data.pending_videos.length - 1]?.id ? "border-b border-white/[0.06]" : ""}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedVideo(video.id);
                  }}
                  testID={`select-video-${video.id}`}
                >
                  <View className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${selectedVideo === video.id ? "border-primary bg-primary" : "border-white/20"}`}>
                    {selectedVideo === video.id && (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                  <Text className="text-white font-sans flex-1" numberOfLines={1}>{video.title}</Text>
                  <Badge variant={video.status === "ready" ? "success" : "default"}>
                    {video.status === "ready" ? "Pret" : video.status}
                  </Badge>
                </TouchableOpacity>
              ))}
            </Card>
          ) : (
            <Card className="mb-4 p-4 items-center">
              <Text className="text-white/40 font-sans text-sm">Aucune video prete a publier</Text>
            </Card>
          )}

          {/* Caption */}
          <Input
            label="Legende (optionnelle)"
            placeholder="Ajoute une legende pour tes publications..."
            value={caption}
            onChangeText={setCaption}
            multiline
            numberOfLines={3}
            testID="caption-input"
          />

          {/* Platforms */}
          <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
            Plateformes ({selectedPlatforms.length} selectionnees)
          </Text>
          <Card className="mb-6 p-4">
            {data.platforms.map((platform) => (
              <View
                key={platform.id}
                className={`flex-row items-center py-3 ${platform.id !== data.platforms[data.platforms.length - 1]?.id ? "border-b border-white/[0.06]" : ""}`}
              >
                <Ionicons
                  name={(PLATFORM_ICONS[platform.id] ?? "globe") as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={platform.connected ? THEME.primary : THEME.textTertiary}
                />
                <View className="flex-1 ml-3">
                  <Text className={`font-sans-medium ${platform.connected ? "text-white" : "text-white/30"}`}>
                    {platform.name}
                  </Text>
                  {platform.username && (
                    <Text className="text-white/40 font-sans text-xs">@{platform.username}</Text>
                  )}
                </View>
                {platform.connected ? (
                  <Switch
                    value={selectedPlatforms.includes(platform.id)}
                    onValueChange={() => togglePlatform(platform.id)}
                    trackColor={{ false: "rgba(255,255,255,0.1)", true: THEME.primary }}
                    thumbColor="#fff"
                    testID={`toggle-${platform.id}`}
                  />
                ) : (
                  <Badge variant="default">Non connecte</Badge>
                )}
              </View>
            ))}
          </Card>

          <Button
            onPress={handlePublish}
            loading={publishing}
            disabled={!selectedVideo || selectedPlatforms.length === 0}
            testID="publish-button"
            icon={<Ionicons name="rocket" size={18} color="#fff" />}
          >
            Publier sur {selectedPlatforms.length} plateforme(s)
          </Button>

          {/* Recent Publications */}
          {data.recent_publications.length > 0 && (
            <View className="mt-8">
              <Text className="text-white text-lg font-sans-bold mb-3">Publications recentes</Text>
              {data.recent_publications.map((pub) => (
                <Card key={pub.id} className="mb-2">
                  <View className="flex-row items-center">
                    <Ionicons
                      name={(PLATFORM_ICONS[pub.platform] ?? "globe") as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={THEME.textSecondary}
                    />
                    <Text className="text-white font-sans text-sm ml-2 flex-1" numberOfLines={1}>
                      {pub.video_title}
                    </Text>
                    <Badge variant={pub.status === "published" ? "success" : pub.status === "failed" ? "error" : "warning"}>
                      {pub.status === "published" ? "Publie" : pub.status === "failed" ? "Echoue" : "En cours"}
                    </Badge>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

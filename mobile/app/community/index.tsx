import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { THEME } from "../../lib/constants";
import { formatRelativeDate } from "../../lib/utils";
import { Card, Button, Badge, Skeleton, EmptyState, Avatar, Modal } from "../../components/ui";
import type { LoveWallPost } from "../../types/database";

interface CommunityData {
  posts: LoveWallPost[];
  active_users: number;
  my_buddy: {
    name: string;
    avatar: string | null;
    streak_days: number;
  } | null;
  community_goal: {
    title: string;
    target: number;
    current: number;
    reward: string;
  } | null;
}

const REACTIONS = ["❤️", "🔥", "💪", "🎉", "👏"];

export default function CommunityScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState<"victory" | "encouragement" | "milestone" | "gratitude">("victory");
  const [posting, setPosting] = useState(false);
  const [tab, setTab] = useState<"wall" | "buddy" | "goal">("wall");

  const fetchCommunity = useCallback(async () => {
    try {
      const res = await apiFetch<CommunityData>("/api/community");
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger la communaute.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCommunity();
  }, [fetchCommunity]);

  const handlePost = async () => {
    if (!postContent.trim()) {
      Alert.alert("Erreur", "Ecris quelque chose avant de publier.");
      return;
    }
    setPosting(true);
    try {
      await apiFetch("/api/community", {
        method: "POST",
        body: { action: "post", content: postContent.trim(), type: postType },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPostModal(false);
      setPostContent("");
      fetchCommunity();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Impossible de publier.");
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (postId: string, emoji: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiFetch("/api/community", {
        method: "POST",
        body: { action: "react", post_id: postId, emoji },
      });
      fetchCommunity();
    } catch (_) {
      // silent fail
    }
  };

  const getPostTypeLabel = (type: string) => {
    switch (type) {
      case "victory": return "Victoire";
      case "encouragement": return "Encouragement";
      case "milestone": return "Palier";
      case "gratitude": return "Gratitude";
      default: return type;
    }
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case "victory": return "🏆";
      case "encouragement": return "💪";
      case "milestone": return "🎯";
      case "gratitude": return "🙏";
      default: return "💬";
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="community-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="community-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4 flex-1">Communaute</Text>
        {data && (
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-success mr-1.5" />
            <Text className="text-white/60 font-sans text-sm">{data.active_users} actifs</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row mx-4 mb-4 bg-white/5 rounded-xl p-1">
        {(["wall", "buddy", "goal"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            className={`flex-1 py-2 rounded-lg items-center ${tab === t ? "bg-primary" : ""}`}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab(t); }}
            testID={`tab-${t}`}
          >
            <Text className={`font-sans-medium text-sm ${tab === t ? "text-white" : "text-white/60"}`}>
              {t === "wall" ? "Mur" : t === "buddy" ? "Buddy" : "Objectif"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={100} className="rounded-2xl mb-3" />
          ))}
        </View>
      ) : !data ? (
        <EmptyState
          icon="💛"
          title="Communaute indisponible"
          description="Impossible de charger la communaute."
          actionLabel="Reessayer"
          onAction={fetchCommunity}
        />
      ) : tab === "wall" ? (
        /* Love Wall */
        <FlatList
          data={data.posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
          renderItem={({ item }) => (
            <Card className="mb-3" testID={`post-${item.id}`}>
              <View className="flex-row items-center mb-2">
                <Avatar uri={item.profile?.avatar} name={item.profile?.full_name} size="sm" />
                <View className="ml-2 flex-1">
                  <Text className="text-white font-sans-medium text-sm">
                    {item.profile?.full_name ?? "Utilisateur"}
                  </Text>
                  <Text className="text-white/30 font-sans text-xs">
                    {formatRelativeDate(item.created_at)}
                  </Text>
                </View>
                <Badge variant={item.type === "victory" ? "success" : item.type === "milestone" ? "primary" : "default"}>
                  {getPostTypeIcon(item.type)} {getPostTypeLabel(item.type)}
                </Badge>
              </View>
              <Text className="text-white font-sans text-sm mb-3">{item.content}</Text>
              <View className="flex-row gap-2">
                {REACTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    className="bg-white/5 px-2.5 py-1.5 rounded-full"
                    onPress={() => handleReact(item.id, emoji)}
                    testID={`react-${item.id}-${emoji}`}
                  >
                    <Text className="text-sm">{emoji}</Text>
                  </TouchableOpacity>
                ))}
                <View className="flex-1" />
                <Text className="text-white/30 font-sans text-xs self-center">
                  {item.reactions_count} reactions
                </Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="💬"
              title="Le mur est vide"
              description="Sois le premier a partager une victoire !"
              actionLabel="Publier"
              onAction={() => setShowPostModal(true)}
            />
          }
        />
      ) : tab === "buddy" ? (
        /* Buddy */
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {data.my_buddy ? (
            <Card className="p-6 items-center">
              <Avatar uri={data.my_buddy.avatar} name={data.my_buddy.name} size="xl" />
              <Text className="text-white text-xl font-sans-bold mt-3">{data.my_buddy.name}</Text>
              <Badge variant="success" className="mt-2">
                Serie : {data.my_buddy.streak_days} jours
              </Badge>
              <Text className="text-white/40 font-sans text-sm text-center mt-4">
                Ton buddy et toi partagez vos progres au quotidien. Continuez comme ca !
              </Text>
              <Button
                variant="outline"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert("Check-in envoye !", "Ton buddy sera notifie.");
                }}
                className="mt-4"
                testID="buddy-checkin"
              >
                Envoyer un check-in
              </Button>
            </Card>
          ) : (
            <EmptyState
              icon="👯"
              title="Pas encore de buddy"
              description="L'IA va bientot te matcher avec un partenaire motive !"
            />
          )}
        </ScrollView>
      ) : (
        /* Community Goal */
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {data.community_goal ? (
            <Card className="p-6">
              <Text className="text-3xl text-center mb-3">🌍</Text>
              <Text className="text-white text-xl font-sans-bold text-center mb-2">
                {data.community_goal.title}
              </Text>
              <View className="my-4">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-white/60 font-sans text-sm">
                    {data.community_goal.current.toLocaleString("fr-FR")}
                  </Text>
                  <Text className="text-white/40 font-sans text-sm">
                    {data.community_goal.target.toLocaleString("fr-FR")}
                  </Text>
                </View>
                <View className="h-4 bg-white/10 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (data.community_goal.current / data.community_goal.target) * 100)}%` }}
                  />
                </View>
                <Text className="text-white/30 font-sans text-xs text-center mt-1">
                  {Math.round((data.community_goal.current / data.community_goal.target) * 100)}%
                </Text>
              </View>
              <Card variant="outline" className="p-3 items-center">
                <Text className="text-white/40 font-sans text-xs">Recompense</Text>
                <Text className="text-primary-light font-sans-bold">{data.community_goal.reward}</Text>
              </Card>
            </Card>
          ) : (
            <EmptyState
              icon="🎯"
              title="Pas d'objectif en cours"
              description="Le prochain objectif communautaire sera bientot annonce !"
            />
          )}
        </ScrollView>
      )}

      {/* FAB for posting */}
      {tab === "wall" && (
        <TouchableOpacity
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowPostModal(true);
          }}
          testID="new-post-fab"
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Post Modal */}
      <Modal
        visible={showPostModal}
        onClose={() => setShowPostModal(false)}
        title="Partager avec la communaute"
      >
        <View className="flex-row gap-2 mb-4">
          {(["victory", "encouragement", "milestone", "gratitude"] as const).map((type) => (
            <TouchableOpacity
              key={type}
              className={`flex-1 py-2 rounded-lg items-center ${postType === type ? "bg-primary" : "bg-white/5"}`}
              onPress={() => setPostType(type)}
            >
              <Text className="text-sm">{getPostTypeIcon(type)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          className="text-white bg-white/5 rounded-xl p-4 font-sans text-base min-h-[100px]"
          placeholder="Partage ta victoire, encourage quelqu'un..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={postContent}
          onChangeText={setPostContent}
          multiline
          testID="post-content-input"
        />

        <Button
          onPress={handlePost}
          loading={posting}
          disabled={!postContent.trim()}
          className="mt-4"
          testID="submit-post"
        >
          Publier
        </Button>
      </Modal>
    </SafeAreaView>
  );
}

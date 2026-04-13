import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { Card, Avatar, Badge, EmptyState } from "../../components/ui";
import { formatRelativeDate } from "../../lib/utils";
import type { LoveWallPost } from "../../types/database";

type Tab = "wall" | "circles" | "buddy";

export default function CommunityScreen() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("wall");
  const [posts, setPosts] = useState<LoveWallPost[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);

  const fetchWall = useCallback(async () => {
    try {
      const data = await apiFetch<{ posts: LoveWallPost[] }>("/api/community/wall");
      setPosts(data.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWall();
  }, [fetchWall]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWall();
    setRefreshing(false);
  };

  const handlePost = async () => {
    if (!newPost.trim()) return;
    setPosting(true);
    try {
      await apiFetch("/api/community/wall", {
        method: "POST",
        body: { content: newPost.trim(), type: "victory" },
      });
      setNewPost("");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchWall();
    } catch {
      Alert.alert("Erreur", "Impossible de publier ton message");
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (postId: string, emoji: string) => {
    try {
      await apiFetch("/api/community/wall/react", {
        method: "POST",
        body: { post_id: postId, emoji },
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await fetchWall();
    } catch {}
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 py-4">
        <Text className="text-white text-2xl font-sans-bold">Communauté</Text>
        <Text className="text-white/50 font-sans mt-1">
          Partage, encourage, célèbre
        </Text>
      </View>

      {/* Tabs */}
      <View className="flex-row gap-2 px-4 mb-4">
        {([
          { key: "wall", label: "Mur d'amour 💜" },
          { key: "circles", label: "Cercles" },
          { key: "buddy", label: "Buddy" },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            className={`px-4 py-2 rounded-full ${
              tab === t.key ? "bg-primary" : "bg-white/5"
            }`}
            onPress={() => setTab(t.key as Tab)}
          >
            <Text
              className={`text-sm font-sans-bold ${
                tab === t.key ? "text-white" : "text-white/50"
              }`}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "wall" && (
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
          {/* New Post */}
          <Card className="mb-4">
            <View className="flex-row items-start">
              <Avatar uri={user?.avatar} name={user?.full_name} size="sm" />
              <TextInput
                className="flex-1 text-white font-sans ml-3 min-h-[40px]"
                placeholder="Partage une victoire, un encouragement..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                value={newPost}
                onChangeText={setNewPost}
                testID="community-post-input"
              />
            </View>
            {newPost.trim() ? (
              <TouchableOpacity
                className="bg-primary rounded-xl py-2 mt-3 items-center"
                onPress={handlePost}
                disabled={posting}
              >
                <Text className="text-white font-sans-bold">
                  {posting ? "Publication..." : "Publier 💜"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </Card>

          {/* Posts */}
          {posts.length === 0 ? (
            <EmptyState
              icon="💜"
              title="Sois le premier !"
              description="Partage une victoire ou encourage la communauté"
            />
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="mb-3">
                <View className="flex-row items-center mb-3">
                  <Avatar
                    uri={post.profile?.avatar}
                    name={post.profile?.full_name}
                    size="sm"
                  />
                  <View className="ml-2 flex-1">
                    <Text className="text-white font-sans-bold text-sm">
                      {post.profile?.full_name || "Anonyme"}
                    </Text>
                    <Text className="text-white/30 text-xs font-sans">
                      {formatRelativeDate(post.created_at)}
                    </Text>
                  </View>
                  <Badge variant={
                    post.type === "victory" ? "success" :
                    post.type === "milestone" ? "primary" :
                    post.type === "gratitude" ? "warning" : "secondary"
                  }>
                    {post.type === "victory" ? "Victoire" :
                     post.type === "milestone" ? "Palier" :
                     post.type === "gratitude" ? "Gratitude" : "Encouragement"}
                  </Badge>
                </View>
                <Text className="text-white font-sans mb-3">{post.content}</Text>
                <View className="flex-row gap-2">
                  {["❤️", "🔥", "💪", "🎉"].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      className="bg-white/5 px-3 py-1.5 rounded-full"
                      onPress={() => handleReact(post.id, emoji)}
                    >
                      <Text className="text-sm">{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                  <View className="flex-1" />
                  <Text className="text-white/30 text-xs font-sans self-center">
                    {post.reactions_count} réactions
                  </Text>
                </View>
              </Card>
            ))
          )}
          <View className="h-8" />
        </ScrollView>
      )}

      {tab === "circles" && (
        <View className="flex-1 px-4">
          <EmptyState
            icon="⭕"
            title="Cercles d'entraide"
            description="Rejoins un groupe de 5-12 personnes partageant le même objectif créatif"
            actionLabel="Trouver un cercle"
            onAction={() => {
              apiFetch("/api/community/circles", { method: "POST" })
                .then(() => Alert.alert("Recherche lancée", "L'IA te trouvera le cercle parfait !"))
                .catch(() => Alert.alert("Erreur", "Réessaie plus tard"));
            }}
          />
        </View>
      )}

      {tab === "buddy" && (
        <View className="flex-1 px-4">
          <EmptyState
            icon="🤝"
            title="Trouve ton buddy"
            description="L'IA te match avec un créateur complémentaire pour vous motiver mutuellement"
            actionLabel="Trouver un buddy"
            onAction={() => {
              apiFetch("/api/community/buddy", { method: "POST" })
                .then(() => Alert.alert("C'est parti !", "On te trouve le buddy idéal..."))
                .catch(() => Alert.alert("Erreur", "Réessaie plus tard"));
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

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
import { Card, Badge, Skeleton, EmptyState, Button } from "../../components/ui";

interface Scene {
  id: string;
  order: number;
  title: string;
  description: string;
  duration: number;
  visual_prompt: string;
  narration: string;
  transition: string;
}

interface Storyboard {
  id: string;
  video_id: string;
  video_title: string;
  scenes: Scene[];
  total_duration: number;
  created_at: string;
}

interface StoryboardData {
  storyboards: Storyboard[];
}

export default function StoryboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<StoryboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchStoryboards = useCallback(async () => {
    try {
      const res = await apiFetch<StoryboardData>("/api/storyboard");
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger les storyboards.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStoryboards();
  }, [fetchStoryboards]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStoryboards();
  }, [fetchStoryboards]);

  const toggleExpand = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="storyboard-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="storyboard-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Storyboards</Text>
      </View>

      {loading ? (
        <View className="px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={100} className="rounded-2xl mb-3" />
          ))}
        </View>
      ) : !data ? (
        <EmptyState
          icon="🎬"
          title="Storyboards indisponibles"
          description="Impossible de charger les storyboards."
          actionLabel="Reessayer"
          onAction={fetchStoryboards}
        />
      ) : (
        <FlatList
          data={data.storyboards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
          renderItem={({ item: storyboard }) => {
            const isExpanded = expandedId === storyboard.id;
            return (
              <Card className="mb-3" testID={`storyboard-${storyboard.id}`}>
                <TouchableOpacity onPress={() => toggleExpand(storyboard.id)}>
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-white font-sans-bold text-base">{storyboard.video_title}</Text>
                      <Text className="text-white/40 font-sans text-sm">
                        {storyboard.scenes.length} scenes | {storyboard.total_duration}s
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={THEME.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View className="mt-3 border-t border-white/[0.06] pt-3">
                    {storyboard.scenes.map((scene) => (
                      <View key={scene.id} className="mb-4 last:mb-0">
                        <View className="flex-row items-center mb-1.5">
                          <View className="w-6 h-6 rounded-full bg-primary/20 items-center justify-center mr-2">
                            <Text className="text-primary-light font-sans-bold text-xs">{scene.order}</Text>
                          </View>
                          <Text className="text-white font-sans-medium flex-1">{scene.title}</Text>
                          <Badge variant="default">{scene.duration}s</Badge>
                        </View>
                        <Text className="text-white/50 font-sans text-sm mb-1 ml-8">
                          {scene.description}
                        </Text>
                        <View className="ml-8 bg-white/5 rounded-lg p-2 mt-1">
                          <Text className="text-white/30 font-sans text-xs mb-0.5">Narration :</Text>
                          <Text className="text-white/60 font-sans text-sm">{scene.narration}</Text>
                        </View>
                        {scene.transition && (
                          <Text className="text-white/30 font-sans text-xs ml-8 mt-1">
                            Transition : {scene.transition}
                          </Text>
                        )}
                      </View>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push({ pathname: "/editor", params: { id: storyboard.video_id } });
                      }}
                      className="mt-2"
                      testID={`edit-storyboard-${storyboard.id}`}
                    >
                      Voir la video
                    </Button>
                  </View>
                )}
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="Aucun storyboard"
              description="Cree une video pour generer un storyboard automatiquement."
              actionLabel="Creer une video"
              onAction={() => router.push("/create")}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

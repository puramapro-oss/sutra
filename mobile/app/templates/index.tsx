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
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { NICHES, THEME } from "../../lib/constants";
import { Card, Badge, Skeleton, EmptyState } from "../../components/ui";

interface Template {
  id: string;
  name: string;
  description: string;
  niche: string;
  thumbnail_url: string | null;
  duration: number;
  style: string;
  voice: string;
  use_count: number;
}

interface TemplatesData {
  templates: Template[];
  categories: string[];
}

export default function TemplatesScreen() {
  const router = useRouter();
  const [data, setData] = useState<TemplatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const query = selectedNiche ? `?niche=${selectedNiche}` : "";
      const res = await apiFetch<TemplatesData>(`/api/templates${query}`);
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger les templates.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedNiche]);

  useEffect(() => {
    setLoading(true);
    fetchTemplates();
  }, [fetchTemplates]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTemplates();
  }, [fetchTemplates]);

  const handleUseTemplate = (template: Template) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/create",
      params: {
        template_id: template.id,
        niche: template.niche,
        style: template.style,
        voice: template.voice,
      },
    });
  };

  const getNicheLabel = (niche: string) => {
    const labels: Record<string, string> = {
      "bien-etre": "Bien-etre",
      tech: "Tech",
      finance: "Finance",
      motivation: "Motivation",
      lifestyle: "Lifestyle",
      education: "Education",
      divertissement: "Divertissement",
      cuisine: "Cuisine",
      sport: "Sport",
      voyage: "Voyage",
      science: "Science",
      business: "Business",
    };
    return labels[niche] ?? niche;
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="templates-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="templates-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Templates</Text>
      </View>

      {/* Niche Filter */}
      <FlatList
        data={[null, ...NICHES]}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
        keyExtractor={(item) => item ?? "all"}
        renderItem={({ item }) => (
          <TouchableOpacity
            className={`px-4 py-2 rounded-full mr-2 ${selectedNiche === item ? "bg-primary" : "bg-white/5"}`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedNiche(item);
            }}
            testID={`filter-${item ?? "all"}`}
          >
            <Text className={`font-sans-medium text-sm ${selectedNiche === item ? "text-white" : "text-white/60"}`}>
              {item ? getNicheLabel(item) : "Tous"}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View className="px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={120} className="rounded-2xl mb-3" />
          ))}
        </View>
      ) : !data ? (
        <EmptyState
          icon="🎬"
          title="Templates indisponibles"
          description="Impossible de charger les templates."
          actionLabel="Reessayer"
          onAction={fetchTemplates}
        />
      ) : (
        <FlatList
          data={data.templates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleUseTemplate(item)}
              testID={`template-${item.id}`}
            >
              <Card className="mb-3">
                <View className="flex-row">
                  {item.thumbnail_url && (
                    <Image
                      source={{ uri: item.thumbnail_url }}
                      className="w-24 h-20 rounded-xl mr-3"
                      contentFit="cover"
                      transition={200}
                    />
                  )}
                  <View className="flex-1">
                    <Text className="text-white font-sans-bold text-base mb-1">{item.name}</Text>
                    <Text className="text-white/40 font-sans text-sm mb-2" numberOfLines={2}>
                      {item.description}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Badge variant="secondary">{getNicheLabel(item.niche)}</Badge>
                      <Badge variant="default">{item.duration}s</Badge>
                      <Text className="text-white/30 font-sans text-xs ml-auto">
                        {item.use_count} utilisations
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="📁"
              title="Aucun template"
              description={selectedNiche ? "Aucun template dans cette categorie." : "Les templates arrivent bientot !"}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

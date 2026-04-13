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
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { NICHES, VOICES, THEME } from "../../lib/constants";
import { Card, Button, Badge, Skeleton, EmptyState, Input } from "../../components/ui";

interface AutopilotConfig {
  enabled: boolean;
  niche: string;
  voice: string;
  frequency: "daily" | "3x_week" | "weekly";
  auto_publish: boolean;
  publish_platforms: string[];
  quality: string;
  style: string;
  time_slot: string;
  total_generated: number;
  total_published: number;
}

export default function AutopilotScreen() {
  const router = useRouter();
  const [config, setConfig] = useState<AutopilotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<Partial<AutopilotConfig>>({});

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiFetch<AutopilotConfig>("/api/auto/config");
      setConfig(res);
      setLocalConfig(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger la configuration.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<AutopilotConfig>("/api/auto/config", {
        method: "POST",
        body: localConfig as Record<string, unknown>,
      });
      setConfig(res);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Configuration sauvegardee", "Le pilote automatique a ete mis a jour.");
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Impossible de sauvegarder.");
    } finally {
      setSaving(false);
    }
  };

  const updateLocal = (key: keyof AutopilotConfig, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
  };

  const getNicheLabel = (niche: string) => {
    const labels: Record<string, string> = {
      "bien-etre": "Bien-etre", tech: "Tech", finance: "Finance",
      motivation: "Motivation", lifestyle: "Lifestyle", education: "Education",
      divertissement: "Divertissement", cuisine: "Cuisine", sport: "Sport",
      voyage: "Voyage", science: "Science", business: "Business",
    };
    return labels[niche] ?? niche;
  };

  const frequencyLabels: Record<string, string> = {
    daily: "Quotidien",
    "3x_week": "3x par semaine",
    weekly: "Hebdomadaire",
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="autopilot-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="autopilot-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Pilote automatique</Text>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={80} className="rounded-2xl mb-4" />
          <Skeleton height={200} className="rounded-2xl mb-4" />
          <Skeleton height={100} className="rounded-2xl" />
        </View>
      ) : !config ? (
        <EmptyState
          icon="🤖"
          title="Configuration indisponible"
          description="Impossible de charger la configuration du pilote automatique."
          actionLabel="Reessayer"
          onAction={fetchConfig}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
        >
          {/* Status */}
          <Card className="mb-4 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className={`w-3 h-3 rounded-full mr-2 ${localConfig.enabled ? "bg-success" : "bg-white/20"}`} />
                <Text className="text-white font-sans-bold text-lg">
                  {localConfig.enabled ? "Actif" : "Inactif"}
                </Text>
              </View>
              <Switch
                value={localConfig.enabled ?? false}
                onValueChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  updateLocal("enabled", v);
                }}
                trackColor={{ false: "rgba(255,255,255,0.1)", true: THEME.primary }}
                thumbColor="#fff"
                testID="toggle-autopilot"
              />
            </View>
            <View className="flex-row mt-3 gap-4">
              <View className="flex-1">
                <Text className="text-white/40 font-sans text-xs">Generees</Text>
                <Text className="text-white font-sans-bold text-lg">{config.total_generated}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white/40 font-sans text-xs">Publiees</Text>
                <Text className="text-success font-sans-bold text-lg">{config.total_published}</Text>
              </View>
            </View>
          </Card>

          {/* Niche Selection */}
          <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
            Niche
          </Text>
          <Card className="mb-4 p-4">
            <View className="flex-row flex-wrap gap-2">
              {NICHES.map((niche) => (
                <TouchableOpacity
                  key={niche}
                  className={`px-3 py-2 rounded-lg ${localConfig.niche === niche ? "bg-primary" : "bg-white/5"}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateLocal("niche", niche);
                  }}
                  testID={`niche-${niche}`}
                >
                  <Text className={`font-sans text-sm ${localConfig.niche === niche ? "text-white" : "text-white/60"}`}>
                    {getNicheLabel(niche)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Voice Selection */}
          <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
            Voix
          </Text>
          <Card className="mb-4 p-4">
            <View className="flex-row flex-wrap gap-2">
              {VOICES.map((voice) => (
                <TouchableOpacity
                  key={voice.id}
                  className={`px-3 py-2 rounded-lg ${localConfig.voice === voice.id ? "bg-secondary" : "bg-white/5"}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateLocal("voice", voice.id);
                  }}
                  testID={`voice-${voice.id}`}
                >
                  <Text className={`font-sans text-sm ${localConfig.voice === voice.id ? "text-white" : "text-white/60"}`}>
                    {voice.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Frequency */}
          <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
            Frequence
          </Text>
          <Card className="mb-4 p-4">
            <View className="flex-row gap-2">
              {(["daily", "3x_week", "weekly"] as const).map((freq) => (
                <TouchableOpacity
                  key={freq}
                  className={`flex-1 py-3 rounded-lg items-center ${localConfig.frequency === freq ? "bg-primary" : "bg-white/5"}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateLocal("frequency", freq);
                  }}
                  testID={`freq-${freq}`}
                >
                  <Text className={`font-sans-medium text-sm ${localConfig.frequency === freq ? "text-white" : "text-white/60"}`}>
                    {frequencyLabels[freq]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Auto-publish */}
          <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
            Publication
          </Text>
          <Card className="mb-6 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-white font-sans">Publication automatique</Text>
              <Switch
                value={localConfig.auto_publish ?? false}
                onValueChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateLocal("auto_publish", v);
                }}
                trackColor={{ false: "rgba(255,255,255,0.1)", true: THEME.primary }}
                thumbColor="#fff"
                testID="toggle-auto-publish"
              />
            </View>
          </Card>

          <Button
            onPress={saveConfig}
            loading={saving}
            testID="save-autopilot"
          >
            Sauvegarder la configuration
          </Button>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

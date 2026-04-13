import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { apiFetch } from "../../lib/api";
import { REFERRAL_TIERS, THEME, SITE_URL } from "../../lib/constants";
import { Card, Button, Badge, Skeleton, EmptyState, Avatar, ProgressBar } from "../../components/ui";
import { formatDate } from "../../lib/utils";

interface ReferralData {
  code: string;
  referrals: Array<{
    id: string;
    email: string;
    full_name: string | null;
    avatar: string | null;
    plan: string;
    created_at: string;
  }>;
  tier: string;
  stats: {
    total: number;
    active: number;
    total_earned: number;
  };
}

export default function ReferralScreen() {
  const router = useRouter();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReferral = useCallback(async () => {
    try {
      const res = await apiFetch<ReferralData>("/api/referral");
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger le programme de parrainage.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReferral();
  }, [fetchReferral]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReferral();
  }, [fetchReferral]);

  const copyCode = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.code);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copie !", "Ton code de parrainage a ete copie.");
  };

  const shareLink = async () => {
    if (!data) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Rejoins SUTRA et cree des videos IA incroyables ! Utilise mon code ${data.code} pour commencer. ${SITE_URL}/share/${data.code}`,
      });
    } catch (_) {
      // user cancelled
    }
  };

  const getCurrentTierIndex = () => {
    if (!data) return -1;
    return REFERRAL_TIERS.findIndex((t) => t.name === data.tier);
  };

  const getNextTier = () => {
    const idx = getCurrentTierIndex();
    if (idx < REFERRAL_TIERS.length - 1) {
      return REFERRAL_TIERS[idx + 1];
    }
    return null;
  };

  const getTierProgress = () => {
    if (!data) return 0;
    const nextTier = getNextTier();
    if (!nextTier) return 100;
    const currentTier = REFERRAL_TIERS[getCurrentTierIndex()];
    const currentMin = currentTier ? currentTier.min : 0;
    const progress = ((data.stats.total - currentMin) / (nextTier.min - currentMin)) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="referral-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="referral-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Parrainage</Text>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={160} className="rounded-2xl mb-4" />
          <Skeleton height={80} className="rounded-2xl mb-4" />
          <Skeleton height={60} className="rounded-2xl mb-2" />
          <Skeleton height={60} className="rounded-2xl" />
        </View>
      ) : !data ? (
        <EmptyState
          icon="🤝"
          title="Parrainage indisponible"
          description="Impossible de charger les donnees de parrainage."
          actionLabel="Reessayer"
          onAction={fetchReferral}
        />
      ) : (
        <FlatList
          data={data.referrals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
          ListHeaderComponent={
            <View className="mb-6">
              {/* Code & Share */}
              <Card className="mb-4 p-6">
                <Text className="text-white/60 font-sans text-sm mb-2">Ton code de parrainage</Text>
                <View className="flex-row items-center mb-4">
                  <Text className="text-white text-2xl font-sans-bold flex-1" testID="referral-code">
                    {data.code}
                  </Text>
                  <TouchableOpacity
                    onPress={copyCode}
                    className="bg-white/10 p-2.5 rounded-xl mr-2"
                    testID="copy-code"
                  >
                    <Ionicons name="copy-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={shareLink}
                    className="bg-primary p-2.5 rounded-xl"
                    testID="share-code"
                  >
                    <Ionicons name="share-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                <Button onPress={shareLink} variant="outline" testID="share-button">
                  Partager mon lien
                </Button>
              </Card>

              {/* Stats */}
              <View className="flex-row gap-3 mb-4">
                <Card className="flex-1 items-center p-4">
                  <Text className="text-white text-2xl font-sans-bold">{data.stats.total}</Text>
                  <Text className="text-white/40 font-sans text-xs">Filleuls</Text>
                </Card>
                <Card className="flex-1 items-center p-4">
                  <Text className="text-success text-2xl font-sans-bold">{data.stats.active}</Text>
                  <Text className="text-white/40 font-sans text-xs">Actifs</Text>
                </Card>
                <Card className="flex-1 items-center p-4">
                  <Text className="text-primary-light text-2xl font-sans-bold">
                    {data.stats.total_earned}
                  </Text>
                  <Text className="text-white/40 font-sans text-xs">EUR gagnes</Text>
                </Card>
              </View>

              {/* Tier Progression */}
              <Card className="mb-4 p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <Ionicons name="shield" size={20} color={REFERRAL_TIERS[getCurrentTierIndex()]?.color ?? THEME.primary} />
                    <Text className="text-white font-sans-bold text-base ml-2">{data.tier}</Text>
                  </View>
                  {getNextTier() && (
                    <Text className="text-white/40 font-sans text-sm">
                      Prochain : {getNextTier()?.name}
                    </Text>
                  )}
                </View>
                <ProgressBar
                  progress={getTierProgress()}
                  showPercentage
                  label={getNextTier() ? `${data.stats.total} / ${getNextTier()?.min} parrainages` : "Niveau max atteint"}
                />
              </Card>

              {/* Tier Overview */}
              <Card className="mb-6 p-4">
                <Text className="text-white font-sans-bold text-base mb-3">Paliers</Text>
                {REFERRAL_TIERS.map((tier) => {
                  const isActive = tier.name === data.tier;
                  const isReached = data.stats.total >= tier.min;
                  return (
                    <View
                      key={tier.name}
                      className={`flex-row items-center py-2 ${isActive ? "opacity-100" : isReached ? "opacity-70" : "opacity-40"}`}
                    >
                      <View
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: tier.color }}
                      />
                      <Text className="text-white font-sans flex-1">{tier.name}</Text>
                      <Text className="text-white/60 font-sans text-sm">{tier.min} filleuls</Text>
                      {isReached && (
                        <Ionicons name="checkmark-circle" size={16} color={THEME.success} className="ml-2" />
                      )}
                    </View>
                  );
                })}
              </Card>

              <Text className="text-white text-lg font-sans-bold mb-3">Tes filleuls</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="mb-2" testID={`referral-${item.id}`}>
              <View className="flex-row items-center">
                <Avatar uri={item.avatar} name={item.full_name} size="md" />
                <View className="ml-3 flex-1">
                  <Text className="text-white font-sans-medium">{item.full_name ?? item.email}</Text>
                  <Text className="text-white/40 font-sans text-sm">{formatDate(item.created_at)}</Text>
                </View>
                <Badge variant={item.plan === "free" ? "default" : "primary"}>{item.plan}</Badge>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="👥"
              title="Aucun filleul"
              description="Partage ton code pour commencer a parrainer !"
              actionLabel="Partager"
              onAction={shareLink}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

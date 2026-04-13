import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
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
import { THEME, SITE_URL } from "../../lib/constants";
import { formatPrice } from "../../lib/utils";
import { Card, Button, Badge, Skeleton, EmptyState, ProgressBar, Input } from "../../components/ui";

interface PartnerData {
  is_partner: boolean;
  slug: string | null;
  tier: string;
  stats: {
    clicks: number;
    signups: number;
    conversions: number;
    revenue: number;
    conversion_rate: number;
  };
  commission_rate: number;
  milestones: Array<{
    name: string;
    target: number;
    current: number;
    reward: string;
    reached: boolean;
  }>;
  earnings: {
    total: number;
    pending: number;
    paid: number;
  };
}

export default function PartenaireScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [bio, setBio] = useState("");

  const fetchPartner = useCallback(async () => {
    try {
      const res = await apiFetch<PartnerData>("/api/partner");
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger les donnees partenaire.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPartner();
  }, [fetchPartner]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPartner();
  }, [fetchPartner]);

  const handleApply = async () => {
    setApplying(true);
    try {
      await apiFetch("/api/partner", {
        method: "POST",
        body: { action: "apply", bio: bio.trim() },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Candidature envoyee !", "Tu es automatiquement accepte. Bienvenue dans le programme !");
      fetchPartner();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Erreur lors de la candidature.");
    } finally {
      setApplying(false);
    }
  };

  const copyLink = async () => {
    if (!data?.slug) return;
    await Clipboard.setStringAsync(`${SITE_URL}/go/${data.slug}`);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copie !", "Ton lien partenaire a ete copie.");
  };

  const shareLink = async () => {
    if (!data?.slug) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Decouvre SUTRA, la plateforme de creation video IA ! ${SITE_URL}/go/${data.slug}`,
      });
    } catch (_) {
      // user cancelled
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="partenaire-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="partenaire-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Partenariat</Text>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={160} className="rounded-2xl mb-4" />
          <Skeleton height={100} className="rounded-2xl mb-4" />
          <Skeleton height={80} className="rounded-2xl" />
        </View>
      ) : !data ? (
        <EmptyState
          icon="🤝"
          title="Programme indisponible"
          description="Impossible de charger le programme partenaire."
          actionLabel="Reessayer"
          onAction={fetchPartner}
        />
      ) : !data.is_partner ? (
        /* Apply Form */
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
          <Card className="mb-6 p-6 items-center">
            <Text className="text-5xl mb-3">🚀</Text>
            <Text className="text-white text-2xl font-sans-bold text-center mb-2">
              Deviens partenaire SUTRA
            </Text>
            <Text className="text-white/60 font-sans text-center mb-4">
              Gagne 50% du premier paiement et 10% de commission a vie sur chaque filleul.
            </Text>
            <View className="flex-row gap-3 mb-2">
              <Badge variant="success">50% 1er paiement</Badge>
              <Badge variant="primary">10% a vie</Badge>
            </View>
          </Card>

          <Card className="mb-4 p-4">
            <Text className="text-white font-sans-bold text-base mb-3">Avantages par palier</Text>
            {[
              { tier: "Bronze (10)", reward: "Starter GRATUIT a vie" },
              { tier: "Argent (25)", reward: "Pro + early access" },
              { tier: "Or (50)", reward: "Unlimited + page perso" },
              { tier: "Platine (100)", reward: "Enterprise + events" },
              { tier: "Diamant (250)", reward: "VIP + 15% commission" },
            ].map((item) => (
              <View key={item.tier} className="flex-row items-center py-2 border-b border-white/[0.06] last:border-b-0">
                <Ionicons name="shield" size={16} color={THEME.primary} />
                <Text className="text-white font-sans text-sm ml-2 flex-1">{item.tier}</Text>
                <Text className="text-white/60 font-sans text-xs">{item.reward}</Text>
              </View>
            ))}
          </Card>

          <Input
            label="Presentation (optionnelle)"
            placeholder="Parle de toi et de ta communaute..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={3}
            testID="partner-bio-input"
          />

          <Button
            onPress={handleApply}
            loading={applying}
            testID="apply-partner"
            icon={<Ionicons name="rocket" size={18} color="#fff" />}
          >
            Rejoindre le programme
          </Button>
        </ScrollView>
      ) : (
        /* Partner Dashboard */
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
        >
          {/* Link & Tier */}
          <Card className="mb-4 p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Badge variant="primary">{data.tier}</Badge>
              <Text className="text-primary-light font-sans-bold">{data.commission_rate}% commission</Text>
            </View>
            <Text className="text-white/40 font-sans text-sm mb-2">Ton lien partenaire</Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-1 bg-white/5 rounded-lg px-3 py-2">
                <Text className="text-white/60 font-sans text-sm" numberOfLines={1}>
                  {SITE_URL}/go/{data.slug}
                </Text>
              </View>
              <TouchableOpacity onPress={copyLink} className="bg-white/10 p-2.5 rounded-lg" testID="copy-partner-link">
                <Ionicons name="copy-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={shareLink} className="bg-primary p-2.5 rounded-lg" testID="share-partner-link">
                <Ionicons name="share-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </Card>

          {/* Stats */}
          <View className="flex-row gap-3 mb-4">
            <Card className="flex-1 p-3 items-center">
              <Text className="text-white text-xl font-sans-bold">{data.stats.clicks}</Text>
              <Text className="text-white/40 font-sans text-xs">Clics</Text>
            </Card>
            <Card className="flex-1 p-3 items-center">
              <Text className="text-white text-xl font-sans-bold">{data.stats.signups}</Text>
              <Text className="text-white/40 font-sans text-xs">Inscrits</Text>
            </Card>
            <Card className="flex-1 p-3 items-center">
              <Text className="text-success text-xl font-sans-bold">{data.stats.conversions}</Text>
              <Text className="text-white/40 font-sans text-xs">Convertis</Text>
            </Card>
          </View>

          {/* Earnings */}
          <Card className="mb-4 p-4">
            <Text className="text-white font-sans-bold text-base mb-3">Revenus</Text>
            <View className="flex-row justify-between">
              <View className="flex-1 items-center">
                <Text className="text-white text-xl font-sans-bold">{formatPrice(data.earnings.total)}</Text>
                <Text className="text-white/40 font-sans text-xs">Total</Text>
              </View>
              <View className="w-px bg-white/10" />
              <View className="flex-1 items-center">
                <Text className="text-warning text-xl font-sans-bold">{formatPrice(data.earnings.pending)}</Text>
                <Text className="text-white/40 font-sans text-xs">En attente</Text>
              </View>
              <View className="w-px bg-white/10" />
              <View className="flex-1 items-center">
                <Text className="text-success text-xl font-sans-bold">{formatPrice(data.earnings.paid)}</Text>
                <Text className="text-white/40 font-sans text-xs">Verse</Text>
              </View>
            </View>
          </Card>

          {/* Milestones */}
          <Text className="text-white text-lg font-sans-bold mb-3">Paliers</Text>
          {data.milestones.map((milestone) => (
            <Card key={milestone.name} className={`mb-2 ${milestone.reached ? "" : "opacity-60"}`}>
              <View className="flex-row items-center mb-2">
                <Ionicons
                  name={milestone.reached ? "checkmark-circle" : "shield-outline"}
                  size={18}
                  color={milestone.reached ? THEME.success : THEME.textSecondary}
                />
                <Text className="text-white font-sans-medium ml-2 flex-1">{milestone.name}</Text>
                <Text className="text-white/40 font-sans text-sm">{milestone.reward}</Text>
              </View>
              <ProgressBar
                progress={(milestone.current / milestone.target) * 100}
                label={`${milestone.current} / ${milestone.target}`}
              />
            </Card>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

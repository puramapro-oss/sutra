import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { formatPoints, pointsToEuros, formatPrice } from "../../lib/utils";
import { THEME } from "../../lib/constants";
import { Card, Button, Badge, Skeleton, EmptyState, Modal } from "../../components/ui";
import type { ShopItem, DailyGift } from "../../types/database";

interface BoutiqueData {
  balance: number;
  lifetime_earned: number;
  items: ShopItem[];
}

interface DailyGiftResponse {
  available: boolean;
  gift: DailyGift | null;
  streak: number;
  next_available_at: string | null;
}

export default function BoutiqueScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<BoutiqueData | null>(null);
  const [dailyGift, setDailyGift] = useState<DailyGiftResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [giftOpening, setGiftOpening] = useState(false);
  const [showGiftResult, setShowGiftResult] = useState(false);
  const [giftResult, setGiftResult] = useState<DailyGift | null>(null);
  const chestScale = useRef(new Animated.Value(1)).current;
  const chestRotation = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    try {
      const [boutiqueRes, giftRes] = await Promise.all([
        apiFetch<BoutiqueData>("/api/boutique"),
        apiFetch<DailyGiftResponse>("/api/daily-gift"),
      ]);
      setData(boutiqueRes);
      setDailyGift(giftRes);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger la boutique.");
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

  const openDailyGift = async () => {
    setGiftOpening(true);

    Animated.sequence([
      Animated.timing(chestScale, { toValue: 1.2, duration: 150, useNativeDriver: true }),
      Animated.timing(chestRotation, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(chestRotation, { toValue: -1, duration: 100, useNativeDriver: true }),
      Animated.timing(chestRotation, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(chestRotation, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(chestScale, { toValue: 1.5, duration: 200, useNativeDriver: true }),
    ]).start();

    try {
      const res = await apiFetch<{ gift: DailyGift }>("/api/daily-gift", { method: "POST" });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGiftResult(res.gift);
      setShowGiftResult(true);
      setDailyGift((prev) => prev ? { ...prev, available: false, gift: res.gift, streak: (prev.streak ?? 0) + 1 } : prev);
      fetchData();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Impossible d'ouvrir le coffre.");
    } finally {
      setGiftOpening(false);
      chestScale.setValue(1);
      chestRotation.setValue(0);
    }
  };

  const purchaseItem = async (item: ShopItem) => {
    if (data && item.cost_points > data.balance) {
      Alert.alert("Points insuffisants", `Il te manque ${formatPoints(item.cost_points - data.balance)} points.`);
      return;
    }

    Alert.alert(
      "Confirmer l'achat",
      `Acheter "${item.name}" pour ${formatPoints(item.cost_points)} points ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Acheter",
          onPress: async () => {
            setPurchasing(item.id);
            try {
              await apiFetch("/api/boutique", {
                method: "POST",
                body: { item_id: item.id },
              });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Achat reussi !", `Tu as obtenu "${item.name}".`);
              fetchData();
            } catch (err) {
              Alert.alert("Erreur", err instanceof Error ? err.message : "Erreur lors de l'achat.");
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "reduction": return "pricetag";
      case "subscription": return "star";
      case "ticket": return "ticket";
      case "feature": return "flash";
      case "cash": return "cash";
      default: return "gift";
    }
  };

  const spin = chestRotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-5deg", "0deg", "5deg"],
  });

  return (
    <SafeAreaView className="flex-1 bg-background" testID="boutique-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="boutique-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4 flex-1">Boutique</Text>
        {data && (
          <View className="flex-row items-center bg-primary/20 px-3 py-1.5 rounded-full">
            <Ionicons name="diamond" size={14} color={THEME.primary} />
            <Text className="text-primary-light font-sans-bold text-sm ml-1" testID="points-balance">
              {formatPoints(data.balance)}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={120} className="rounded-2xl mb-4" />
          <Skeleton height={80} className="rounded-2xl mb-2" />
          <Skeleton height={80} className="rounded-2xl mb-2" />
          <Skeleton height={80} className="rounded-2xl" />
        </View>
      ) : !data ? (
        <EmptyState
          icon="🏪"
          title="Boutique indisponible"
          description="Impossible de charger la boutique."
          actionLabel="Reessayer"
          onAction={fetchData}
        />
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
          ListHeaderComponent={
            <View className="mb-6">
              {/* Daily Gift */}
              {dailyGift && (
                <Card className="mb-4 p-6 items-center">
                  <Text className="text-white font-sans-bold text-lg mb-2">Coffre quotidien</Text>
                  {dailyGift.streak > 0 && (
                    <Badge variant="warning" className="mb-3">
                      Serie : {dailyGift.streak} jours
                    </Badge>
                  )}

                  <Animated.View style={{ transform: [{ scale: chestScale }, { rotate: spin }] }}>
                    <Text className="text-6xl mb-4">{dailyGift.available ? "🎁" : "📦"}</Text>
                  </Animated.View>

                  {dailyGift.available ? (
                    <Button
                      onPress={openDailyGift}
                      loading={giftOpening}
                      testID="open-daily-gift"
                    >
                      Ouvrir le coffre
                    </Button>
                  ) : (
                    <Text className="text-white/40 font-sans text-sm text-center">
                      Reviens demain pour ton prochain coffre !
                    </Text>
                  )}
                </Card>
              )}

              {/* Balance Card */}
              <Card className="mb-4 p-4">
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-white/40 font-sans text-xs">Tes points</Text>
                    <Text className="text-white text-2xl font-sans-bold">{formatPoints(data.balance)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-white/40 font-sans text-xs">Valeur</Text>
                    <Text className="text-success text-lg font-sans-bold">
                      {formatPrice(pointsToEuros(data.balance))}
                    </Text>
                  </View>
                </View>
              </Card>

              <Text className="text-white text-lg font-sans-bold mb-3">Articles</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="mb-3" testID={`shop-item-${item.id}`}>
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-xl bg-primary/20 items-center justify-center mr-3">
                  <Ionicons name={getItemIcon(item.type)} size={24} color={THEME.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-sans-medium text-base">{item.name}</Text>
                  <Text className="text-white/40 font-sans text-sm" numberOfLines={2}>{item.description}</Text>
                </View>
                <Button
                  size="sm"
                  variant={data.balance >= item.cost_points ? "primary" : "outline"}
                  onPress={() => purchaseItem(item)}
                  loading={purchasing === item.id}
                  disabled={purchasing !== null}
                  testID={`buy-item-${item.id}`}
                >
                  {formatPoints(item.cost_points)} pts
                </Button>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="🛍"
              title="Boutique vide"
              description="Les articles seront bientot disponibles."
            />
          }
        />
      )}

      <Modal
        visible={showGiftResult}
        onClose={() => setShowGiftResult(false)}
        title="Cadeau du jour !"
      >
        {giftResult && (
          <View className="items-center py-4">
            <Text className="text-5xl mb-4">🎉</Text>
            <Text className="text-white text-xl font-sans-bold text-center mb-2">
              {giftResult.gift_type === "points" && `+${giftResult.gift_value} points`}
              {giftResult.gift_type === "coupon" && `Coupon ${giftResult.gift_value}`}
              {giftResult.gift_type === "ticket" && `${giftResult.gift_value} ticket(s) loterie`}
              {giftResult.gift_type === "credits" && `+${giftResult.gift_value} credits`}
            </Text>
            <Text className="text-white/40 font-sans text-sm text-center">
              Serie de {dailyGift?.streak ?? 1} jour(s) !
            </Text>
            <Button onPress={() => setShowGiftResult(false)} className="mt-6 w-full">
              Genial !
            </Button>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

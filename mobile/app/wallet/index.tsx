import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { formatPrice, formatDate } from "../../lib/utils";
import { WALLET_MIN_WITHDRAWAL, THEME } from "../../lib/constants";
import { Card, Button, Input, Badge, Skeleton, EmptyState, Modal } from "../../components/ui";
import type { WalletTransaction } from "../../types/database";

interface WalletData {
  balance: number;
  pending: number;
  transactions: WalletTransaction[];
  total_earned: number;
  total_withdrawn: number;
}

export default function WalletScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [iban, setIban] = useState("");
  const [amount, setAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await apiFetch<WalletData>("/api/wallet");
      setData(res);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger le portefeuille. Verifie ta connexion.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWallet();
  }, [fetchWallet]);

  const handleWithdraw = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < WALLET_MIN_WITHDRAWAL) {
      Alert.alert("Erreur", `Le montant minimum de retrait est de ${WALLET_MIN_WITHDRAWAL}\u00A0\u20AC.`);
      return;
    }
    if (!iban.trim() || iban.trim().length < 15) {
      Alert.alert("Erreur", "Entre un IBAN valide.");
      return;
    }
    if (data && numAmount > data.balance) {
      Alert.alert("Erreur", "Solde insuffisant pour ce retrait.");
      return;
    }

    setWithdrawing(true);
    try {
      await apiFetch("/api/wallet", {
        method: "POST",
        body: { action: "withdraw", amount: numAmount, iban: iban.trim() },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Retrait demande", `${formatPrice(numAmount)} sera vire sur ton compte sous 3-5 jours ouvrables.`);
      setShowWithdraw(false);
      setIban("");
      setAmount("");
      fetchWallet();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Erreur lors du retrait.");
    } finally {
      setWithdrawing(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "referral":
        return "people";
      case "contest":
        return "trophy";
      case "lottery":
        return "ticket";
      case "withdrawal":
        return "arrow-down-circle";
      case "mission":
        return "flag";
      default:
        return "cash";
    }
  };

  const renderTransaction = ({ item }: { item: WalletTransaction }) => (
    <Card className="mb-2" testID={`transaction-${item.id}`}>
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
          <Ionicons name={getTransactionIcon(item.type)} size={20} color={THEME.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-white font-sans-medium text-base">{item.description}</Text>
          <Text className="text-white/40 font-sans text-sm">{formatDate(item.created_at)}</Text>
        </View>
        <Text
          className={`font-sans-bold text-base ${item.amount >= 0 ? "text-success" : "text-error"}`}
        >
          {item.amount >= 0 ? "+" : ""}
          {formatPrice(item.amount)}
        </Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" testID="wallet-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="wallet-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Portefeuille</Text>
      </View>

      {loading ? (
        <View className="px-4">
          <Skeleton height={140} className="rounded-2xl mb-4" />
          <Skeleton height={60} className="rounded-2xl mb-2" />
          <Skeleton height={60} className="rounded-2xl mb-2" />
          <Skeleton height={60} className="rounded-2xl" />
        </View>
      ) : !data ? (
        <EmptyState
          icon="💰"
          title="Portefeuille indisponible"
          description="Impossible de charger ton portefeuille pour le moment."
          actionLabel="Reessayer"
          onAction={fetchWallet}
        />
      ) : (
        <FlatList
          data={data.transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
          ListHeaderComponent={
            <View className="mb-6">
              <Card className="mb-4 p-6">
                <Text className="text-white/60 font-sans text-sm mb-1">Solde disponible</Text>
                <Text className="text-white text-4xl font-sans-bold" testID="wallet-balance">
                  {formatPrice(data.balance)}
                </Text>
                {data.pending > 0 && (
                  <View className="flex-row items-center mt-2">
                    <Ionicons name="time-outline" size={14} color={THEME.warning} />
                    <Text className="text-warning font-sans text-sm ml-1">
                      {formatPrice(data.pending)} en attente
                    </Text>
                  </View>
                )}

                <View className="flex-row mt-4 gap-4">
                  <View className="flex-1">
                    <Text className="text-white/40 font-sans text-xs">Total gagne</Text>
                    <Text className="text-success font-sans-bold text-lg">
                      {formatPrice(data.total_earned)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white/40 font-sans text-xs">Total retire</Text>
                    <Text className="text-white font-sans-bold text-lg">
                      {formatPrice(data.total_withdrawn)}
                    </Text>
                  </View>
                </View>
              </Card>

              <Button
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowWithdraw(true);
                }}
                disabled={data.balance < WALLET_MIN_WITHDRAWAL}
                testID="withdraw-button"
                className="mb-4"
              >
                Retirer des fonds
              </Button>

              {data.balance < WALLET_MIN_WITHDRAWAL && (
                <Text className="text-white/40 font-sans text-sm text-center mb-4">
                  Minimum {formatPrice(WALLET_MIN_WITHDRAWAL)} pour effectuer un retrait
                </Text>
              )}

              <Text className="text-white text-lg font-sans-bold mb-3">Historique</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="Aucune transaction"
              description="Tes transactions apparaitront ici."
            />
          }
        />
      )}

      <Modal
        visible={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        title="Retirer des fonds"
      >
        <Text className="text-white/60 font-sans text-sm mb-4">
          Solde disponible : {formatPrice(data?.balance ?? 0)}
        </Text>

        <Input
          label="Montant (EUR)"
          placeholder={`Min. ${WALLET_MIN_WITHDRAWAL} EUR`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          testID="withdraw-amount-input"
        />

        <Input
          label="IBAN"
          placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
          value={iban}
          onChangeText={setIban}
          autoCapitalize="characters"
          testID="withdraw-iban-input"
        />

        <Button
          onPress={handleWithdraw}
          loading={withdrawing}
          testID="confirm-withdraw"
          className="mt-2"
        >
          Confirmer le retrait
        </Button>
      </Modal>
    </SafeAreaView>
  );
}

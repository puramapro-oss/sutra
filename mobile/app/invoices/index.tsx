import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { formatDate, formatPrice } from "../../lib/utils";
import { THEME } from "../../lib/constants";
import { Card, Skeleton, EmptyState } from "../../components/ui";

interface Invoice {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  invoice_number: string;
  description: string;
}

export default function InvoicesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      const data = await apiFetch<{ invoices: Invoice[] }>("/api/stripe/invoices");
      setInvoices(data.invoices || []);
    } catch {
      // Defaults
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchInvoices();
    else setLoading(false);
  }, [user, fetchInvoices]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.background }}>
      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchInvoices();
            }}
            tintColor="#8B5CF6"
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-white text-xl font-bold">Factures</Text>
            <Text className="text-white/50 text-sm">
              Historique de tes paiements
            </Text>
          </View>
        </View>

        {/* Company info */}
        <Card className="p-4 mb-4">
          <Text className="text-white/40 text-xs leading-5">
            SASU PURAMA — 8 Rue de la Chapelle, 25560 Frasne{"\n"}
            TVA non applicable, art. 293B du CGI
          </Text>
        </Card>

        {loading ? (
          <View className="gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </View>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="Aucune facture"
            description="Tes factures apparaitront apres ton premier paiement."
          />
        ) : (
          <View className="gap-3">
            {invoices.map((inv) => (
              <Card key={inv.id} className="p-4 flex-row items-center">
                <View className="w-10 h-10 rounded-xl bg-violet-500/10 items-center justify-center mr-3">
                  <Ionicons name="document-text" size={20} color="#8B5CF6" />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-sm font-semibold">
                    {inv.invoice_number || `FA-${inv.id.slice(0, 8).toUpperCase()}`}
                  </Text>
                  <Text className="text-white/40 text-xs">
                    {formatDate(inv.created_at)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-white font-bold text-sm">
                    {formatPrice(inv.amount / 100)}
                  </Text>
                  <Text
                    className={`text-xs ${
                      inv.status === "paid"
                        ? "text-green-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {inv.status === "paid" ? "Payee" : "En attente"}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Stripe portal */}
        <TouchableOpacity
          onPress={() =>
            Linking.openURL("https://sutra.purama.dev/api/stripe/portal")
          }
          className="mt-6 items-center"
        >
          <Text className="text-violet-400 text-sm">
            Gerer mon abonnement sur Stripe →
          </Text>
        </TouchableOpacity>

        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}

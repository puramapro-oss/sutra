import { useState, useCallback } from "react";
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
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { apiFetch } from "../../lib/api";
import { THEME } from "../../lib/constants";
import { Card, Button, Skeleton, EmptyState } from "../../components/ui";

interface Aide {
  id: string;
  nom: string;
  type_aide: string;
  montant_max: number;
  taux_remboursement: number;
  url_officielle: string;
  description: string;
}

const PROFILS = [
  { id: "particulier", label: "Particulier", icon: "person" as const },
  { id: "entreprise", label: "Entreprise", icon: "business" as const },
  { id: "association", label: "Association", icon: "people" as const },
  { id: "etudiant", label: "Etudiant", icon: "school" as const },
];

export default function FinancerScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profil, setProfil] = useState("");
  const [aides, setAides] = useState<Aide[]>([]);
  const [loading, setLoading] = useState(false);
  const [cumulTotal, setCumulTotal] = useState(0);

  const fetchAides = useCallback(async () => {
    if (!profil) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ aides: Aide[]; cumul_total: number }>(`/api/financer?profil=${profil}`);
      setAides(data.aides || []);
      setCumulTotal(data.cumul_total || 0);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [profil]);

  useEffect(() => {
    if (step === 2) fetchAides();
  }, [step, fetchAides]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.background }}>
      <ScrollView className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3"
            testID="financer-back"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-white text-xl font-bold">Financement</Text>
            <Text className="text-white/50 text-sm">
              Fais rembourser ton abonnement
            </Text>
          </View>
        </View>

        {/* Step indicators */}
        <View className="flex-row items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              className={`w-8 h-8 rounded-full items-center justify-center ${
                s === step
                  ? "bg-violet-600"
                  : s < step
                    ? "bg-green-500/20 border border-green-500/30"
                    : "bg-white/5 border border-white/10"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  s === step
                    ? "text-white"
                    : s < step
                      ? "text-green-400"
                      : "text-white/30"
                }`}
              >
                {s < step ? "✓" : s}
              </Text>
            </View>
          ))}
        </View>

        {/* Step 1 — Profil */}
        {step === 1 && (
          <View>
            <Card className="p-5 mb-4">
              <Text className="text-white font-semibold mb-4">
                Selectionne ton profil
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {PROFILS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setProfil(p.id);
                    }}
                    className={`flex-1 min-w-[45%] items-center p-4 rounded-xl border ${
                      profil === p.id
                        ? "bg-violet-500/10 border-violet-500/30"
                        : "bg-white/[0.03] border-white/[0.08]"
                    }`}
                    testID={`profil-${p.id}`}
                  >
                    <Ionicons
                      name={p.icon}
                      size={24}
                      color={profil === p.id ? "#8B5CF6" : "#ffffff60"}
                    />
                    <Text
                      className={`text-sm mt-2 ${
                        profil === p.id ? "text-white" : "text-white/60"
                      }`}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
            {profil && (
              <Button
                onPress={() => setStep(2)}
                testID="financer-next"
              >
                Voir mes aides
              </Button>
            )}
          </View>
        )}

        {/* Step 2 — Aides */}
        {step === 2 && (
          <View>
            <Card className="p-4 mb-4 bg-green-500/10 border-green-500/20">
              <Text className="text-green-400 text-sm font-medium text-center">
                Cumul estimatif
              </Text>
              <Text className="text-green-400 text-2xl font-bold text-center">
                {cumulTotal.toLocaleString("fr-FR")} EUR
              </Text>
            </Card>

            {loading ? (
              <View className="gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </View>
            ) : aides.length === 0 ? (
              <EmptyState
                icon="search"
                title="Aucune aide trouvee"
                description="Modifie tes criteres"
              />
            ) : (
              <View className="gap-3 mb-4">
                {aides.map((aide) => (
                  <TouchableOpacity
                    key={aide.id}
                    onPress={() => {
                      if (aide.url_officielle) {
                        Linking.openURL(aide.url_officielle);
                      }
                    }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4"
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-3">
                        <Text className="text-white text-sm font-semibold">
                          {aide.nom}
                        </Text>
                        <Text
                          className="text-white/40 text-xs mt-1"
                          numberOfLines={2}
                        >
                          {aide.description}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-white font-bold">
                          {aide.montant_max.toLocaleString("fr-FR")} EUR
                        </Text>
                        <Text className="text-green-400 text-xs">
                          {aide.taux_remboursement}%
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button onPress={() => setStep(1)} variant="outline">
                  Retour
                </Button>
              </View>
              <View className="flex-1">
                <Button onPress={() => setStep(3)}>
                  Continuer
                </Button>
              </View>
            </View>
          </View>
        )}

        {/* Step 3 — Success */}
        {step === 3 && (
          <Card className="p-6 items-center">
            <View className="w-16 h-16 rounded-full bg-green-500/20 items-center justify-center mb-4">
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
            </View>
            <Text className="text-white text-xl font-bold text-center mb-2">
              Tes aides sont identifiees
            </Text>
            <Text className="text-white/50 text-sm text-center mb-6">
              Consulte le site web pour generer tes dossiers PDF.
            </Text>
            <Button
              onPress={() => Linking.openURL("https://sutra.purama.dev/financer")}
              testID="financer-web"
            >
              Generer mes dossiers
            </Button>
          </Card>
        )}

        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}

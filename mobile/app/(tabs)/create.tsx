import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { useVideoStore } from "../../lib/store";
import { Button, Card, Badge } from "../../components/ui";
import { NICHES, VOICES, PLAN_LIMITS, type Plan } from "../../lib/constants";

type Step = "topic" | "niche" | "voice" | "format" | "quality" | "confirm";

export default function CreateScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { triggerRefresh } = useVideoStore();
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [voice, setVoice] = useState("thomas");
  const [format, setFormat] = useState<"16:9" | "9:16" | "1:1">("9:16");
  const [quality, setQuality] = useState<"720p" | "1080p" | "4k">("1080p");
  const [loading, setLoading] = useState(false);

  const plan = (user?.plan || "free") as Plan;
  const limits = PLAN_LIMITS[plan];

  const handleCreate = async () => {
    setLoading(true);
    try {
      await apiFetch("/api/create", {
        method: "POST",
        body: { topic, niche, voice, format, quality },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerRefresh();
      Alert.alert(
        "Vidéo lancée ! 🎬",
        "Ta vidéo est en cours de génération. Tu recevras une notification quand elle sera prête.",
        [{ text: "Super !", onPress: () => router.push("/(tabs)/library") }]
      );
    } catch (err: unknown) {
      Alert.alert(
        "Erreur",
        err instanceof Error ? err.message : "Impossible de créer la vidéo"
      );
    } finally {
      setLoading(false);
    }
  };

  const nicheEmojis: Record<string, string> = {
    "bien-etre": "🧘", tech: "💻", finance: "💰", motivation: "🔥",
    lifestyle: "✨", education: "📚", divertissement: "🎭", cuisine: "🍳",
    sport: "⚽", voyage: "✈️", science: "🔬", business: "📈",
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        <View className="py-4">
          <Text className="text-white text-2xl font-sans-bold">
            Créer une vidéo
          </Text>
          <Text className="text-white/50 font-sans mt-1">
            Étape {["topic", "niche", "voice", "format", "quality", "confirm"].indexOf(step) + 1}/6
          </Text>
        </View>

        {/* Progress */}
        <View className="flex-row gap-1 mb-6">
          {["topic", "niche", "voice", "format", "quality", "confirm"].map((s, i) => (
            <View
              key={s}
              className={`flex-1 h-1 rounded-full ${
                ["topic", "niche", "voice", "format", "quality", "confirm"].indexOf(step) >= i
                  ? "bg-primary"
                  : "bg-white/10"
              }`}
            />
          ))}
        </View>

        {step === "topic" && (
          <View>
            <Text className="text-white text-lg font-sans-bold mb-2">
              De quoi parle ta vidéo ?
            </Text>
            <Text className="text-white/50 font-sans mb-4">
              Décris le sujet, l'IA s'occupe du reste
            </Text>
            <TextInput
              className="bg-white/5 border border-white/[0.06] rounded-2xl p-4 text-white text-base font-sans min-h-[120px]"
              placeholder="Ex: Les 5 habitudes des millionnaires qui changent tout..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              textAlignVertical="top"
              value={topic}
              onChangeText={setTopic}
              testID="create-topic"
            />
            <Button
              onPress={() => {
                if (topic.trim().length < 10) {
                  Alert.alert("Trop court", "Décris un peu plus ton sujet (min 10 caractères)");
                  return;
                }
                setStep("niche");
              }}
              size="lg"
              className="mt-6"
              disabled={topic.trim().length < 10}
            >
              Continuer
            </Button>
          </View>
        )}

        {step === "niche" && (
          <View>
            <Text className="text-white text-lg font-sans-bold mb-4">
              Choisis ta niche
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {NICHES.map((n) => (
                <TouchableOpacity
                  key={n}
                  className={`px-4 py-3 rounded-xl border ${
                    niche === n
                      ? "bg-primary/20 border-primary"
                      : "bg-white/5 border-white/[0.06]"
                  }`}
                  onPress={() => {
                    setNiche(n);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text className="text-white font-sans">
                    {nicheEmojis[n] || "📌"} {n.charAt(0).toUpperCase() + n.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3 mt-6">
              <Button variant="outline" onPress={() => setStep("topic")} className="flex-1">
                Retour
              </Button>
              <Button
                onPress={() => setStep("voice")}
                className="flex-1"
                disabled={!niche}
              >
                Continuer
              </Button>
            </View>
          </View>
        )}

        {step === "voice" && (
          <View>
            <Text className="text-white text-lg font-sans-bold mb-4">
              Choisis la voix
            </Text>
            <View className="gap-3">
              {VOICES.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  className={`flex-row items-center p-4 rounded-xl border ${
                    voice === v.id
                      ? "bg-primary/20 border-primary"
                      : "bg-white/5 border-white/[0.06]"
                  }`}
                  onPress={() => {
                    setVoice(v.id);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text className="text-2xl mr-3">
                    {v.gender === "male" ? "🎙️" : "🎤"}
                  </Text>
                  <View>
                    <Text className="text-white font-sans-bold">{v.name}</Text>
                    <Text className="text-white/40 text-sm font-sans">
                      Voix {v.gender === "male" ? "masculine" : "féminine"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3 mt-6">
              <Button variant="outline" onPress={() => setStep("niche")} className="flex-1">
                Retour
              </Button>
              <Button onPress={() => setStep("format")} className="flex-1">
                Continuer
              </Button>
            </View>
          </View>
        )}

        {step === "format" && (
          <View>
            <Text className="text-white text-lg font-sans-bold mb-4">
              Format de la vidéo
            </Text>
            <View className="flex-row gap-3">
              {(["9:16", "16:9", "1:1"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  className={`flex-1 py-6 rounded-xl border items-center ${
                    format === f
                      ? "bg-primary/20 border-primary"
                      : "bg-white/5 border-white/[0.06]"
                  }`}
                  onPress={() => {
                    setFormat(f);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text className="text-white font-sans-bold text-lg">{f}</Text>
                  <Text className="text-white/40 text-xs font-sans mt-1">
                    {f === "9:16" ? "Shorts/Reels" : f === "16:9" ? "YouTube" : "Carré"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3 mt-6">
              <Button variant="outline" onPress={() => setStep("voice")} className="flex-1">
                Retour
              </Button>
              <Button onPress={() => setStep("quality")} className="flex-1">
                Continuer
              </Button>
            </View>
          </View>
        )}

        {step === "quality" && (
          <View>
            <Text className="text-white text-lg font-sans-bold mb-4">
              Qualité vidéo
            </Text>
            <View className="gap-3">
              {(["720p", "1080p", "4k"] as const).map((q) => {
                const locked = q === "4k" && !["empire", "enterprise", "admin"].includes(plan);
                return (
                  <TouchableOpacity
                    key={q}
                    className={`flex-row items-center justify-between p-4 rounded-xl border ${
                      quality === q
                        ? "bg-primary/20 border-primary"
                        : locked
                        ? "bg-white/[0.02] border-white/[0.03] opacity-50"
                        : "bg-white/5 border-white/[0.06]"
                    }`}
                    onPress={() => {
                      if (locked) {
                        Alert.alert("Plan Empire requis", "La qualité 4K est disponible à partir du plan Empire.");
                        return;
                      }
                      setQuality(q);
                      Haptics.selectionAsync();
                    }}
                  >
                    <View>
                      <Text className="text-white font-sans-bold">{q.toUpperCase()}</Text>
                      <Text className="text-white/40 text-sm font-sans">
                        {q === "720p" ? "Standard" : q === "1080p" ? "HD" : "Ultra HD"}
                      </Text>
                    </View>
                    {locked && <Badge variant="warning">Empire+</Badge>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View className="flex-row gap-3 mt-6">
              <Button variant="outline" onPress={() => setStep("format")} className="flex-1">
                Retour
              </Button>
              <Button onPress={() => setStep("confirm")} className="flex-1">
                Continuer
              </Button>
            </View>
          </View>
        )}

        {step === "confirm" && (
          <View>
            <Text className="text-white text-lg font-sans-bold mb-4">
              Récapitulatif
            </Text>
            <Card className="mb-4">
              <View className="gap-3">
                <View className="flex-row justify-between">
                  <Text className="text-white/50 font-sans">Sujet</Text>
                  <Text className="text-white font-sans flex-1 ml-4 text-right" numberOfLines={2}>
                    {topic}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/50 font-sans">Niche</Text>
                  <Text className="text-white font-sans">{niche}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/50 font-sans">Voix</Text>
                  <Text className="text-white font-sans">
                    {VOICES.find((v) => v.id === voice)?.name}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/50 font-sans">Format</Text>
                  <Text className="text-white font-sans">{format}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/50 font-sans">Qualité</Text>
                  <Text className="text-white font-sans">{quality}</Text>
                </View>
              </View>
            </Card>
            <View className="flex-row gap-3">
              <Button variant="outline" onPress={() => setStep("quality")} className="flex-1">
                Retour
              </Button>
              <Button
                onPress={handleCreate}
                loading={loading}
                className="flex-1"
                testID="create-submit"
              >
                Lancer la création 🚀
              </Button>
            </View>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

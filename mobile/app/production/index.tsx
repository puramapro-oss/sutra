import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { NICHES, VOICES, THEME } from "../../lib/constants";
import { Card, Button, Input, Badge, ProgressBar } from "../../components/ui";

type Step = "topic" | "niche" | "voice" | "style" | "options" | "review";

const STEP_ORDER: Step[] = ["topic", "niche", "voice", "style", "options", "review"];

const VIDEO_STYLES = [
  { id: "cinematic", name: "Cinematique", icon: "🎬" },
  { id: "vlog", name: "Vlog", icon: "📹" },
  { id: "documentary", name: "Documentaire", icon: "🎞" },
  { id: "dynamic", name: "Dynamique", icon: "⚡" },
  { id: "minimal", name: "Minimaliste", icon: "✨" },
  { id: "tutorial", name: "Tutoriel", icon: "📚" },
];

export default function ProductionScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState<string>(NICHES[0]);
  const [voice, setVoice] = useState<string>(VOICES[0].id);
  const [style, setStyle] = useState("cinematic");
  const [quality, setQuality] = useState<"720p" | "1080p" | "4k">("1080p");
  const [format, setFormat] = useState<"16:9" | "9:16" | "1:1">("9:16");
  const [subtitles, setSubtitles] = useState(true);
  const [generating, setGenerating] = useState(false);

  const currentStepIndex = STEP_ORDER.indexOf(step);
  const progress = ((currentStepIndex + 1) / STEP_ORDER.length) * 100;

  const goNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(STEP_ORDER[idx + 1]);
    }
  };

  const goBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(STEP_ORDER[idx - 1]);
    } else {
      router.back();
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      Alert.alert("Erreur", "Entre un sujet pour ta video.");
      return;
    }
    setGenerating(true);
    try {
      const res = await apiFetch<{ video_id: string }>("/api/auto/videos", {
        method: "POST",
        body: { topic: topic.trim(), niche, voice, style, quality, format, subtitles },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Video en cours de creation !", "Tu seras notifie quand elle sera prete.", [
        { text: "Voir", onPress: () => router.push({ pathname: "/editor", params: { id: res.video_id } }) },
        { text: "OK" },
      ]);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Erreur lors de la generation.");
    } finally {
      setGenerating(false);
    }
  };

  const getNicheLabel = (n: string) => {
    const labels: Record<string, string> = {
      "bien-etre": "Bien-etre", tech: "Tech", finance: "Finance",
      motivation: "Motivation", lifestyle: "Lifestyle", education: "Education",
      divertissement: "Divertissement", cuisine: "Cuisine", sport: "Sport",
      voyage: "Voyage", science: "Science", business: "Business",
    };
    return labels[n] ?? n;
  };

  const renderStep = () => {
    switch (step) {
      case "topic":
        return (
          <View>
            <Text className="text-white text-2xl font-sans-bold mb-2">De quoi parle ta video ?</Text>
            <Text className="text-white/40 font-sans mb-6">Decris ton sujet en detail. L'IA creera le script, les visuels et la narration.</Text>
            <Input
              placeholder="Ex: Les 5 habitudes des entrepreneurs a succes..."
              value={topic}
              onChangeText={setTopic}
              multiline
              numberOfLines={4}
              testID="topic-input"
            />
            <Button onPress={goNext} disabled={!topic.trim()} testID="next-step" className="mt-4">
              Continuer
            </Button>
          </View>
        );

      case "niche":
        return (
          <View>
            <Text className="text-white text-2xl font-sans-bold mb-2">Quelle niche ?</Text>
            <Text className="text-white/40 font-sans mb-6">La niche influence le ton et le style de la video.</Text>
            <View className="flex-row flex-wrap gap-2">
              {NICHES.map((n) => (
                <TouchableOpacity
                  key={n}
                  className={`px-4 py-3 rounded-xl ${niche === n ? "bg-primary" : "bg-white/5"}`}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNiche(n); }}
                  testID={`prod-niche-${n}`}
                >
                  <Text className={`font-sans-medium ${niche === n ? "text-white" : "text-white/60"}`}>
                    {getNicheLabel(n)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button onPress={goNext} testID="next-step" className="mt-6">Continuer</Button>
          </View>
        );

      case "voice":
        return (
          <View>
            <Text className="text-white text-2xl font-sans-bold mb-2">Choisis une voix</Text>
            <Text className="text-white/40 font-sans mb-6">La voix qui narrera ta video.</Text>
            {VOICES.map((v) => (
              <TouchableOpacity
                key={v.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setVoice(v.id); }}
                testID={`prod-voice-${v.id}`}
              >
                <Card className={`mb-2 ${voice === v.id ? "border border-primary" : ""}`}>
                  <View className="flex-row items-center">
                    <Ionicons name={v.gender === "male" ? "man" : "woman"} size={20} color={voice === v.id ? THEME.primary : THEME.textSecondary} />
                    <Text className={`font-sans-medium text-base ml-3 flex-1 ${voice === v.id ? "text-primary-light" : "text-white"}`}>
                      {v.name}
                    </Text>
                    {voice === v.id && <Ionicons name="checkmark-circle" size={18} color={THEME.success} />}
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
            <Button onPress={goNext} testID="next-step" className="mt-4">Continuer</Button>
          </View>
        );

      case "style":
        return (
          <View>
            <Text className="text-white text-2xl font-sans-bold mb-2">Style visuel</Text>
            <Text className="text-white/40 font-sans mb-6">L'ambiance generale de ta video.</Text>
            {VIDEO_STYLES.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStyle(s.id); }}
                testID={`prod-style-${s.id}`}
              >
                <Card className={`mb-2 ${style === s.id ? "border border-primary" : ""}`}>
                  <View className="flex-row items-center">
                    <Text className="text-2xl mr-3">{s.icon}</Text>
                    <Text className={`font-sans-medium text-base flex-1 ${style === s.id ? "text-primary-light" : "text-white"}`}>
                      {s.name}
                    </Text>
                    {style === s.id && <Ionicons name="checkmark-circle" size={18} color={THEME.success} />}
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
            <Button onPress={goNext} testID="next-step" className="mt-4">Continuer</Button>
          </View>
        );

      case "options":
        return (
          <View>
            <Text className="text-white text-2xl font-sans-bold mb-2">Options</Text>
            <Text className="text-white/40 font-sans mb-6">Affine les parametres techniques.</Text>

            <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">Qualite</Text>
            <View className="flex-row gap-2 mb-4">
              {(["720p", "1080p", "4k"] as const).map((q) => (
                <TouchableOpacity
                  key={q}
                  className={`flex-1 py-3 rounded-xl items-center ${quality === q ? "bg-primary" : "bg-white/5"}`}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQuality(q); }}
                  testID={`quality-${q}`}
                >
                  <Text className={`font-sans-bold ${quality === q ? "text-white" : "text-white/60"}`}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">Format</Text>
            <View className="flex-row gap-2 mb-4">
              {(["9:16", "16:9", "1:1"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  className={`flex-1 py-3 rounded-xl items-center ${format === f ? "bg-secondary" : "bg-white/5"}`}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFormat(f); }}
                  testID={`format-${f}`}
                >
                  <Text className={`font-sans-bold ${format === f ? "text-white" : "text-white/60"}`}>
                    {f === "9:16" ? "Vertical" : f === "16:9" ? "Horizontal" : "Carre"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Card className="mb-4 p-4">
              <TouchableOpacity
                className="flex-row items-center justify-between"
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSubtitles(!subtitles); }}
                testID="toggle-subtitles"
              >
                <View className="flex-row items-center">
                  <Ionicons name="text" size={20} color={THEME.primary} />
                  <Text className="text-white font-sans ml-3">Sous-titres automatiques</Text>
                </View>
                <View className={`w-10 h-6 rounded-full justify-center ${subtitles ? "bg-primary items-end" : "bg-white/10 items-start"}`}>
                  <View className="w-5 h-5 rounded-full bg-white mx-0.5" />
                </View>
              </TouchableOpacity>
            </Card>

            <Button onPress={goNext} testID="next-step" className="mt-2">Continuer</Button>
          </View>
        );

      case "review":
        return (
          <View>
            <Text className="text-white text-2xl font-sans-bold mb-2">Resume</Text>
            <Text className="text-white/40 font-sans mb-6">Verifie les parametres avant de lancer la generation.</Text>

            <Card className="mb-4 p-4">
              <View className="gap-3">
                <View className="flex-row justify-between">
                  <Text className="text-white/40 font-sans">Sujet</Text>
                  <Text className="text-white font-sans-medium flex-1 ml-4 text-right" numberOfLines={2}>{topic}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/40 font-sans">Niche</Text>
                  <Text className="text-white font-sans-medium">{getNicheLabel(niche)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/40 font-sans">Voix</Text>
                  <Text className="text-white font-sans-medium">
                    {VOICES.find((v) => v.id === voice)?.name}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/40 font-sans">Style</Text>
                  <Text className="text-white font-sans-medium">
                    {VIDEO_STYLES.find((s) => s.id === style)?.name}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/40 font-sans">Qualite</Text>
                  <Text className="text-white font-sans-medium">{quality}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/40 font-sans">Format</Text>
                  <Text className="text-white font-sans-medium">{format}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-white/40 font-sans">Sous-titres</Text>
                  <Text className="text-white font-sans-medium">{subtitles ? "Oui" : "Non"}</Text>
                </View>
              </View>
            </Card>

            <Button
              onPress={handleGenerate}
              loading={generating}
              testID="generate-video"
              icon={<Ionicons name="flash" size={18} color="#fff" />}
            >
              Generer la video
            </Button>
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="production-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={goBack} testID="production-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4 flex-1">Studio</Text>
        <Text className="text-white/40 font-sans text-sm">
          {currentStepIndex + 1}/{STEP_ORDER.length}
        </Text>
      </View>

      <ProgressBar progress={progress} className="mx-4 mb-4" color="bg-primary" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        {renderStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

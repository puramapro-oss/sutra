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
import { Card, Button, Input, Badge } from "../../components/ui";

interface BatchTopic {
  id: string;
  topic: string;
}

export default function BatchScreen() {
  const router = useRouter();
  const [topics, setTopics] = useState<BatchTopic[]>([
    { id: "1", topic: "" },
  ]);
  const [niche, setNiche] = useState<string>(NICHES[0]);
  const [voice, setVoice] = useState<string>(VOICES[0].id);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Array<{ topic: string; status: string; video_id?: string }> | null>(null);

  const addTopic = () => {
    if (topics.length >= 10) {
      Alert.alert("Limite atteinte", "Tu peux creer jusqu'a 10 videos en batch.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTopics((prev) => [...prev, { id: Date.now().toString(), topic: "" }]);
  };

  const removeTopic = (id: string) => {
    if (topics.length <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTopic = (id: string, value: string) => {
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, topic: value } : t)));
  };

  const handleGenerate = async () => {
    const validTopics = topics.filter((t) => t.topic.trim().length > 0);
    if (validTopics.length === 0) {
      Alert.alert("Erreur", "Ajoute au moins un sujet pour lancer le batch.");
      return;
    }

    setGenerating(true);
    try {
      const res = await apiFetch<{ results: Array<{ topic: string; status: string; video_id?: string }> }>("/api/batch", {
        method: "POST",
        body: {
          topics: validTopics.map((t) => t.topic.trim()),
          niche,
          voice,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResults(res.results);
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Erreur lors de la generation batch.");
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

  return (
    <SafeAreaView className="flex-1 bg-background" testID="batch-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="batch-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Creation batch</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        {results ? (
          /* Results View */
          <View>
            <Card className="mb-4 p-4 items-center">
              <Text className="text-3xl mb-2">🎬</Text>
              <Text className="text-white font-sans-bold text-lg mb-1">
                Batch lance !
              </Text>
              <Text className="text-white/60 font-sans text-sm text-center">
                {results.filter((r) => r.status === "queued").length} videos en file d'attente
              </Text>
            </Card>

            {results.map((result, i) => (
              <Card key={i} className="mb-2">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center mr-3">
                    <Text className="text-white/60 font-sans-bold text-sm">{i + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-sans-medium" numberOfLines={1}>{result.topic}</Text>
                  </View>
                  <Badge variant={result.status === "queued" ? "success" : "error"}>
                    {result.status === "queued" ? "En file" : "Erreur"}
                  </Badge>
                </View>
              </Card>
            ))}

            <Button
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/(tabs)/library");
              }}
              className="mt-4"
              testID="go-to-library"
            >
              Voir mes videos
            </Button>
            <Button
              variant="outline"
              onPress={() => {
                setResults(null);
                setTopics([{ id: "1", topic: "" }]);
              }}
              className="mt-2"
              testID="new-batch"
            >
              Nouveau batch
            </Button>
          </View>
        ) : (
          /* Form View */
          <View>
            <Card className="mb-4 p-4">
              <Text className="text-white font-sans-bold text-base mb-1">Generation multiple</Text>
              <Text className="text-white/40 font-sans text-sm">
                Cree jusqu'a 10 videos en une seule fois. Chaque sujet genere une video complete.
              </Text>
            </Card>

            {/* Topics */}
            <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
              Sujets ({topics.length}/10)
            </Text>
            {topics.map((topic, i) => (
              <View key={topic.id} className="flex-row items-center mb-2">
                <View className="flex-1">
                  <Input
                    placeholder={`Sujet ${i + 1}...`}
                    value={topic.topic}
                    onChangeText={(v) => updateTopic(topic.id, v)}
                    testID={`topic-input-${i}`}
                  />
                </View>
                {topics.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeTopic(topic.id)}
                    className="ml-2 p-2"
                    testID={`remove-topic-${i}`}
                  >
                    <Ionicons name="close-circle" size={22} color={THEME.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <Button
              variant="outline"
              size="sm"
              onPress={addTopic}
              icon={<Ionicons name="add" size={16} color="#fff" />}
              className="mb-6"
              testID="add-topic"
            >
              Ajouter un sujet
            </Button>

            {/* Niche */}
            <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
              Niche
            </Text>
            <Card className="mb-4 p-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {NICHES.map((n) => (
                    <TouchableOpacity
                      key={n}
                      className={`px-3 py-2 rounded-lg ${niche === n ? "bg-primary" : "bg-white/5"}`}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setNiche(n);
                      }}
                      testID={`batch-niche-${n}`}
                    >
                      <Text className={`font-sans text-sm ${niche === n ? "text-white" : "text-white/60"}`}>
                        {getNicheLabel(n)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Card>

            {/* Voice */}
            <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
              Voix
            </Text>
            <Card className="mb-6 p-4">
              <View className="flex-row flex-wrap gap-2">
                {VOICES.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    className={`px-3 py-2 rounded-lg ${voice === v.id ? "bg-secondary" : "bg-white/5"}`}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setVoice(v.id);
                    }}
                    testID={`batch-voice-${v.id}`}
                  >
                    <Text className={`font-sans text-sm ${voice === v.id ? "text-white" : "text-white/60"}`}>
                      {v.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            <Button
              onPress={handleGenerate}
              loading={generating}
              testID="launch-batch"
              icon={<Ionicons name="flash" size={18} color="#fff" />}
            >
              Lancer le batch ({topics.filter((t) => t.topic.trim()).length} videos)
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

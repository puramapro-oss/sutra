import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { Button, Input } from "../../components/ui";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!email.trim()) {
      setError("Entre ton email");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: "sutra://auth/reset-password" }
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch {
      setError("Erreur lors de l'envoi. Vérifie ton email.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center px-6">
        <View className="items-center">
          <Text className="text-5xl mb-4">📧</Text>
          <Text className="text-white text-2xl font-sans-bold text-center mb-3">
            Email envoyé !
          </Text>
          <Text className="text-white/50 text-center font-sans mb-8">
            Vérifie ta boîte mail pour réinitialiser ton mot de passe.
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            Retour à la connexion
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        className="px-6"
      >
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-primary font-sans">← Retour</Text>
        </TouchableOpacity>

        <Text className="text-white text-2xl font-sans-bold mb-2">
          Mot de passe oublié
        </Text>
        <Text className="text-white/50 font-sans mb-8">
          Entre ton email, on t'envoie un lien de réinitialisation.
        </Text>

        {error ? (
          <View className="bg-error/10 border border-error/20 rounded-xl p-3 mb-4">
            <Text className="text-error text-sm font-sans text-center">
              {error}
            </Text>
          </View>
        ) : null}

        <Input
          label="Email"
          placeholder="ton@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          testID="forgot-email"
        />

        <Button
          onPress={handleReset}
          loading={loading}
          size="lg"
          className="mt-4"
          testID="forgot-submit"
        >
          Envoyer le lien
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

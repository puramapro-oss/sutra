import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { Button, Input } from "../../components/ui";

export default function SignupScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError("Remplis tous les champs");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères");
      return;
    }
    setError("");
    try {
      await signUp(email.trim(), password, fullName.trim());
      router.replace("/(tabs)/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          className="px-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-10">
            <Text className="text-5xl mb-3">🎬</Text>
            <Text className="text-white text-3xl font-sans-bold">
              Rejoins SUTRA
            </Text>
            <Text className="text-white/50 text-base font-sans mt-1">
              Crée ton compte en 30 secondes
            </Text>
          </View>

          {error ? (
            <View className="bg-error/10 border border-error/20 rounded-xl p-3 mb-4">
              <Text className="text-error text-sm font-sans text-center">
                {error}
              </Text>
            </View>
          ) : null}

          <Input
            label="Nom complet"
            placeholder="Prénom Nom"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            testID="signup-name"
          />

          <Input
            label="Email"
            placeholder="ton@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            testID="signup-email"
          />

          <Input
            label="Mot de passe"
            placeholder="Min. 6 caractères"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            testID="signup-password"
          />

          <Button
            onPress={handleSignup}
            loading={isLoading}
            size="lg"
            className="mt-4 mb-6"
            testID="signup-submit"
          >
            Créer mon compte
          </Button>

          <Text className="text-white/30 text-xs text-center font-sans mb-6">
            En t'inscrivant, tu acceptes nos CGU et notre politique de
            confidentialité.
          </Text>

          <View className="flex-row justify-center">
            <Text className="text-white/50 font-sans">Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary font-sans-bold">Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

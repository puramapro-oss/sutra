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

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Remplis tous les champs");
      return;
    }
    setError("");
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur Google");
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
            <Text className="text-white text-3xl font-sans-bold">SUTRA</Text>
            <Text className="text-white/50 text-base font-sans mt-1">
              Crée des vidéos virales avec l'IA
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
            label="Email"
            placeholder="ton@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            testID="login-email"
          />

          <Input
            label="Mot de passe"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            rightIcon={
              <Text className="text-white/40 text-sm">
                {showPassword ? "Masquer" : "Voir"}
              </Text>
            }
            onRightIconPress={() => setShowPassword(!showPassword)}
            testID="login-password"
          />

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password")}
            className="self-end mb-6"
          >
            <Text className="text-primary text-sm font-sans">
              Mot de passe oublié ?
            </Text>
          </TouchableOpacity>

          <Button
            onPress={handleLogin}
            loading={isLoading}
            size="lg"
            className="mb-4"
            testID="login-submit"
          >
            Se connecter
          </Button>

          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-white/10" />
            <Text className="text-white/30 mx-4 font-sans">ou</Text>
            <View className="flex-1 h-px bg-white/10" />
          </View>

          <Button
            variant="outline"
            onPress={handleGoogleLogin}
            size="lg"
            className="mb-8"
            icon={<Text className="text-lg">🔵</Text>}
            testID="login-google"
          >
            Continuer avec Google
          </Button>

          <View className="flex-row justify-center">
            <Text className="text-white/50 font-sans">Pas de compte ? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
              <Text className="text-primary font-sans-bold">S'inscrire</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
import * as ImagePicker from "expo-image-picker";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { THEME } from "../../lib/constants";
import { Card, Button, Input, Avatar, Badge } from "../../components/ui";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [avatarUri, setAvatarUri] = useState(user?.avatar ?? "");
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission requise", "Autorise l'acces a ta galerie pour changer ta photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Erreur", "Le nom ne peut pas etre vide.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = { full_name: fullName.trim() };
      if (avatarUri && avatarUri !== user?.avatar) {
        body.avatar = avatarUri;
      }

      await apiFetch("/api/profile", {
        method: "PATCH",
        body,
      });

      updateUser({ full_name: fullName.trim(), avatar: avatarUri || user?.avatar || null });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Profil mis a jour", "Tes modifications ont ete enregistrees.");
      router.back();
    } catch (err) {
      Alert.alert("Erreur", err instanceof Error ? err.message : "Impossible de mettre a jour le profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" testID="profile-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="profile-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Mon profil</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {/* Avatar */}
        <View className="items-center mb-8 mt-4">
          <TouchableOpacity onPress={pickAvatar} testID="change-avatar">
            <Avatar
              uri={avatarUri || user?.avatar}
              name={fullName || user?.full_name}
              size="xl"
            />
            <View className="absolute bottom-0 right-0 bg-primary w-8 h-8 rounded-full items-center justify-center border-2 border-background">
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text className="text-white/40 font-sans text-sm mt-2">Touche pour changer</Text>
        </View>

        {/* Info Card */}
        <Card className="mb-6 p-4">
          <View className="flex-row items-center justify-between mb-2">
            <Badge variant="primary">{user?.plan ?? "free"}</Badge>
            <Badge variant="secondary">Niv. {user?.level ?? 1}</Badge>
          </View>
          <View className="flex-row items-center mt-2">
            <Ionicons name="mail" size={14} color={THEME.textSecondary} />
            <Text className="text-white/40 font-sans text-sm ml-2">{user?.email}</Text>
          </View>
          <View className="flex-row items-center mt-1">
            <Ionicons name="flame" size={14} color={THEME.warning} />
            <Text className="text-white/40 font-sans text-sm ml-2">
              Serie de {user?.streak ?? 0} jour(s)
            </Text>
          </View>
        </Card>

        {/* Edit Form */}
        <Input
          label="Nom complet"
          placeholder="Ton nom"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          testID="profile-name-input"
        />

        {/* Stats */}
        <Card className="mb-6 p-4">
          <Text className="text-white font-sans-bold text-base mb-3">Statistiques</Text>
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-white text-xl font-sans-bold">{user?.xp ?? 0}</Text>
              <Text className="text-white/40 font-sans text-xs">XP</Text>
            </View>
            <View className="w-px bg-white/10" />
            <View className="items-center flex-1">
              <Text className="text-primary-light text-xl font-sans-bold">{user?.purama_points ?? 0}</Text>
              <Text className="text-white/40 font-sans text-xs">Points</Text>
            </View>
            <View className="w-px bg-white/10" />
            <View className="items-center flex-1">
              <Text className="text-success text-xl font-sans-bold">{user?.credits ?? 0}</Text>
              <Text className="text-white/40 font-sans text-xs">Credits</Text>
            </View>
          </View>
        </Card>

        <Button
          onPress={handleSave}
          loading={saving}
          testID="save-profile"
        >
          Enregistrer
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

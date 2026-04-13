import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { THEME } from "../../lib/constants";
import { Card, Button, Modal } from "../../components/ui";

interface NotifPrefs {
  achievements: boolean;
  referral: boolean;
  wallet: boolean;
  contest: boolean;
  lottery: boolean;
  video: boolean;
  marketing: boolean;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuthStore();
  const [darkMode, setDarkMode] = useState(true);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    achievements: true,
    referral: true,
    wallet: true,
    contest: true,
    lottery: true,
    video: true,
    marketing: false,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user?.metadata) {
      const prefs = user.metadata as Record<string, unknown>;
      if (prefs.notification_prefs) {
        setNotifPrefs(prefs.notification_prefs as NotifPrefs);
      }
      if (typeof prefs.dark_mode === "boolean") {
        setDarkMode(prefs.dark_mode);
      }
    }
  }, [user]);

  const toggleNotif = async (key: keyof NotifPrefs) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: { metadata: { notification_prefs: updated } },
      });
    } catch (_) {
      setNotifPrefs(notifPrefs);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Deconnexion", "Es-tu sur de vouloir te deconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se deconnecter",
        style: "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await supabase.auth.signOut();
          logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      await apiFetch("/api/profile", {
        method: "POST",
        body: { action: "export" },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Export demande", "Tu recevras un email avec tes donnees sous 24h.");
    } catch (err) {
      Alert.alert("Erreur", "Impossible d'exporter tes donnees.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await apiFetch("/api/profile", {
        method: "DELETE",
      });
      await supabase.auth.signOut();
      logout();
      router.replace("/(auth)/login");
    } catch (err) {
      Alert.alert("Erreur", "Impossible de supprimer ton compte. Contacte le support.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const settingRow = (
    icon: string,
    label: string,
    value: boolean,
    onToggle: () => void,
    testId: string
  ) => (
    <View className="flex-row items-center py-3 border-b border-white/[0.06]">
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={THEME.primary} />
      <Text className="text-white font-sans flex-1 ml-3">{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "rgba(255,255,255,0.1)", true: THEME.primary }}
        thumbColor="#fff"
        testID={testId}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" testID="settings-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="settings-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4">Reglages</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        {/* Appearance */}
        <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2 mt-4">
          Apparence
        </Text>
        <Card className="mb-6">
          {settingRow("moon", "Mode sombre", darkMode, () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setDarkMode(!darkMode);
          }, "toggle-dark-mode")}
        </Card>

        {/* Notifications */}
        <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
          Notifications
        </Text>
        <Card className="mb-6">
          {settingRow("trophy", "Succes", notifPrefs.achievements, () => toggleNotif("achievements"), "toggle-notif-achievements")}
          {settingRow("people", "Parrainages", notifPrefs.referral, () => toggleNotif("referral"), "toggle-notif-referral")}
          {settingRow("wallet", "Portefeuille", notifPrefs.wallet, () => toggleNotif("wallet"), "toggle-notif-wallet")}
          {settingRow("medal", "Concours", notifPrefs.contest, () => toggleNotif("contest"), "toggle-notif-contest")}
          {settingRow("ticket", "Loterie", notifPrefs.lottery, () => toggleNotif("lottery"), "toggle-notif-lottery")}
          {settingRow("videocam", "Videos", notifPrefs.video, () => toggleNotif("video"), "toggle-notif-video")}
          {settingRow("megaphone", "Marketing", notifPrefs.marketing, () => toggleNotif("marketing"), "toggle-notif-marketing")}
        </Card>

        {/* Account */}
        <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
          Compte
        </Text>
        <Card className="mb-6">
          <TouchableOpacity
            className="flex-row items-center py-3 border-b border-white/[0.06]"
            onPress={() => router.push("/profile")}
            testID="go-to-profile"
          >
            <Ionicons name="person" size={20} color={THEME.primary} />
            <Text className="text-white font-sans flex-1 ml-3">Modifier le profil</Text>
            <Ionicons name="chevron-forward" size={16} color={THEME.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center py-3 border-b border-white/[0.06]"
            onPress={handleExportData}
            disabled={exporting}
            testID="export-data"
          >
            <Ionicons name="download" size={20} color={THEME.primary} />
            <Text className="text-white font-sans flex-1 ml-3">
              {exporting ? "Export en cours..." : "Exporter mes donnees"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={THEME.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center py-3"
            onPress={() => setShowDeleteModal(true)}
            testID="delete-account"
          >
            <Ionicons name="trash" size={20} color={THEME.error} />
            <Text className="text-error font-sans flex-1 ml-3">Supprimer mon compte</Text>
            <Ionicons name="chevron-forward" size={16} color={THEME.error} />
          </TouchableOpacity>
        </Card>

        {/* Legal */}
        <Text className="text-white/40 font-sans-medium text-xs uppercase tracking-wider mb-2">
          Informations
        </Text>
        <Card className="mb-6">
          <View className="flex-row items-center py-3 border-b border-white/[0.06]">
            <Ionicons name="information-circle" size={20} color={THEME.textSecondary} />
            <Text className="text-white/60 font-sans flex-1 ml-3">Version</Text>
            <Text className="text-white/40 font-sans">1.0.0</Text>
          </View>
          <View className="flex-row items-center py-3">
            <Ionicons name="document-text" size={20} color={THEME.textSecondary} />
            <Text className="text-white/60 font-sans flex-1 ml-3">SASU PURAMA - art. 293B</Text>
          </View>
        </Card>

        {/* Sign Out */}
        <Button
          variant="outline"
          onPress={handleSignOut}
          testID="sign-out"
          className="mb-4"
          icon={<Ionicons name="log-out-outline" size={18} color="#fff" />}
        >
          Se deconnecter
        </Button>
      </ScrollView>

      <Modal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Supprimer ton compte"
      >
        <Text className="text-white/60 font-sans mb-4">
          Cette action est irreversible. Toutes tes donnees seront supprimees definitivement
          (videos, points, portefeuille, parrainages).
        </Text>
        <Button
          variant="danger"
          onPress={handleDeleteAccount}
          loading={deleting}
          testID="confirm-delete-account"
          className="mb-2"
        >
          Supprimer definitivement
        </Button>
        <Button
          variant="ghost"
          onPress={() => setShowDeleteModal(false)}
        >
          Annuler
        </Button>
      </Modal>
    </SafeAreaView>
  );
}

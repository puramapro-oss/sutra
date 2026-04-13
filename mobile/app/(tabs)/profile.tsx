import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { Avatar, Card, Badge, ProgressBar } from "../../components/ui";
import { formatPoints, formatPrice } from "../../lib/utils";
import { REFERRAL_TIERS } from "../../lib/constants";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Tu veux vraiment te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnexion", style: "destructive", onPress: signOut },
    ]);
  };

  const currentTier = REFERRAL_TIERS.findLast(
    (t) => (user?.level || 0) >= t.min
  );

  const menuItems = [
    { emoji: "👤", label: "Modifier le profil", route: "/profile" },
    { emoji: "💰", label: "Wallet", route: "/wallet", badge: formatPrice(user?.wallet_balance || 0) },
    { emoji: "💜", label: "Points Purama", route: "/boutique", badge: formatPoints(user?.purama_points || 0) },
    { emoji: "👥", label: "Parrainage", route: "/referral" },
    { emoji: "🏆", label: "Concours", route: "/contest" },
    { emoji: "🎰", label: "Tirage mensuel", route: "/lottery" },
    { emoji: "🏅", label: "Succès", route: "/achievements" },
    { emoji: "📊", label: "Analytics", route: "/analytics" },
    { emoji: "🤝", label: "Partenaire", route: "/partenaire" },
    { emoji: "🔔", label: "Notifications", route: "/notifications" },
    { emoji: "⚙️", label: "Paramètres", route: "/settings" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4">
        {/* Profile Header */}
        <View className="items-center py-6">
          <Avatar uri={user?.avatar} name={user?.full_name} size="xl" />
          <Text className="text-white text-xl font-sans-bold mt-3">
            {user?.full_name || "Réalisateur"}
          </Text>
          <Text className="text-white/50 font-sans">{user?.email}</Text>
          <View className="flex-row gap-2 mt-3">
            <Badge variant="primary">{user?.plan?.toUpperCase() || "FREE"}</Badge>
            {currentTier && (
              <Badge variant="warning">{currentTier.name}</Badge>
            )}
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3 mb-4">
          <Card className="flex-1 items-center">
            <Text className="text-white text-xl font-sans-bold">
              {user?.level || 0}
            </Text>
            <Text className="text-white/40 text-xs font-sans">Niveau</Text>
          </Card>
          <Card className="flex-1 items-center">
            <Text className="text-white text-xl font-sans-bold">
              {user?.streak || 0}
            </Text>
            <Text className="text-white/40 text-xs font-sans">Streak</Text>
          </Card>
          <Card className="flex-1 items-center">
            <Text className="text-white text-xl font-sans-bold">
              {user?.xp || 0}
            </Text>
            <Text className="text-white/40 text-xs font-sans">XP</Text>
          </Card>
        </View>

        {/* XP Progress */}
        <Card className="mb-4">
          <ProgressBar
            progress={((user?.xp || 0) % 1000) / 10}
            label={`Niveau ${user?.level || 0}`}
            showPercentage
            color="bg-primary"
          />
          <Text className="text-white/30 text-xs font-sans mt-2">
            {1000 - ((user?.xp || 0) % 1000)} XP pour le prochain niveau
          </Text>
        </Card>

        {/* Menu */}
        <View className="gap-1 mb-4">
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.route}
              className="flex-row items-center py-3.5 px-2 border-b border-white/[0.04]"
              onPress={() => router.push(item.route as any)}
            >
              <Text className="text-lg mr-3">{item.emoji}</Text>
              <Text className="text-white font-sans flex-1">{item.label}</Text>
              {item.badge && (
                <Text className="text-white/40 text-sm font-sans mr-2">
                  {item.badge}
                </Text>
              )}
              <Text className="text-white/20">›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          className="py-4 items-center mb-8"
          onPress={handleLogout}
          testID="logout-button"
        >
          <Text className="text-error font-sans-bold">Se déconnecter</Text>
        </TouchableOpacity>

        <Text className="text-white/20 text-xs text-center font-sans mb-4">
          SUTRA v1.0.0 — SASU PURAMA
        </Text>
        <View className="h-4" />
      </ScrollView>
    </SafeAreaView>
  );
}

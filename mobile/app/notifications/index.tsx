import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiFetch } from "../../lib/api";
import { useNotificationStore } from "../../lib/store";
import { THEME } from "../../lib/constants";
import { formatRelativeDate } from "../../lib/utils";
import { Card, Skeleton, EmptyState, Button } from "../../components/ui";
import type { Notification } from "../../types/database";

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, setNotifications, markAsRead, markAllRead } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch<{ notifications: Notification[] }>("/api/notifications");
      setNotifications(res.notifications);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de charger les notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRead = async (id: string) => {
    markAsRead(id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        body: { action: "read", id },
      });
    } catch (_) {
      // silent fail, local state already updated
    }
  };

  const handleMarkAllRead = async () => {
    markAllRead();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        body: { action: "read_all" },
      });
    } catch (_) {
      // silent fail
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "achievement": return "trophy";
      case "referral": return "people";
      case "wallet": return "wallet";
      case "contest": return "medal";
      case "lottery": return "ticket";
      case "video": return "videocam";
      case "system": return "information-circle";
      default: return "notifications";
    }
  };

  const getNotifColor = (type: string) => {
    switch (type) {
      case "achievement": return THEME.warning;
      case "referral": return THEME.success;
      case "wallet": return THEME.primary;
      case "contest": return THEME.warning;
      case "lottery": return THEME.secondary;
      case "video": return THEME.primary;
      default: return THEME.textSecondary;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SafeAreaView className="flex-1 bg-background" testID="notifications-screen">
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} testID="notifications-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-sans-bold ml-4 flex-1">Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            testID="mark-all-read"
          >
            <Text className="text-primary-light font-sans-medium text-sm">Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View className="px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={72} className="rounded-2xl mb-2" />
          ))}
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleRead(item.id)}
              testID={`notification-${item.id}`}
            >
              <Card className={`mb-2 ${!item.read ? "border-l-2 border-l-primary" : ""}`}>
                <View className="flex-row items-start">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: `${getNotifColor(item.type)}20` }}
                  >
                    <Ionicons
                      name={getNotifIcon(item.type)}
                      size={18}
                      color={getNotifColor(item.type)}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-sans-medium text-base ${item.read ? "text-white/60" : "text-white"}`}>
                      {item.title}
                    </Text>
                    <Text className="text-white/40 font-sans text-sm mt-0.5">{item.body}</Text>
                    <Text className="text-white/30 font-sans text-xs mt-1">
                      {formatRelativeDate(item.created_at)}
                    </Text>
                  </View>
                  {!item.read && <View className="w-2.5 h-2.5 rounded-full bg-primary mt-1" />}
                </View>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="🔔"
              title="Aucune notification"
              description="Tu recevras tes notifications ici."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

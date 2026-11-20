import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { apiFetch } from "../lib/api";
import { useAuthStore } from "../lib/store";
import { useNotificationStore } from "../lib/store";
import { normalizeProjectId } from "../lib/eas-project";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { notifications, unreadCount, setNotifications, markAsRead, markAllRead } =
    useNotificationStore();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);

  useEffect(() => {
    if (!user) return;

    let active = true;
    registerForPushNotifications().then((token) => {
      if (active && token) {
        setExpoPushToken(token);
        apiFetch("/api/notifications", {
          method: "POST",
          body: { action: "register_token", token, platform: Platform.OS },
        }).catch(() => {});
      }
    }).catch(() => {
      // Inbox access remains available when the platform push service is offline.
    });

    fetchNotifications();

    notificationListener.current =
      Notifications.addNotificationReceivedListener((_notification) => {
        fetchNotifications();
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.route) {
          router.push(data.route as string);
        }
      });

    return () => {
      active = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const data = await apiFetch<{ notifications: typeof notifications }>(
        "/api/notifications"
      );
      setNotifications(data.notifications);
    } catch {
      // silently fail
    }
  };

  return {
    notifications,
    unreadCount,
    expoPushToken,
    markAsRead,
    markAllRead,
    refresh: fetchNotifications,
  };
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice || Platform.OS === "web") return null;
  const projectId = normalizeProjectId(
    Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId
  );
  if (!projectId) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "SUTRA",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8B5CF6",
    });
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

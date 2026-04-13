import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useNotificationStore } from "../../lib/store";

function TabIcon({ name, emoji, focused }: { name: string; emoji: string; focused: boolean }) {
  return (
    <View className="items-center justify-center pt-2">
      <Text className={`text-xl ${focused ? "" : "opacity-50"}`}>{emoji}</Text>
      <Text
        className={`text-[10px] mt-0.5 font-sans ${
          focused ? "text-primary" : "text-white/40"
        }`}
      >
        {name}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { unreadCount } = useNotificationStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0A0F",
          borderTopColor: "rgba(255,255,255,0.06)",
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 20,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#8B5CF6",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Accueil" emoji="🏠" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Créer" emoji="🎬" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Vidéos" emoji="📚" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Communauté" emoji="💜" focused={focused} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#8B5CF6",
            fontSize: 10,
            minWidth: 18,
            height: 18,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="Profil" emoji="👤" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

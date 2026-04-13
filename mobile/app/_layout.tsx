import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuth, useProtectedRoute } from "../hooks/useAuth";
import ErrorBoundary from "../components/shared/ErrorBoundary";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isLoading } = useAuth();

  useProtectedRoute();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0A0A0F" },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="create/index"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen name="wallet/index" />
          <Stack.Screen name="referral/index" />
          <Stack.Screen name="boutique/index" />
          <Stack.Screen name="achievements/index" />
          <Stack.Screen name="lottery/index" />
          <Stack.Screen name="contest/index" />
          <Stack.Screen name="community/index" />
          <Stack.Screen name="notifications/index" />
          <Stack.Screen name="classement/index" />
          <Stack.Screen name="partenaire/index" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="profile/index" />
          <Stack.Screen name="library/index" />
          <Stack.Screen name="templates/index" />
          <Stack.Screen name="storyboard/index" />
          <Stack.Screen name="analytics/index" />
          <Stack.Screen name="autopilot/index" />
          <Stack.Screen name="batch/index" />
          <Stack.Screen name="publish/index" />
          <Stack.Screen name="voices/index" />
          <Stack.Screen name="styles/index" />
          <Stack.Screen name="editor/index" />
          <Stack.Screen name="production/index" />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

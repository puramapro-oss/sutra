import { useEffect, useCallback } from "react";
import { useRouter, useSegments } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import type { Profile } from "../types/database";

export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, setLoading, updateUser, logout } =
    useAuthStore();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      setUser(null);
      return null;
    }
    setUser(data as Profile);
    return data as Profile;
  }, [setUser]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        await fetchProfile(session.user.id);
      } else if (mounted) {
        setUser(null);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user && mounted) {
          await fetchProfile(session.user.id);
        } else if (mounted) {
          setUser(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, setUser]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      throw new Error(error.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect"
        : "Erreur de connexion. Réessaie.");
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      setLoading(false);
      throw new Error(
        error.message.includes("already registered")
          ? "Cet email est déjà utilisé"
          : "Erreur lors de l'inscription. Réessaie."
      );
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    logout();
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "sutra://auth/callback",
      },
    });
    if (error) throw new Error("Erreur de connexion Google");
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    updateUser,
    refreshProfile: user ? () => fetchProfile(user.id) : () => Promise.resolve(null),
  };
}

export function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)/dashboard");
    }
  }, [isAuthenticated, segments, isLoading, router]);
}

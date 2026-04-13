"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getAwakeningLevel } from "@/lib/awakening";

interface AwakeningState {
  xp: number;
  level: number;
  levelName: string;
  streak: number;
  loading: boolean;
}

export function useAwakening(userId?: string) {
  const [state, setState] = useState<AwakeningState>({
    xp: 0,
    level: 1,
    levelName: "Eveille",
    streak: 0,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    const fetchData = async () => {
      const supabase = createClient();

      // Get total XP
      const { data: events } = await supabase
        .from("awakening_events")
        .select("xp_gained")
        .eq("user_id", userId);

      const totalXp = (events || []).reduce(
        (sum, e) => sum + (e.xp_gained || 0),
        0
      );

      // Get profile streak
      const { data: profile } = await supabase
        .from("profiles")
        .select("streak")
        .eq("id", userId)
        .single();

      const { level, name } = getAwakeningLevel(totalXp);

      setState({
        xp: totalXp,
        level,
        levelName: name,
        streak: profile?.streak || 0,
        loading: false,
      });
    };

    fetchData();
  }, [userId]);

  const addXp = useCallback(
    async (eventType: string, xpGained: number) => {
      if (!userId) return;
      const supabase = createClient();
      await supabase.from("awakening_events").insert({
        user_id: userId,
        event_type: eventType,
        xp_gained: xpGained,
      });

      setState((prev) => {
        const newXp = prev.xp + xpGained;
        const { level, name } = getAwakeningLevel(newXp);
        return { ...prev, xp: newXp, level, levelName: name };
      });
    },
    [userId]
  );

  return { ...state, addXp };
}

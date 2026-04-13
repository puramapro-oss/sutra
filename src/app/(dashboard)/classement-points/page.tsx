"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Medal,
  Crown,
  TrendingUp,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface RankedUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  purama_points: number;
  level: number;
  streak: number;
}

const RANK_STYLES = [
  {
    bg: "bg-gradient-to-r from-amber-500/20 to-yellow-500/20",
    border: "border-amber-500/30",
    icon: Crown,
    iconColor: "text-amber-400",
    textColor: "text-amber-400",
  },
  {
    bg: "bg-gradient-to-r from-slate-300/10 to-slate-400/10",
    border: "border-slate-400/20",
    icon: Medal,
    iconColor: "text-slate-300",
    textColor: "text-slate-300",
  },
  {
    bg: "bg-gradient-to-r from-orange-600/10 to-orange-500/10",
    border: "border-orange-500/20",
    icon: Medal,
    iconColor: "text-orange-400",
    textColor: "text-orange-400",
  },
];

function formatPoints(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function ClassementPointsPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<RankedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const supabase = createClient();

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, purama_points, level, streak")
        .gt("purama_points", 0)
        .order("purama_points", { ascending: false })
        .limit(50);

      const ranked = data || [];
      setUsers(ranked);

      if (profile?.id) {
        const idx = ranked.findIndex((u) => u.id === profile.id);
        setUserRank(idx >= 0 ? idx + 1 : null);
      }

      setLoading(false);
    };

    fetchLeaderboard();
  }, [profile?.id]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-white mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Classement Points
        </h1>
        <p className="text-white/50 text-sm">
          Top 50 des createurs SUTRA par Purama Points.
        </p>
      </div>

      {/* User's rank card */}
      {profile && userRank && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-violet-500/[0.06] backdrop-blur-xl border border-violet-500/20 rounded-2xl p-5 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Ta position</p>
                <p className="text-xs text-white/40">
                  {formatPoints(profile.purama_points || 0)} points
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-violet-400">
                #{userRank}
              </p>
              <p className="text-xs text-white/30">sur {users.length}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-white/40 text-sm">Chargement du classement...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-white/20" />
          </div>
          <h3 className="text-lg font-semibold text-white/60 mb-2">
            Aucun classement
          </h3>
          <p className="text-sm text-white/30">
            Le classement se remplira au fur et a mesure que les createurs
            gagnent des points.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user, i) => {
            const rank = i + 1;
            const isCurrentUser = user.id === profile?.id;
            const style = i < 3 ? RANK_STYLES[i] : null;
            const RankIcon = style?.icon || TrendingUp;

            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all",
                  isCurrentUser
                    ? "bg-violet-500/[0.08] border-violet-500/30"
                    : style
                      ? `${style.bg} ${style.border}`
                      : "bg-white/[0.03] border-white/[0.06]"
                )}
              >
                {/* Rank */}
                <div className="w-8 flex-shrink-0 text-center">
                  {i < 3 ? (
                    <RankIcon
                      className={cn("w-6 h-6 mx-auto", style?.iconColor)}
                    />
                  ) : (
                    <span className="text-sm font-bold text-white/40">
                      {rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-white/50">
                      {(user.full_name || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium truncate",
                      isCurrentUser ? "text-violet-300" : "text-white/80"
                    )}
                  >
                    {user.full_name || "Createur anonyme"}
                    {isCurrentUser && (
                      <span className="text-violet-400 ml-1">(toi)</span>
                    )}
                  </p>
                  <p className="text-xs text-white/30">
                    Niveau {user.level || 1}
                    {user.streak > 0 && ` · ${user.streak}j streak`}
                  </p>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <p
                    className={cn(
                      "text-sm font-bold",
                      i < 3 ? style?.textColor : "text-white/70"
                    )}
                  >
                    {formatPoints(user.purama_points)}
                  </p>
                  <p className="text-[10px] text-white/20">pts</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

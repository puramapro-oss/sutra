"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Zap, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const TRIGGERS = {
  credits_low: {
    title: "Tu as utilise tes credits gratuits",
    description:
      "Passe a Starter pour 10 videos/mois et debloquer les gains en euros.",
    icon: Zap,
    cta: "Voir les plans",
    href: "/pricing",
  },
  third_login: {
    title: "Tu reviens souvent — bonne nouvelle",
    description:
      "Avec un abonnement, chaque visite te rapporte des points et des euros. Tes gains potentiels t'attendent.",
    icon: TrendingUp,
    cta: "Debloquer mes gains",
    href: "/pricing",
  },
  pending_earnings: {
    title: "Tu as des euros en attente",
    description:
      "Tes points et parrainages valent de l'argent reel. Passe a Starter pour les debloquer.",
    icon: Sparkles,
    cta: "Recuperer mes gains",
    href: "/pricing",
  },
};

type TriggerKey = keyof typeof TRIGGERS;

function getStorageKey(trigger: string): string {
  return `sutra_popup_${trigger}`;
}

function canShow(trigger: string): boolean {
  const key = getStorageKey(trigger);
  const last = localStorage.getItem(key);
  if (!last) return true;
  // Max 1 popup per 7 days per trigger
  const elapsed = Date.now() - parseInt(last, 10);
  return elapsed > 7 * 24 * 60 * 60 * 1000;
}

function markShown(trigger: string): void {
  localStorage.setItem(getStorageKey(trigger), Date.now().toString());
}

export default function ConversionPopup() {
  const { profile, loading } = useAuth();
  const [activeTrigger, setActiveTrigger] = useState<TriggerKey | null>(null);

  useEffect(() => {
    if (loading || !profile) return;

    // Never show to paying users or first-time visitors
    if (profile.plan !== "free") return;

    // Check login count
    const loginKey = "sutra_login_count";
    const loginCount = parseInt(localStorage.getItem(loginKey) || "0", 10) + 1;
    localStorage.setItem(loginKey, loginCount.toString());

    // Never on first visit
    if (loginCount <= 1) return;

    // Never more than 1 popup per session
    if (sessionStorage.getItem("sutra_popup_shown")) return;

    // Determine trigger
    let trigger: TriggerKey | null = null;

    // Credits low (used most of daily questions)
    if (
      profile.daily_questions !== undefined &&
      profile.daily_questions >= 2 &&
      canShow("credits_low")
    ) {
      trigger = "credits_low";
    }
    // Third login
    else if (loginCount >= 3 && canShow("third_login")) {
      trigger = "third_login";
    }
    // Has pending points (gratuit but has points)
    else if (
      profile.purama_points > 500 &&
      canShow("pending_earnings")
    ) {
      trigger = "pending_earnings";
    }

    if (trigger) {
      // Delay for smooth UX
      const timer = setTimeout(() => {
        setActiveTrigger(trigger);
        sessionStorage.setItem("sutra_popup_shown", "1");
        markShown(trigger);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [profile, loading]);

  if (!activeTrigger) return null;

  const config = TRIGGERS[activeTrigger];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setActiveTrigger(null)}
        />

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative max-w-sm w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-7 text-center shadow-[0_20px_60px_rgba(139,92,246,0.15)]"
        >
          <button
            onClick={() => setActiveTrigger(null)}
            className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring" }}
            className="w-14 h-14 mx-auto mb-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center"
          >
            <Icon className="w-7 h-7 text-violet-400" />
          </motion.div>

          <h3
            className="text-lg font-bold text-white mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {config.title}
          </h3>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            {config.description}
          </p>

          <div className="space-y-2">
            <Link
              href={config.href}
              onClick={() => setActiveTrigger(null)}
              className="block w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(139,92,246,0.3)] text-sm"
            >
              {config.cta}
            </Link>
            <Link
              href="/financer"
              onClick={() => setActiveTrigger(null)}
              className="block w-full py-2.5 text-sm text-green-400 hover:text-green-300 transition-colors"
            >
              Faire rembourser mon abo a 100%
            </Link>
            <button
              onClick={() => setActiveTrigger(null)}
              className="text-xs text-white/20 hover:text-white/40 transition-colors"
            >
              Plus tard
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

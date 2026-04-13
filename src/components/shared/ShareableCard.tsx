"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Share2,
  Copy,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareableCardProps {
  type: "streak" | "achievement" | "milestone" | "gains" | "classement";
  title: string;
  subtitle: string;
  value: string;
  userName?: string;
  referralCode?: string;
  onClose: () => void;
}

const PLATFORMS = [
  {
    name: "WhatsApp",
    icon: "📱",
    getUrl: (text: string, url: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    name: "Twitter",
    icon: "𝕏",
    getUrl: (text: string, url: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: "Telegram",
    icon: "✈️",
    getUrl: (text: string, url: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    name: "LinkedIn",
    icon: "💼",
    getUrl: (_text: string, url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Facebook",
    icon: "📘",
    getUrl: (_text: string, url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: "Email",
    icon: "📧",
    getUrl: (text: string, url: string) =>
      `mailto:?subject=${encodeURIComponent("Decouvre SUTRA")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
];

const TYPE_COLORS: Record<string, { from: string; to: string; glow: string }> = {
  streak: { from: "from-orange-500", to: "to-red-500", glow: "shadow-orange-500/30" },
  achievement: { from: "from-amber-400", to: "to-yellow-500", glow: "shadow-amber-500/30" },
  milestone: { from: "from-violet-500", to: "to-purple-600", glow: "shadow-violet-500/30" },
  gains: { from: "from-green-400", to: "to-emerald-500", glow: "shadow-green-500/30" },
  classement: { from: "from-blue-400", to: "to-cyan-500", glow: "shadow-blue-500/30" },
};

const TYPE_EMOJIS: Record<string, string> = {
  streak: "🔥",
  achievement: "🏆",
  milestone: "🎯",
  gains: "💰",
  classement: "👑",
};

export default function ShareableCard({
  type,
  title,
  subtitle,
  value,
  userName,
  referralCode,
  onClose,
}: ShareableCardProps) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const shareUrl = referralCode
    ? `https://sutra.purama.dev/go/${referralCode}`
    : "https://sutra.purama.dev";

  const shareText = `${TYPE_EMOJIS[type] || "🎬"} ${title} : ${value} sur SUTRA ! ${subtitle}`;

  const colors = TYPE_COLORS[type] || TYPE_COLORS.milestone;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SUTRA — ${title}`,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative max-w-sm w-full space-y-4"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Story Card Preview (1080x1920 ratio = 9:16) */}
          <div
            ref={cardRef}
            className={cn(
              "relative aspect-[9/16] max-h-[480px] rounded-3xl overflow-hidden bg-gradient-to-br",
              colors.from,
              colors.to,
              "shadow-2xl",
              colors.glow
            )}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
            </div>

            {/* Content */}
            <div className="relative flex flex-col items-center justify-center h-full p-8 text-center">
              <span className="text-5xl mb-4">
                {TYPE_EMOJIS[type] || "🎬"}
              </span>
              <p className="text-white/80 text-sm font-medium uppercase tracking-widest mb-2">
                {subtitle}
              </p>
              <h2 className="text-3xl font-bold text-white mb-2 leading-tight">
                {title}
              </h2>
              <p className="text-4xl font-black text-white drop-shadow-lg">
                {value}
              </p>
              {userName && (
                <p className="text-white/60 text-sm mt-4">par {userName}</p>
              )}

              {/* SUTRA branding */}
              <div className="absolute bottom-8 left-0 right-0 text-center">
                <p
                  className="text-white/40 text-xs font-bold tracking-[0.3em] uppercase"
                  style={{ fontFamily: "var(--font-orbitron)" }}
                >
                  SUTRA
                </p>
                <p className="text-white/30 text-[10px] mt-1">
                  sutra.purama.dev
                  {referralCode ? `/go/${referralCode}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Share buttons */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-white/40 mb-3 text-center">
              Partager sur
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PLATFORMS.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.getUrl(shareText, shareUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
                >
                  <span className="text-lg">{platform.icon}</span>
                  <span className="text-[10px] text-white/40">
                    {platform.name}
                  </span>
                </a>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copie</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copier
                  </>
                )}
              </button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button
                  onClick={handleNativeShare}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-sm text-white font-medium hover:bg-violet-500 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Partager
                </button>
              )}
            </div>

            <p className="text-center text-[10px] text-white/20 mt-2">
              +300 points par partage (max 3/jour)
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  TrendingUp,
  Gift,
  Users,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TIERS = [
  { name: "Bronze", min: 10, bonus: "50 EUR + Starter GRATUIT a vie" },
  { name: "Argent", min: 25, bonus: "150 EUR + Pro + acces anticipe" },
  { name: "Or", min: 50, bonus: "400 EUR + Unlimited + page perso" },
  { name: "Platine", min: 100, bonus: "1 000 EUR + Enterprise" },
  { name: "Diamant", min: 250, bonus: "3 000 EUR + VIP" },
  { name: "Legende", min: 500, bonus: "6 500 EUR + commissions hereditaires" },
];

export default function DevenirInfluenceurPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [motivation, setMotivation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    setLoading(true);
    try {
      const res = await fetch("/api/partner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          social_links: { instagram, youtube, tiktok },
          motivation,
          canal: "influencer",
        }),
      });
      if (res.ok) {
        setSuccess(true);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-[#06050e] text-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Bienvenue dans la team</h2>
          <p className="text-white/50 text-sm mb-6">
            Ta candidature est acceptee. Tu vas recevoir un email avec ton lien
            personnalise et ton kit createur.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-all"
          >
            Creer mon compte SUTRA
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06050e] text-white overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-violet-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-[-100px] left-[-50px] w-[400px] h-[400px] rounded-full bg-fuchsia-500/[0.04] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06050e]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-4"
          >
            <Sparkles className="w-4 h-4" />
            Programme Influenceur SUTRA
          </motion.div>
          <h1
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Gagne de l&apos;argent en partageant{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            50% du premier paiement + 10% a vie sur chaque filleul. Pas de
            minimum. Pas de limite.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-12">
          {[
            { icon: TrendingUp, label: "Commission 1er paiement", value: "50%" },
            { icon: Gift, label: "Recurrent a vie", value: "10%" },
            { icon: Users, label: "Niveaux de parrainage", value: "3" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center"
            >
              <stat.icon className="w-6 h-6 text-violet-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-white/40">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tiers */}
        <div className="mb-12">
          <h2 className="text-lg font-bold mb-4">Paliers de gains</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TIERS.map((tier, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3"
              >
                <p className="text-sm font-semibold text-violet-400">
                  {tier.name}
                </p>
                <p className="text-xs text-white/30">{tier.min}+ filleuls</p>
                <p className="text-xs text-white/60 mt-1">{tier.bonus}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-1">Rejoins le programme</h2>
          <p className="text-sm text-white/40 mb-6">
            Inscription automatique. Tu recois ton lien en 2 minutes.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Nom / Pseudo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Instagram", value: instagram, set: setInstagram },
                { label: "YouTube", value: youtube, set: setYoutube },
                { label: "TikTok", value: tiktok, set: setTiktok },
              ].map((s) => (
                <div key={s.label}>
                  <label className="block text-xs text-white/50 mb-1.5">
                    {s.label}
                  </label>
                  <input
                    type="text"
                    value={s.value}
                    onChange={(e) => s.set(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 outline-none transition-colors"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1.5">
                Pourquoi tu veux promouvoir SUTRA ?
              </label>
              <textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 outline-none transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !name || !email}
              className={cn(
                "w-full h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Devenir influenceur SUTRA
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

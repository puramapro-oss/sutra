"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { getRandomQuote } from "@/lib/awakening";
import type { Affirmation } from "@/lib/awakening";

export default function SpiritualLayer() {
  const [affirmation, setAffirmation] = useState<Affirmation | null>(null);
  const [showAffirmation, setShowAffirmation] = useState(false);
  const [quote, setQuote] = useState(getRandomQuote());
  const [integrated, setIntegrated] = useState(false);

  // Rotate quote every 30 min
  useEffect(() => {
    const interval = setInterval(() => {
      setQuote(getRandomQuote());
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Show affirmation on first login of the day
  useEffect(() => {
    const key = "sutra_affirmation_shown";
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem(key);

    if (lastShown === today) return;

    const fetchAffirmation = async () => {
      const supabase = createClient();
      // SUTRA = video creation, so abundance + power are most relevant
      const categories = ["abundance", "power", "wisdom"];
      const cat = categories[Math.floor(Math.random() * categories.length)];

      const { data } = await supabase
        .from("affirmations")
        .select("*")
        .eq("category", cat);

      if (data && data.length > 0) {
        const random = data[Math.floor(Math.random() * data.length)];
        setAffirmation(random);
        // Small delay for smooth entrance
        setTimeout(() => setShowAffirmation(true), 1500);
      }
    };

    fetchAffirmation();
  }, []);

  const handleIntegrate = useCallback(() => {
    setIntegrated(true);
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("sutra_affirmation_shown", today);
    setTimeout(() => {
      setShowAffirmation(false);
      setIntegrated(false);
    }, 1200);
  }, []);

  const handleDismiss = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("sutra_affirmation_shown", today);
    setShowAffirmation(false);
  }, []);

  return (
    <>
      {/* Affirmation modal */}
      <AnimatePresence>
        {showAffirmation && affirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={handleDismiss}
            />

            {/* Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative max-w-md w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 text-center shadow-[0_20px_60px_rgba(139,92,246,0.15)]"
            >
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-14 h-14 mx-auto mb-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center"
              >
                <Sparkles className="w-7 h-7 text-violet-400" />
              </motion.div>

              <p className="text-xl font-medium text-white mb-2 leading-relaxed">
                &ldquo;{affirmation.text_fr}&rdquo;
              </p>
              <p className="text-sm text-white/30 mb-6 capitalize">
                {affirmation.category === "love" && "Amour"}
                {affirmation.category === "power" && "Puissance"}
                {affirmation.category === "abundance" && "Abondance"}
                {affirmation.category === "health" && "Sante"}
                {affirmation.category === "wisdom" && "Sagesse"}
                {affirmation.category === "gratitude" && "Gratitude"}
              </p>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleIntegrate}
                disabled={integrated}
                className="w-full h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 transition-all duration-200 shadow-[0_4px_20px_rgba(139,92,246,0.3)] disabled:opacity-50"
              >
                {integrated ? "Integre ✨" : "J'integre ✨"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer quote (always visible in dashboard) */}
      <div className="fixed bottom-20 lg:bottom-4 left-4 lg:left-[296px] right-4 z-30 pointer-events-none">
        <p className="text-center text-xs text-white/20 italic">
          &ldquo;{quote.text}&rdquo; — {quote.author}
        </p>
      </div>
    </>
  );
}

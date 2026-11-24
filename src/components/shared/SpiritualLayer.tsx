"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
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
    let lastShown: string | null = null;
    try { lastShown = localStorage.getItem(key); } catch { /* Private browsing can disable storage. */ }

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
    try { localStorage.setItem("sutra_affirmation_shown", today); } catch { /* Closing remains possible without storage. */ }
    setTimeout(() => {
      setShowAffirmation(false);
      setIntegrated(false);
    }, 1200);
  }, []);

  const handleDismiss = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem("sutra_affirmation_shown", today); } catch { /* Closing remains possible without storage. */ }
    setShowAffirmation(false);
  }, []);

  return (
    <>
      {/* Affirmation modal */}
      <Modal open={showAffirmation && Boolean(affirmation)} onClose={handleDismiss} title="Affirmation du jour">
        {affirmation && <div className="text-center">
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
              <p className="text-sm text-white/65 mb-6 capitalize">
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
        </div>}
      </Modal>

      {/* Footer quote (always visible in dashboard) */}
      <div data-testid="studio-quote" className="mt-8 px-2">
        <p className="text-center text-xs text-white/65 italic">
          &ldquo;{quote.text}&rdquo; — {quote.author}
        </p>
      </div>
    </>
  );
}

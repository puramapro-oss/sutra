"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SUBLIMINAL_WORDS = [
  "INSPIRATION",
  "CREATION",
  "VISION",
  "TALENT",
  "CONFIANCE",
  "SUCCES",
];

/**
 * SubconsciousEngine — subtle UI enhancements
 * - Micro-pause reminder every 25 min
 * - Subliminal words during long loading
 */
export default function SubconsciousEngine() {
  const [showPause, setShowPause] = useState(false);
  const [subliminalWord, setSubliminalWord] = useState("");

  // Micro-pause every 25 minutes
  useEffect(() => {
    const interval = setInterval(
      () => {
        setShowPause(true);
        setTimeout(() => setShowPause(false), 3000);
      },
      25 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, []);

  // Subliminal flash during loading (triggered by custom event)
  useEffect(() => {
    const handleLoading = () => {
      const word =
        SUBLIMINAL_WORDS[Math.floor(Math.random() * SUBLIMINAL_WORDS.length)];
      setSubliminalWord(word);
      setTimeout(() => setSubliminalWord(""), 80);
    };

    window.addEventListener("sutra:loading", handleLoading);
    return () => window.removeEventListener("sutra:loading", handleLoading);
  }, []);

  return (
    <>
      {/* Micro-pause */}
      <AnimatePresence>
        {showPause && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] px-6 py-3 rounded-2xl bg-violet-500/10 backdrop-blur-xl border border-violet-500/20 text-violet-300 text-sm font-medium"
          >
            Respire. ✨
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subliminal word */}
      <AnimatePresence>
        {subliminalWord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.04 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.04 }}
            className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none"
          >
            <span className="text-6xl font-bold text-white tracking-[0.3em]">
              {subliminalWord}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

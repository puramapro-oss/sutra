"use client";

import { motion } from "framer-motion";
import { ArrowRight, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profil, Situation } from "@/types/financer";
import { PROFILS, SITUATIONS, REGIONS } from "@/data/financer-data";

interface Step1Props {
  profil: Profil;
  setProfil: (profil: Profil) => void;
  situation: Situation;
  setSituation: (situation: Situation) => void;
  region: string;
  setRegion: (region: string) => void;
  handicap: boolean;
  setHandicap: (handicap: boolean) => void;
  onNext: () => void;
}

export function Step1({
  profil,
  setProfil,
  situation,
  setSituation,
  region,
  setRegion,
  handicap,
  setHandicap,
  onNext,
}: Step1Props) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <User className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Ton profil</h2>
            <p className="text-sm text-white/50">
              Selectionne ton statut pour trouver les aides adaptees
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {PROFILS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProfil(p.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                profil === p.id
                  ? "bg-violet-500/10 border-violet-500/30 text-white"
                  : "bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/[0.06] hover:border-white/[0.15]"
              )}
            >
              <span className="text-2xl">{p.icon}</span>
              <span className="text-sm font-medium">{p.label}</span>
            </button>
          ))}
        </div>

        {profil && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-6"
          >
            {/* Situation */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-3">
                Ta situation actuelle
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SITUATIONS.filter((s) => {
                  if (profil === "etudiant") return s.id === "etudiant";
                  if (profil === "association") return s.id === "independant";
                  return true;
                }).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSituation(s.id)}
                    className={cn(
                      "px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200",
                      situation === s.id
                        ? "bg-violet-500/10 border-violet-500/30 text-white"
                        : "bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/[0.06]"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Region */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-3">
                <MapPin className="w-4 h-4 inline mr-1" />
                Ta region (optionnel)
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 outline-none transition-colors appearance-none"
              >
                <option value="" className="bg-[#0A0A0F]">
                  Toutes les regions
                </option>
                {REGIONS.map((r) => (
                  <option key={r} value={r} className="bg-[#0A0A0F]">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Handicap */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={handicap}
                onChange={(e) => setHandicap(e.target.checked)}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500/50"
              />
              <span className="text-sm text-white/70">
                En situation de handicap (donne acces a des aides
                supplementaires)
              </span>
            </label>
          </motion.div>
        )}
      </div>

      {/* Next button */}
      {profil && situation && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={onNext}
            className="w-full h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2"
          >
            Voir mes aides
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Aide, Profil, Situation } from "@/types/financer";
import { formatMontant, getBadge } from "@/lib/financer-utils";

interface Step2Props {
  loading: boolean;
  aides: Aide[];
  cumulTotal: number;
  selectedAides: Set<string>;
  toggleAide: (id: string) => void;
  profil: Profil;
  situation: Situation;
  selectedTotal: number;
  onBack: () => void;
  onNext: () => void;
}

export function Step2({
  loading,
  aides,
  cumulTotal,
  selectedAides,
  toggleAide,
  profil,
  situation,
  selectedTotal,
  onBack,
  onNext,
}: Step2Props) {
  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Cumul banner */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 text-center">
        <p className="text-green-400 text-sm font-medium mb-1">
          Cumul estimatif de tes aides
        </p>
        <p className="text-3xl font-bold text-green-400">
          {formatMontant(cumulTotal)} EUR
        </p>
        <p className="text-green-400/60 text-xs mt-1">
          Ton abonnement SUTRA peut etre 100% rembourse
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-white/50 text-sm">Analyse de tes aides en cours...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {aides.map((aide) => {
            const badge = getBadge(aide, profil, situation);
            const isSelected = selectedAides.has(aide.id);

            return (
              <button
                key={aide.id}
                onClick={() => toggleAide(aide.id)}
                className={cn(
                  "w-full text-left bg-white/5 backdrop-blur-xl border rounded-2xl p-5 transition-all duration-200",
                  isSelected
                    ? "border-violet-500/40 bg-violet-500/[0.06]"
                    : "border-white/10 hover:border-white/20"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-white text-sm">
                        {aide.nom}
                      </h3>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium",
                          badge.color
                        )}
                      >
                        {badge.label === "Probable" && (
                          <BadgeCheck className="w-3 h-3" />
                        )}
                        {badge.label === "Possible" && (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {badge.label === "A verifier" && (
                          <HelpCircle className="w-3 h-3" />
                        )}
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 line-clamp-2">
                      {aide.description}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-white">
                      {formatMontant(aide.montant_max)} EUR
                    </p>
                    <p className="text-xs text-white/30">
                      {aide.taux_remboursement}% pris en charge
                    </p>
                  </div>
                </div>
                {aide.url_officielle && (
                  <a
                    href={aide.url_officielle}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Site officiel
                  </a>
                )}
              </button>
            );
          })}

          {aides.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-white/40">
                Aucune aide trouvee pour ce profil. Essaie de modifier tes
                criteres.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        {selectedAides.size > 0 && (
          <button
            onClick={onNext}
            className="flex-1 h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2"
          >
            Generer {selectedAides.size} dossier
            {selectedAides.size > 1 ? "s" : ""} ({formatMontant(selectedTotal)}{" "}
            EUR)
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

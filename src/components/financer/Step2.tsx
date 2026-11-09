"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Aide } from "@/types/financer";
import { formatMontant, officialAidUrl } from "@/lib/financer-utils";

interface Step2Props {
  loading: boolean;
  aides: Aide[];
  selectedAides: Set<string>;
  toggleAide: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function Step2({ loading, aides, selectedAides, toggleAide, onBack, onNext }: Step2Props) {
  return (
    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-violet-300">Aides référencées pour ton profil</h2>
        <p className="mt-2 text-sm text-white/60">
          Les montants indiqués sont des plafonds, soumis aux conditions de chaque organisme.
          L&apos;éligibilité, les dépenses couvertes et les possibilités de cumul restent à confirmer.
        </p>
      </div>
      {loading ? (
        <div role="status" className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-white/50 text-sm">Chargement des aides référencées…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {aides.map(aide => {
            const isSelected = selectedAides.has(aide.id);
            const officialUrl = officialAidUrl(aide.url_officielle);
            const amount = Number(aide.montant_max);
            return (
              <div key={aide.id} className={cn("bg-white/5 border rounded-2xl overflow-hidden", isSelected ? "border-violet-500/40 bg-violet-500/[0.06]" : "border-white/10")}>
                <button type="button" onClick={() => toggleAide(aide.id)} aria-pressed={isSelected}
                  className="w-full text-left p-5 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-violet-400">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-white text-sm">{aide.nom}</span>
                      <p className="mt-1 text-xs text-white/50">{aide.description}</p>
                      <p className="mt-2 text-xs text-violet-300">{isSelected ? 'Sélectionnée' : 'Sélectionner pour vérifier les démarches'}</p>
                    </div>
                    <div className="text-right flex-shrink-0 text-sm">
                      <p className="font-semibold text-white">{Number.isFinite(amount) && amount >= 0 ? `${formatMontant(amount)} EUR` : 'À vérifier'}</p>
                      <p className="text-xs text-white/40">Plafond indiqué</p>
                    </div>
                  </div>
                </button>
                {officialUrl && (
                  <a href={officialUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mx-5 mb-4 text-xs text-violet-300 underline">
                    <ExternalLink className="w-3 h-3" /> Site officiel
                  </a>
                )}
              </div>
            );
          })}
          {aides.length === 0 && (
            <p className="text-center py-12 text-white/50">Aucune aide référencée ne correspond à ces critères. Tu peux modifier ton profil.</p>
          )}
        </div>
      )}
      <div className="flex gap-3">
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        {selectedAides.size > 0 && !loading && (
          <button type="button" onClick={onNext}
            className="flex-1 min-h-12 px-3 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center gap-2">
            Vérifier les démarches ({selectedAides.size}) <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

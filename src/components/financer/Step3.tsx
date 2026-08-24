"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import type { Aide } from "@/types/financer";
import { formatMontant } from "@/lib/financer-utils";

interface Step3Props {
  aides: Aide[];
  selectedAides: Set<string>;
  selectedTotal: number;
  generating: boolean;
  onBack: () => void;
  onGenerate: () => void;
}

export function Step3({
  aides,
  selectedAides,
  selectedTotal,
  generating,
  onBack,
  onGenerate,
}: Step3Props) {
  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Generer tes dossiers</h2>
            <p className="text-sm text-white/50">
              On prepare un PDF par aide avec toutes les infos necessaires
            </p>
          </div>
        </div>

        {/* Summary of selected aides */}
        <div className="space-y-2 mb-6">
          {aides
            .filter((a) => selectedAides.has(a.id))
            .map((aide) => (
              <div
                key={aide.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white/80">{aide.nom}</span>
                </div>
                <span className="text-sm font-bold text-white">
                  {formatMontant(aide.montant_max)} EUR
                </span>
              </div>
            ))}
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 text-center">
          <p className="text-sm text-green-400 font-medium">
            Total estimatif :{" "}
            <span className="text-lg font-bold">
              {formatMontant(selectedTotal)} EUR
            </span>
          </p>
          <p className="text-xs text-green-400/60 mt-1">
            Ton abonnement SUTRA coute 0 EUR
          </p>
        </div>

        <p className="text-xs text-white/30 mb-4">
          Chaque PDF contient : en-tete, ton profil, descriptif de SUTRA comme
          outil professionnel, justificatif de formation IA, et lien officiel
          vers l&apos;organisme.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex-1 h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generation en cours...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Generer les PDF
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import { CheckCircle2, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Aide } from "@/types/financer";
import { formatMontant } from "@/lib/financer-utils";

interface Step4Props {
  aides: Aide[];
  selectedAides: Set<string>;
  selectedTotal: number;
}

export function Step4({ aides, selectedAides, selectedTotal }: Step4Props) {
  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: "spring" }}
      className="space-y-6"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center"
        >
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </motion.div>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Tes dossiers sont prets
        </h2>
        <p className="text-white/50 text-sm mb-6">
          {selectedAides.size} dossier
          {selectedAides.size > 1 ? "s" : ""} genere
          {selectedAides.size > 1 ? "s" : ""} pour un total de{" "}
          <span className="text-green-400 font-bold">
            {formatMontant(selectedTotal)} EUR
          </span>{" "}
          de financement potentiel.
        </p>

        {/* Dossiers list */}
        <div className="space-y-2 mb-6 text-left">
          {aides
            .filter((a) => selectedAides.has(a.id))
            .map((aide) => (
              <div
                key={aide.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/80">
                      {aide.nom}
                    </p>
                    <p className="text-xs text-white/30">En cours de traitement</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs font-medium text-yellow-400">
                  En cours
                </span>
              </div>
            ))}
        </div>

        <p className="text-xs text-white/30 mb-6">
          Tu recevras une notification quand tes dossiers seront prets a
          telecharger. On te relancera automatiquement 30 jours avant
          l&apos;expiration de chaque aide.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/signup"
            className="flex-1 h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Creer mon compte SUTRA
          </Link>
          <Link
            href="/pricing"
            className="flex-1 h-12 rounded-xl font-semibold text-white/80 bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            Voir les tarifs
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

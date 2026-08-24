"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackgroundAndNav } from "@/components/financer/BackgroundAndNav";
import { Step1 } from "@/components/financer/Step1";
import { Step2 } from "@/components/financer/Step2";
import { Step3 } from "@/components/financer/Step3";
import { Step4 } from "@/components/financer/Step4";
import type { Aide, Profil, Situation } from "@/types/financer";
import { formatMontant } from "@/lib/financer-utils";

export default function FinancerPage() {
  const [step, setStep] = useState(1);
  const [profil, setProfil] = useState<Profil>("");
  const [situation, setSituation] = useState<Situation>("");
  const [region, setRegion] = useState("");
  const [handicap, setHandicap] = useState(false);
  const [aides, setAides] = useState<Aide[]>([]);
  const [cumulTotal, setCumulTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedAides, setSelectedAides] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const fetchAides = useCallback(async () => {
    if (!profil) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (profil) params.set("profil", profil);
      if (situation) params.set("situation", situation);
      if (handicap) params.set("handicap", "true");
      if (region) params.set("region", region);

      const res = await fetch(`/api/financer?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAides(data.aides || []);
        setCumulTotal(data.cumul_total || 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [profil, situation, handicap, region]);

  useEffect(() => {
    if (step === 2) {
      fetchAides();
    }
  }, [step, fetchAides]);

  const toggleAide = (id: string) => {
    setSelectedAides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedTotal = aides
    .filter((a) => selectedAides.has(a.id))
    .reduce((sum, a) => sum + Number(a.montant_max), 0);

  const handleGeneratePDF = async () => {
    setGenerating(true);
    // Simulate PDF generation delay
    await new Promise((r) => setTimeout(r, 1500));
    setGenerating(false);
    setStep(4);
  };

  return (
    <main className="min-h-screen bg-[#06050e] text-white overflow-x-hidden">
      <BackgroundAndNav />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium mb-4"
          >
            <Sparkles className="w-4 h-4" />
            Jusqu&apos;a {formatMontant(cumulTotal > 0 ? cumulTotal : 50000)} EUR
            de financement
          </motion.div>
          <h1
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Fais financer ton abonnement{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            La plupart de nos clients ne paient rien grace aux aides. Decouvre
            celles auxquelles tu as droit en 2 minutes.
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (s < step) setStep(s);
                }}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                  s === step
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                    : s < step
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-white/5 text-white/30 border border-white/10"
                )}
              >
                {s < step ? <CheckCircle2 className="w-5 h-5" /> : s}
              </button>
              {s < 4 && (
                <div
                  className={cn(
                    "w-8 sm:w-12 h-0.5 rounded-full transition-colors",
                    s < step ? "bg-green-500/40" : "bg-white/10"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <Step1
              profil={profil}
              setProfil={setProfil}
              situation={situation}
              setSituation={setSituation}
              region={region}
              setRegion={setRegion}
              handicap={handicap}
              setHandicap={setHandicap}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <Step2
              loading={loading}
              aides={aides}
              cumulTotal={cumulTotal}
              selectedAides={selectedAides}
              toggleAide={toggleAide}
              profil={profil}
              situation={situation}
              selectedTotal={selectedTotal}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <Step3
              aides={aides}
              selectedAides={selectedAides}
              selectedTotal={selectedTotal}
              generating={generating}
              onBack={() => setStep(2)}
              onGenerate={handleGeneratePDF}
            />
          )}

          {step === 4 && (
            <Step4
              aides={aides}
              selectedAides={selectedAides}
              selectedTotal={selectedTotal}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

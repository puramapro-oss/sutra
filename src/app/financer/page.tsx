"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackgroundAndNav } from "@/components/financer/BackgroundAndNav";
import { Step1 } from "@/components/financer/Step1";
import { Step2 } from "@/components/financer/Step2";
import { FinancingReview } from "./FinancingReview";
import type { Aide, Profil, Situation } from "@/types/financer";

export default function FinancerPage() {
  const [step, setStep] = useState(1);
  const [profil, setProfil] = useState<Profil>("");
  const [situation, setSituation] = useState<Situation>("");
  const [region, setRegion] = useState("");
  const [handicap, setHandicap] = useState(false);
  const [result, setResult] = useState<{ key: string; aides: Aide[]; error: string | null }>({
    key: "", aides: [], error: null,
  });
  const [retryVersion, setRetryVersion] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const requestKey = JSON.stringify([profil, situation, handicap, region, retryVersion]);
  const current = result.key === requestKey;
  const aides = current ? result.aides : [];
  const selectedAides = new Set(aides.filter(aide => selectedIds.has(aide.id)).map(aide => aide.id));
  const loading = step === 2 && !!profil && !current;
  const loadError = current ? result.error : null;

  useEffect(() => {
    if (step !== 2 || !profil) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ profil });
    if (situation) params.set("situation", situation);
    if (handicap) params.set("handicap", "true");
    if (region) params.set("region", region);
    void fetch(`/api/financer?${params.toString()}`, { signal: controller.signal })
      .then(async res => {
        if (!res.ok) throw new Error("financer_unavailable");
        const data = await res.json();
        if (!Array.isArray(data.aides)) throw new Error("financer_invalid_response");
        if (!controller.signal.aborted) setResult({
          key: requestKey, aides: data.aides, error: null,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({
          key: requestKey, aides: [],
          error: "Impossible de vérifier les aides disponibles. Réessaie avant de poursuivre.",
        });
      });
    return () => controller.abort();
  }, [step, profil, situation, handicap, region, requestKey]);

  const toggleAide = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
            Explorer les aides au financement
          </motion.div>
          <h1
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Identifier des aides pour ton projet{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Consulte les aides référencées pour ton profil, puis vérifie leurs conditions auprès des organismes officiels.
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Étape ${s}`}
                aria-current={s === step ? "step" : undefined}
                disabled={s > step}
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
              {s < 3 && (
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
              onNext={() => { setSelectedIds(new Set()); setStep(2); }}
            />
          )}

          {step === 2 && loadError && (
            <div role="alert" className="space-y-4 rounded-xl border border-amber-400/30 p-6 text-white" data-testid="financer-load-error">
              <p>{loadError}</p>
              <button type="button" onClick={() => setRetryVersion(value => value + 1)} className="rounded-xl bg-violet-600 px-4 py-2">Réessayer</button>
              <button type="button" onClick={() => setStep(1)} className="ml-3 rounded-xl border border-white/20 px-4 py-2">Modifier le profil</button>
            </div>
          )}

          {step === 2 && !loadError && (
            <Step2
              loading={loading}
              aides={aides}
              selectedAides={selectedAides}
              toggleAide={toggleAide}
              onBack={() => setStep(1)}
              onNext={() => { if (!loading && selectedAides.size > 0) setStep(3); }}
            />
          )}

          {step === 3 && (
            <FinancingReview
              aides={aides.filter(aide => selectedAides.has(aide.id))}
              onBack={() => setStep(2)}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

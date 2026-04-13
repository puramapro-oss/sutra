"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  MapPin,
  User,
  Sparkles,
  BadgeCheck,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Aide {
  id: string;
  nom: string;
  type_aide: string;
  profil_eligible: string[];
  situation_eligible: string[];
  montant_max: number;
  taux_remboursement: number;
  url_officielle: string;
  description: string;
  region: string;
  handicap_only: boolean;
  cumulable: boolean;
}

type Profil = "particulier" | "entreprise" | "association" | "etudiant" | "";
type Situation =
  | "salarie"
  | "demandeur_emploi"
  | "independant"
  | "auto_entrepreneur"
  | "retraite"
  | "rsa"
  | "cej"
  | "etudiant"
  | "";

const PROFILS = [
  { id: "particulier" as Profil, label: "Particulier", icon: "👤" },
  { id: "entreprise" as Profil, label: "Entreprise", icon: "🏢" },
  { id: "association" as Profil, label: "Association", icon: "🤝" },
  { id: "etudiant" as Profil, label: "Etudiant", icon: "🎓" },
];

const SITUATIONS = [
  { id: "salarie" as Situation, label: "Salarie" },
  { id: "demandeur_emploi" as Situation, label: "Demandeur d'emploi" },
  { id: "independant" as Situation, label: "Independant" },
  { id: "auto_entrepreneur" as Situation, label: "Auto-entrepreneur" },
  { id: "retraite" as Situation, label: "Retraite" },
  { id: "rsa" as Situation, label: "Beneficiaire RSA" },
  { id: "cej" as Situation, label: "Contrat d'Engagement Jeune" },
  { id: "etudiant" as Situation, label: "Etudiant" },
];

const REGIONS = [
  "Auvergne-Rhone-Alpes",
  "Bourgogne-Franche-Comte",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Hauts-de-France",
  "Ile-de-France",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Cote d'Azur",
];

function formatMontant(n: number): string {
  return n.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  });
}

function getBadge(
  aide: Aide,
  profil: Profil,
  situation: Situation
): { label: string; color: string } {
  const profilMatch = aide.profil_eligible.includes(profil);
  const situationMatch =
    !situation || aide.situation_eligible.includes(situation);
  if (profilMatch && situationMatch) {
    return { label: "Probable", color: "text-green-400 bg-green-500/10 border-green-500/20" };
  }
  if (profilMatch || situationMatch) {
    return { label: "Possible", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" };
  }
  return { label: "A verifier", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
}

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
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full bg-violet-500/[0.06] blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-100px] left-[-50px] w-[400px] h-[400px] rounded-full bg-fuchsia-500/[0.04] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06050e]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Tarifs
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
            >
              Commencer
            </Link>
          </div>
        </div>
      </nav>

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
          {/* STEP 1 — Profil */}
          {step === 1 && (
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
                          if (profil === "etudiant")
                            return s.id === "etudiant";
                          if (profil === "association")
                            return s.id === "independant";
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
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <button
                    onClick={() => setStep(2)}
                    className="w-full h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2"
                  >
                    Voir mes aides
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* STEP 2 — Aides matching */}
          {step === 2 && (
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
                  <p className="text-white/50 text-sm">
                    Analyse de tes aides en cours...
                  </p>
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
                        Aucune aide trouvee pour ce profil. Essaie de modifier
                        tes criteres.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
                {selectedAides.size > 0 && (
                  <button
                    onClick={() => setStep(3)}
                    className="flex-1 h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2"
                  >
                    Generer {selectedAides.size} dossier
                    {selectedAides.size > 1 ? "s" : ""} (
                    {formatMontant(selectedTotal)} EUR)
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3 — PDF generation */}
          {step === 3 && (
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
                    <h2 className="text-lg font-bold">
                      Generer tes dossiers
                    </h2>
                    <p className="text-sm text-white/50">
                      On prepare un PDF par aide avec toutes les infos
                      necessaires
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
                          <span className="text-sm text-white/80">
                            {aide.nom}
                          </span>
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
                  Chaque PDF contient : en-tete, ton profil, descriptif de SUTRA
                  comme outil professionnel, justificatif de formation IA, et
                  lien officiel vers l&apos;organisme.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
                <button
                  onClick={handleGeneratePDF}
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
          )}

          {/* STEP 4 — Suivi */}
          {step === 4 && (
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
                            <p className="text-xs text-white/30">
                              En cours de traitement
                            </p>
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
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

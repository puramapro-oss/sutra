"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
      fetch("/api/status", { method: "HEAD" }).catch(() => {
        /* connectivity check — silent fail */
      });
    }
  }, [error]);

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="relative mb-8 inline-block">
          <div className="w-20 h-20 rounded-full bg-[var(--error)]/10 flex items-center justify-center mx-auto glow-violet-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--error)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
        </div>

        <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-[var(--foreground)] mb-3">
          Perturbation detectee
        </h1>

        <p className="text-[var(--foreground-muted)] mb-4 leading-relaxed">
          Une erreur inattendue s&apos;est produite. Notre systeme a ete notifie
          et travaille a la resolution.
        </p>

        {error.digest ? (
          <p className="text-xs text-[var(--foreground-muted)] mb-8 font-mono">
            Reference : {error.digest}
          </p>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            data-testid="error-reset-button"
            type="button"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-all duration-200 glow-violet-sm hover:scale-[0.97] active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Reessayer
          </button>

          <a
            href="/"
            data-testid="error-home-link"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-[var(--foreground-muted)] glass hover:bg-white/5 transition-all duration-200"
          >
            Retour a l&apos;accueil
          </a>
        </div>
      </div>
    </main>
  );
}

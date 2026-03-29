import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Page introuvable",
  description: "Cette page n'existe pas ou a ete deplacee.",
};

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="relative mb-8 inline-block">
          <span className="font-[family-name:var(--font-orbitron)] text-[8rem] font-black leading-none gradient-text select-none">
            404
          </span>
          <div className="absolute inset-0 blur-3xl opacity-20 bg-[var(--primary)] rounded-full" />
        </div>

        <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-bold text-[var(--foreground)] mb-3">
          Signal perdu dans la galaxie
        </h1>

        <p className="text-[var(--foreground-muted)] mb-8 leading-relaxed">
          Cette page n&apos;existe pas ou a ete deplacee vers une autre
          dimension. Retournons en territoire connu.
        </p>

        <Link
          href="/"
          data-testid="not-found-home-link"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-all duration-200 glow-violet-sm hover:scale-[0.97] active:scale-95"
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
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Retour a l&apos;accueil
        </Link>
      </div>
    </main>
  );
}

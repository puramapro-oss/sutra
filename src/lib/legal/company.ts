import type { CompanyInfo, MediateurInfo } from './types';

/**
 * COMPANY_INFO canonique de l'écosystème PURAMA — copié tel quel depuis
 * `pashu/src/lib/constants.ts` (vérifié D-047, ne pas réécrire l'adresse/forme).
 * Le SIRET n'est JAMAIS inventé : `NEXT_PUBLIC_SIRET` ou fallback honnête.
 */
export function buildCompanyInfo(): CompanyInfo {
  return {
    nom: 'PURAMA',
    forme_juridique: 'SASU',
    adresse: '8 Rue Chapelle',
    code_postal: '25560',
    commune: 'Frasne',
    pays: 'France',
    siret: process.env.NEXT_PUBLIC_SIRET || '',
    tva_non_applicable: true,
    mention_tva: 'TVA non applicable, art. 293 B du CGI',
    emailContact: 'hello@purama.dev',
    directeurPublication: 'Matiss Dornier',
    tribunalCompetent: 'Besançon (25)',
  };
}

/**
 * Aucun médiateur de la consommation n'est souscrit à ce jour (2026-08-23) — ce N'EST PAS
 * un des 4 points "avocat une fois" de NIYAMA-BRIEF.md §6, mais reste une action business
 * réelle en attente (immatriculation à un médiateur agréé, ex. CNPM ou FEVAD). Tant que
 * `mediateur.nom` est `null`, la page légale l'affiche honnêtement comme "en cours de
 * désignation" — jamais un nom ou une URL inventés.
 */
export function buildMediateurInfo(): MediateurInfo {
  return { nom: null, url: null };
}

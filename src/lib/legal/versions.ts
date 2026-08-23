import type { LegalDocType } from './types';

/**
 * Version courante de CHAQUE document légal générique du socle — écrite UNE fois ici,
 * référencée partout (NIYAMA-BRIEF.md §0.1 : "une correction = corrigée partout").
 *
 * Règle : toute modification du CONTENU générique d'un doc (dans `content/*.ts`) DOIT
 * incrémenter sa version ici, à la même date. Un utilisateur qui a accepté une version
 * antérieure est re-sollicité par `LegalAcceptanceNotice` dès que la version courante
 * diffère de sa dernière acceptation enregistrée (`legal_acceptances`, cf sql/001_legal_core.sql).
 *
 * Les clauses spécifiques par app (`clausesSpecifiquesCgu/Cgv`) ont leur PROPRE historique
 * de version, tenu par l'app elle-même (elle en est l'auteur) — ce fichier ne verse
 * QUE la version du socle générique commun aux ~90 apps.
 */
export const CURRENT_LEGAL_VERSIONS: Record<LegalDocType, string> = {
  mentions: '1.0',
  cgu: '1.0',
  cgv: '1.0',
  confidentialite: '1.0',
};

/**
 * Compare les dernières acceptations connues d'un utilisateur aux versions courantes du
 * socle et retourne les documents pour lesquels une ré-acceptation est due (version absente
 * ou strictement antérieure). Fonction pure — à appeler côté serveur (le résultat est passé
 * en prop à `LegalReacceptanceGate`, qui ne recalcule rien lui-même).
 */
export function computeDocsEnAttente(
  dernieresAcceptations: Partial<Record<LegalDocType, string>>,
  currentVersions: Record<LegalDocType, string> = CURRENT_LEGAL_VERSIONS
): LegalDocType[] {
  return (Object.keys(currentVersions) as LegalDocType[]).filter(
    (doc) => dernieresAcceptations[doc] !== currentVersions[doc]
  );
}

export const LEGAL_VERSIONS_HISTORY: Record<LegalDocType, Array<{ version: string; date: string; changement: string }>> = {
  mentions: [{ version: '1.0', date: '2026-08-23', changement: 'Création du socle générique NIYAMA (T3).' }],
  cgu: [{ version: '1.0', date: '2026-08-23', changement: 'Création du socle générique NIYAMA (T3).' }],
  cgv: [{ version: '1.0', date: '2026-08-23', changement: 'Création du socle générique NIYAMA (T3).' }],
  confidentialite: [{ version: '1.0', date: '2026-08-23', changement: 'Création du socle générique NIYAMA (T3).' }],
};

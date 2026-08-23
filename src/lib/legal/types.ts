/**
 * Types du socle légal partagé. Une app consomme ces types en copiant les fichiers
 * de `packages/legal/src/` dans son propre `src/` (pattern copy-in, cf README.md).
 */

/** Les 8 familles NIYAMA (NIYAMA-BRIEF.md §2) — une app en déclare une seule. */
export type NiyamaFamily =
  | 'karma_wellness' // 1. apps qui paient les utilisateurs
  | 'marketplace_sap' // 2. marketplaces & SAP
  | 'finance' // 3. finance/trading
  | 'sante_bienetre' // 4. santé/bien-être
  | 'contenu_ia' // 5. contenu & IA
  | 'mineurs' // 6. mineurs
  | 'spiritualite' // 7. spiritualité/rituels
  | 'b2b'; // 8. B2B

export interface CompanyInfo {
  nom: string;
  forme_juridique: string;
  adresse: string;
  code_postal: string;
  commune: string;
  pays: string;
  /** JAMAIS inventé — env var ou fallback honnête "en cours d'attribution" (D-047). */
  siret: string;
  tva_non_applicable: boolean;
  mention_tva: string;
  emailContact: string;
  directeurPublication: string;
  tribunalCompetent: string;
}

/** Coordonnées d'un médiateur de la consommation réel — jamais inventées (art. L612-1 C. conso). */
export interface MediateurInfo {
  /** null tant qu'aucun médiateur n'est réellement souscrit (action business en attente). */
  nom: string | null;
  url: string | null;
}

export interface LegalAppConfig {
  slug: string;
  nom: string;
  /** ex: 'pashu.purama.dev' */
  domaine: string;
  famille: NiyamaFamily;
  company: CompanyInfo;
  mediateur: MediateurInfo;
  /** Description courte d'1 phrase de l'activité (injectée dans mentions/CGU §1). */
  descriptionActivite: string;
  /** L'app encaisse des paiements réels (Stripe) → CGV + clause de rétractation générées.
   *  Une app sans paiement n'a pas de CGV (pas de vente = rien à vendre légalement). */
  aPaiement: boolean;
  /** L'app expose un chat/assistant IA → déclaration "vous parlez à une IA" dans CGU. */
  aChatIA: boolean;
  /** Clauses additionnelles propres au modèle d'affaires de l'app (ex: PASHU §3-6 tarif/annulation).
   *  Le socle générique ne les invente pas — l'app les fournit, le socle les insère au bon endroit. */
  clausesSpecifiquesCgu?: LegalSection[];
  clausesSpecifiquesCgv?: LegalSection[];
}

export interface LegalSection {
  titre: string;
  /** Paragraphes de texte brut (pas de HTML — rendu par LegalPage). */
  paragraphes: string[];
  /** Liste à puces optionnelle affichée après les paragraphes. */
  liste?: string[];
}

export type LegalDocType = 'mentions' | 'cgu' | 'cgv' | 'confidentialite';

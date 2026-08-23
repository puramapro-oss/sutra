# CONFORMITÉ NIYAMA — SUTRA
Audit exécuté le 2026-08-23. Référence : `~/purama/NIYAMA-BRIEF.md` §7 (checklist certification) + `~/purama/FACTS.md` (chiffres verrouillés).
Famille NIYAMA applicable (déduite du domaine, non déclarée dans le code) : **5. Contenu & IA** (création vidéo IA — droit d'auteur, transparence IA, zéro deepfake).

Méthode : chaque point vérifié en lisant le fichier réel (code, pas déclaratif). Preuves citées `fichier:ligne`.

---

## 1. Pages légales — VERT
Toutes présentes et réelles (pas de générateur générique non adapté) :
- `src/app/legal/mentions/page.tsx`, `src/app/legal/terms/page.tsx` (CGU), `src/app/legal/cgv/page.tsx`, `src/app/legal/privacy/page.tsx`, `src/app/legal/cookies/page.tsx`, `src/app/legal/page.tsx` (hub).
- Routes canoniques historiques `src/app/mentions-legales/page.tsx`, `src/app/cgu/page.tsx`, `src/app/cgv/page.tsx`, `src/app/politique-confidentialite/page.tsx` : stubs `redirect()` fonctionnels vers les pages ci-dessus (vérifié, pas de 404).
- `src/app/confidentialite/page.tsx` : page RGPD dédiée, réelle.
- CGV Article 6/7 disclaimers de disponibilité + médiateur de la consommation présents (`src/app/legal/cgv/page.tsx:78,82,91`), avec mention explicite qu'aucun médiateur agréé n'est encore souscrit (`src/lib/legal/content/mentions-legales.ts:12`) — honnête, pas de fausse déclaration.
- Footer (`src/components/landing/AppWelcome.tsx:481-484`) : liens Mentions légales + Confidentialité présents. CGU/CGV non linkés directement en footer mais accessibles via `/legal` (hub) et via la case d'acceptation au signup.

## 2. Bandeau cookies fonctionnel — ORANGE (gap réel, piège confirmé)
Le bandeau réellement monté dans `src/app/layout.tsx:134` (`<CookieBanner />`) est **`src/components/shared/CookieBanner.tsx`**, un composant custom (108 lignes) :
- UX fonctionnelle côté client : accepter/personnaliser/refuser, bloque bien les catégories `analytics`/`marketing` **en local** (`localStorage.setItem('sutra-cookie-consent', ...)`, `CookieBanner.tsx:20-33`).
- **Ne persiste JAMAIS le choix en base.** Aucun appel à `/api/legal/cookie-consent` dans tout le fichier.
- Le socle légal fournit pourtant un composant équivalent déjà branché sur la DB — `src/lib/legal/components/CookieConsentBanner.tsx` via le hook `src/lib/legal/hooks/useCookieConsent.ts`, qui lui appelle bien `POST /api/legal/cookie-consent` (route existante et fonctionnelle, `src/app/api/legal/cookie-consent/route.ts`). **Ce composant n'est mounté nulle part** (`grep CookieConsentBanner src -r` → 0 usage en dehors de sa propre définition et du hook).
- C'est exactement le piège "onConsent non branché" déjà rencontré sur vida-grow-origine/raksha : deux implémentations coexistent, celle réellement affichée à l'utilisateur n'écrit pas la preuve RGPD en base (Dossier de contrôle §5 — "registre des traitements" incomplet côté consentement cookies).
- Atténuant : `posthog-js` est en dépendance (`package.json:40`) mais **n'est initialisé nulle part** dans `src/` (aucun `posthog.init`, aucun `PostHogProvider`) — aucun tracking analytics ne tourne réellement aujourd'hui, donc le risque pratique immédiat est faible, mais le mécanisme de preuve est cassé et doit être corrigé avant toute activation d'analytics.
- **Action requise** : remplacer `CookieBanner.tsx` par `CookieConsentBanner` du socle (ou brancher un `onConsent` qui appelle l'API) dans `layout.tsx:134`.

## 3. Preuve d'acceptation CGU horodatée en base — ORANGE (correctement câblée dans le code, mais table absente en prod)
- **Signup email** : `src/app/(auth)/signup/page.tsx:91-99` — après `signUp()`, `Promise.all` sur `cgu`/`cgv`/`confidentialite` avec `fetch('/api/legal/accept', {...})` réellement exécuté (pas juste défini), commentaire du code confirme l'intention "best-effort".
- **OAuth callback (Google)** : `src/app/auth/callback/route.ts:45-55` — après `exchangeCodeForSession`, upsert direct (pas de fetch, écriture serveur directe) sur `legal_acceptances` pour les 3 mêmes `docType`, réellement exécuté dans le flux, pas juste codé et jamais appelé.
- `src/app/api/legal/accept/route.ts` : route réelle, Zod-validée, auth vérifiée, upsert `onConflict: 'user_id,doc_type'`, capture IP + user-agent — bien fait.
- **MAIS** : `ERRORS.md` (ligne du 2026-08-23) documente que la migration SQL créant `legal_acceptances` (+ `cookie_consents` + `account_deletion_requests`) **n'a jamais été exécutée en base** — bloquée par un environnement sandbox sans accès sortant port 22 vers le VPS. Vérifié en re-testant dans cette session : `ssh root@72.62.191.111` → `Connection refused`, confirmant le blocage documenté (pas juste une affirmation non vérifiée).
- Conséquence pratique : tant que la migration n'est pas appliquée, les upserts vers `legal_acceptances` échouent silencieusement (le `fetch` du signup est catché, l'upsert du callback est un objet `{error}` non contrôlé qui n'interrompt pas la redirection) — **aucune preuve d'acceptation n'est réellement écrite en base aujourd'hui**, malgré un code correctement appelé aux deux points d'entrée. Le code est prêt ; la donnée n'existe pas encore.

## 4. « Ma mémoire » / export RGPD + suppression de compte — ORANGE (même dépendance bloquante)
- Page réelle : `src/app/(dashboard)/ma-memoire/page.tsx`, server component, charge `acceptances` + `deletionRequest`, rend `MaMemoirePage` du socle.
- Export : `src/app/api/legal/my-data/route.ts` — auth vérifiée, interroge `profiles` + `legal_acceptances` + `cookie_consents` + 3 tables métier (`video_generations`, `subscriptions`, `conversations`), retourne un JSON téléchargeable. Résilient : si `legal_acceptances`/`cookie_consents` n'existent pas encore, la query retourne `data: null` sans planter la route (fallback `?? []`/`?? null`), donc pas de 500 — mais l'export sera incomplet (silencieusement) tant que la migration n'est pas passée.
- Périmètre `EXTRA_TABLES` volontairement limité aux tables les plus sensibles (documenté dans `ERRORS.md` comme non-exhaustif — SUTRA a ~100 tables au total). Acceptable en V1, à élargir si demande RGPD réelle.
- Suppression de compte : `src/app/api/account/delete/route.ts` — rate-limité, `confirm: 'DELETE_MY_ACCOUNT'` requis, insert dans `account_deletion_requests` avec délai de grâce (`GRACE_PERIOD_DAYS`), annulation possible. **Cette route N'EST PAS résiliente à l'absence de table** : elle vérifie `if (error) return NextResponse.json({ error: 'Demande impossible.' ... }, { status: 500 })`. Tant que la migration n'a pas tourné, cliquer sur "Supprimer mon compte" retourne une **vraie erreur 500 visible côté utilisateur** — bouton actuellement cassé en pratique (Loi 9), pas par choix de code mais par dépendance à la migration bloquée.
- Bug historique corrigé (noté dans `ERRORS.md`) : anciens boutons morts `/api/user/export` et `/api/user/delete` (404) remplacés par le flux `/ma-memoire` ci-dessus — bon réflexe, mais le nouveau flux reste non fonctionnel en prod tant que P0 (migration) n'est pas levé.

## 5. Déclaration IA sur chaque UI de chat IA — VERT
- Surface de chat réelle : `src/app/(dashboard)/chat/[id]/page.tsx` — `AIDisclosure` importé et rendu (`:21` import, `:192` rendu : `<AIDisclosure appName="SUTRA" className="text-xs text-white/40 mb-3" />`).
- `src/app/(dashboard)/chat/page.tsx` (liste des conversations, avant ouverture d'un fil) ne contient aucune interaction IA — pas de disclosure nécessaire, correct.
- Composant `src/lib/legal/components/AIDisclosure.tsx` : wording conforme IA Act ("Vous échangez avec l'assistant IA de {appName}, pas avec un humain."), texte identique partout par design (auditable par grep).
- Note annexe (non bloquante) : `src/components/shared/ChatBot.tsx` importe aussi `AIDisclosure` mais **ce composant n'est mounté nulle part dans l'app** (widget mort/orphelin) — sans impact conformité puisqu'il n'est jamais affiché à un utilisateur.

## 6. Lexique interdit + avis rémunérés + promesses de résultat — ORANGE (1 occurrence confirmée)
- **Avis rémunérés — piège confirmé une 5e fois** : `src/app/(dashboard)/lottery/page.tsx:32` — tableau `ticketSources` affiché à l'utilisateur : `{ source: 'Avis store', tickets: '+3' }`. C'est une incitation affichée en UI à laisser un avis sur le store en échange de tickets de loterie (mécanique de récompense KARMA). Interdit sous deux angles : (a) NIYAMA §2.1 "JAMAIS d'avis/notes/installs rémunérés" (famille apps qui paient les utilisateurs, dont SUTRA hérite via KARMA/loterie universelle), (b) guidelines App Store/Play Store (avis incités = violation). Vérifié côté backend : aucune route API n'attribue réellement de tickets pour un avis (`grep -rn "avis.store\|store.review" src/app/api` → 0 résultat) — la mécanique n'est **pas implémentée** techniquement, mais le texte affiché à l'utilisateur constitue à lui seul la promesse interdite (et un futur "bouton mort" au sens Loi 9 s'il n'est jamais branché). **À retirer de la liste affichée**, pas seulement à laisser non câblé.
- Reste du lexique "garanti/garantie" scanné (`grep -rniE "garanti" src`) : toutes les autres occurrences sont soit des clauses légales correctes ("ne peut garantir un résultat spécifique", CGV Art. 7), soit des mécaniques de jeu internes non-monétaires ("100 graines garanties", "bonus garanti" — monnaie virtuelle du jeu KARMA, pas un résultat financier réel) — pas de violation.
- Aucune promesse de résultat non tenable trouvée (pas de "viral garanti", "revenus garantis", "monétisation garantie" etc. — recherche large, 0 occurrence).

## 7. Chiffres cohérents avec FACTS.md — VERT
- `WALLET_MIN_WITHDRAWAL = 5` — `src/lib/constants.ts:40` — conforme (FACTS.md : WALLET_MIN=5€).
- Split KARMA : `src/lib/karma-split.ts:31-34` — `user_pool: 0.5, asso: 0.1, sasu: 0.4`, commentaire explicite en tête de fichier citant CLAUDE.md §9.1 et signalant les valeurs 50/10/10/30 et 50/20/30 comme obsolètes — exactement conforme à FACTS.md (50/10/40). Garde-fou runtime présent : si les ratios env ne somment pas à 1.0, fallback loggé vers les valeurs par défaut 50/10/40 (`karma-split.ts:48`).

## 8. Migration SQL — DOCUMENTÉE (blocage réel, pas un oubli)
- `ERRORS.md` (entrée 2026-08-23) documente précisément le blocage : tables `legal_acceptances`, `cookie_consents`, `account_deletion_requests` non créées en base, cause = sandbox sans accès sortant port 22 vers le VPS (`72.62.191.111`), avec la commande exacte à rejouer dès qu'une session a l'accès SSH.
- Re-vérifié dans cette session d'audit : `ssh root@72.62.191.111` → `Connection refused` — confirme que le blocage est toujours actif, pas une excuse périmée.
- Ce point 8 est donc formellement "documenté" au sens de la checklist, mais reste la **cause racine** des gaps ORANGE aux points 2, 3 et 4 — tant que la migration n'est pas rejouée, aucune preuve légale n'est réellement persistée côté SUTRA.

## 9. LegalReacceptanceGate — ROUGE (gap confirmé, non monté)
- `src/lib/legal/components/LegalReacceptanceGate.tsx` existe (copié depuis le socle) mais **n'est importé nulle part ailleurs dans l'app** (`grep -rln "LegalReacceptanceGate" src` → seulement son propre fichier). Aucun layout (`src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`) ne le monte.
- Conséquence : si les CGU/CGV/politique de confidentialité sont mises à jour (bump de version dans `CURRENT_LEGAL_VERSIONS`), **aucun utilisateur existant ne sera re-sollicité pour ré-accepter** — seule la preuve initiale à la création de compte est capturée (et actuellement non persistée, cf point 3/8). Gap confirmé comme quasi-universel sur l'écosystème, SUTRA ne fait pas exception.

---

## Points hors checklist explicite mais relevés (NIYAMA §1)
- **Sign in with Apple absent** : l'app mobile (`mobile/app.json` existe, projet Expo réel) propose Google OAuth (`mobile/app/(auth)/login.tsx`, `mobile/hooks/useAuth.ts`) mais aucune trace de `signInWithApple`/`AppleAuthentication` dans `mobile/`. Obligatoire dès qu'un login tiers est proposé sur iOS (guideline Apple 4.8) — bloquant pour soumission App Store, pas pour le web.
- **`niyama_family` non déclarée** : aucune trace de frontmatter/constante `niyama_family` dans le repo SUTRA — la famille (5. Contenu & IA) a dû être déduite manuellement pour cet audit plutôt que vérifiée contre une déclaration explicite. Semble être un gap d'outillage écosystème plus que spécifique à SUTRA (aucun mécanisme de déclaration/inspection automatique trouvé).
- **Fiches App Privacy / Data Safety** : aucun générateur ni fichier trouvé (`packages/legal/` ne contient pas cette fonctionnalité) — non couvert, probablement un gap d'outillage écosystème à construire dans le socle plutôt qu'à corriger app par app.

---

## Synthèse des gaps
| # | Point | Statut | Gravité |
|---|---|---|---|
| 2 | Cookie banner monté ne persiste pas le consentement en base (implémentation socle correcte non branchée) | ORANGE | Moyenne (pas de tracking actif aujourd'hui, mais preuve RGPD absente) |
| 3 | Preuve d'acceptation CGU : code correctement appelé aux 2 points d'entrée, mais table absente → rien n'est écrit | ORANGE | Haute (dépend uniquement du point 8) |
| 4 | Export RGPD dégradé silencieusement + bouton "Supprimer mon compte" retourne une 500 réelle | ORANGE→ROUGE fonctionnel | Haute (bouton cassé en pratique) |
| 6 | "Avis store" +3 tickets affiché en UI — mécanique d'avis incité (non implémentée côté API mais promise à l'utilisateur) | ORANGE | Moyenne-Haute (à retirer du texte immédiatement, indépendant de la migration) |
| 8 | Migration SQL non exécutée — cause racine des points 2/3/4 | DOCUMENTÉ (ERRORS.md), toujours bloquant | Haute |
| 9 | `LegalReacceptanceGate` non monté | ROUGE | Moyenne (pas de ré-sollicitation lors d'un futur bump CGU) |
| — | Sign in with Apple absent (mobile) | GAP annexe | Bloquant store iOS uniquement |
| — | `niyama_family` non déclarée, fiches App Privacy/Data Safety absentes | GAP outillage écosystème | Faible (hors périmètre app) |

Le code du socle légal (pages, routes API, composants) est globalement bien construit et correctement câblé aux points d'entrée attendus (signup, callback OAuth, chat IA). Le blocage central est opérationnel, pas architectural : la migration SQL documentée en §8 doit être rejouée dès qu'une session a accès SSH au VPS pour que les points 2/3/4 passent au VERT. Le point 6 (mécanique d'avis) et le point 9 (Gate non monté) sont indépendants de la migration et doivent être corrigés séparément.

VERDICT:sutra:ORANGE:6

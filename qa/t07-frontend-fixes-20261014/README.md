# T07 — correction frontend et performance, 14 octobre 2026

Branche `codex/sutra-t07-frontend-fixes-20261014`, base T01 réellement intégrée `b7cf848d07fca2734db36a2e30d045ca312a3162`, code `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`. Commit local contenant ce dossier ; SHA communiqué dans le handoff coordinateur. Trois fichiers produit exclusivement réservés, aucun backend/API/configuration modifié.

## Défauts reproduits et corrections

| Risque précis | Avant / cause | Correction / preuve finale |
|---|---|---|
| Favoris ou dossier présents seulement après la première page | Avec13 vidéos, la treizième seule favorite/dans le dossier, le résultat local vide cachait aussi « Charger plus ». Quatre échecs Chromium375/1440. | Pagination indépendante du résultat filtré ; message « parmi les vidéos chargées ». Les quatre cas chargent la seconde page au clavier, une requête offset12 chacun. |
| Requêtes et chargements redondants | Le filtre local favorites invalidait le callback du même GET serveur que all ; six GET identiques pour trois aller-retours. | Dépendance du hook sur le filtre serveur normalisé ; zéro GET sur ces bascules, pages chargées et requête en cours préservées. |
| Pagination périmée après échec d'un nouveau filtre serveur | Le hook conservait hasMore/totalCount de la requête précédente. Test ajouté après déplacement du bouton : faux « Charger plus » visible malgré l'échec de chargement initial. | Réinitialisation de la pagination uniquement pour un remplacement en échec ; une page supplémentaire en échec conserve son bouton et reprend sans doublon. Test rouge conservé puis PASS. |
| Contrastes du bandeau cookies | Bouton accepter blanc sur primaire3,95:1 ; lien clair sur blanc4,23:1 en thème light. | Couleurs existantes : violet600 et text-primary. Bouton5,89:1 dans les trois thèmes ; lien4,85/5,70/7,36:1 (dark/light/oled). Aucun contrat de consentement modifié. |

Fichiers produit : `src/hooks/useLibraryVideos.ts`, `src/app/(dashboard)/library/page.tsx`, `src/lib/legal/components/CookieConsentBanner.tsx`.

## Mesure avant/après

Même Chromium, viewport375px, Next webpack dev chaud, fixtures13 vidéos, GET retardé400ms, trois aller-retours Toutes/Favoris. Les chronomètres DOM mesurent deux frames puis l'affichage utilisable ; l'attente de stabilisation n'est pas incluse. Aucun chiffre de vitesse de production déduit de ces fixtures.

| Mesure (six interactions) | Avant | Après |
|---|---:|---:|
| GET bibliothèque | 6 | 0 |
| Médiane affichage utilisable | 452ms | 27,5ms |
| Minimum–maximum | 423–521ms | 14–40ms |

Mesures brutes et temps de commit DOM : `evidence/before/results.json`, `evidence/after/results.json`. La cause corrigée est la répétition de requêtes, pas une optimisation mesurée du chargement initial ou du bundle.

## Commandes et résultats

Node24.21.0, dépendances existantes réutilisées en symlink après égalité de package-lock ; aucune installation. Exécuter à la racine du worktree avec Node24 :

```sh
node qa/t07-frontend-fixes-20261014/browser.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js 'src/app/(dashboard)/library/page.tsx' src/hooks/useLibraryVideos.ts src/lib/legal/components/CookieConsentBanner.tsx qa/t07-frontend-fixes-20261014/browser.mjs qa/t07-frontend-fixes-20261014/consent-contrast.mjs
git diff --check
gitleaks git --pre-commit --staged --redact --no-banner --no-color --report-format json --report-path qa/t07-frontend-fixes-20261014/secrets.json
```

- **PASS** navigateur21 contrôles ;13 audits axe complets +6 audits de contraste du bandeau, aucune violation ; calcul explicite des deux ratios dans chacun des six thèmes/largeurs. Authentification fixture, filtres/recherche rapide, clavier/focus, pagination, doubles clics, conservation de page/requête en cours, erreur/reprise et vrai vide, aucune erreur JavaScript/hydratation ni mutation inattendue.
- **PASS** TypeScript et lint ciblé sans erreur ni avertissement. Reçus `validation.json`, `typecheck.txt`, `lint.txt`, `browser-after.txt`.
- **PASS visuel borné** : captures375/1440 affichées et inspectées, design conservé, pas de débordement horizontal. Sur mobile, la pagination se trouve après l'état vide et reste accessible par défilement/focus clavier. Images dans `evidence/after/` ; cette preuve ne couvre pas des appareils physiques ni Safari/Firefox.
- Historique **FAIL corrigé** conservé : `browser-before.txt` (1PASS/5FAIL avant corrections bibliothèque), `consent-before.txt`, `browser-link-before.txt`, `browser-pagination-error-before.txt` et reçus homonymes. Banc enrichi ensuite : ne pas comparer leurs nombres de cas à la campagne finale21 sans tenir compte de ce delta.
- Incident du banc conservé dans `browser-harness-consent.txt` : le POST local de refus de cookies avait été interdit par le routeur de test ; interception explicite désormais simulée, aucun POST produit effectué. Seul le groupe Next temporaire identifié par son cwd propre a été arrêté. Un échec lint max-lines du banc a été corrigé par extraction du calcul de contraste, puis navigateur/lint rejoués.

## Réutilisation des preuves intégrées

`validation.json` compare les873 empreintes de `qa/salad-integration-20261014/tested-source-manifest.json` :870 inchangées, seuls les trois fichiers réservés diffèrent ; package et lock inchangés. La preuve existante de build/CI reste celle du code intégré, pas une nouvelle certification du delta.

| Parcours demandé | Preuve réutilisée / nouveau delta |
|---|---|
| Connexion | T01 public375/1440 et smoke authentifié existants ; connexion fixture et première visite du bandeau retestées ici. |
| Création, production, chargement/erreur et clavier | Browser-redteam intégré210+7 contrôles/165axe ; T07 modes52 contrôles/51axe sur cinq largeurs. Aucun code de ces parcours changé. |
| Bibliothèque | Nouvelle campagne ci-dessus sur le vrai composant/hook ; les réponses HTTP seules sont simulées. |
| Export | Preuve T01 export SRT déterministe et parcours browser-redteam ; rendu vidéo réel NON TESTÉ. Aucune modification export. |
| Réglages sociaux | Correctif de reconnexion déjà intégré, preuves T06/T07 fraîches conservées ; aucun OAuth ni compte réel connecté. |
| Personnel/API | DTO disponibilité et refus distant déjà testés dans T07 modes et quatre checks T01 ; mode distant désactivé, aucune promesse Mac/gratuité/instantanéité. Code inchangé. |

Aucune gate globale ou build identique relancé. Rapport source : `qa/salad-integration-20261014/README.md`. T01 reste seul intégrateur et responsable de la recette du nouveau candidat.

## GitNexus et limites

Index local exact créé sans embeddings avant modification. Impacts `useLibraryVideos` et `fetchVideos` LOW (respectivement1 et3 appelants directs) ; `LibraryPage` et `CookieConsentBanner` UNKNOWN, JSX non résolu. Lecture directe : page Next bibliothèque, bandeau via Mount/root layout sur toutes pages ; tests des chemins concernés ci-dessus. Couverture des processus tronquée : aucun graphe exhaustif revendiqué. Reçus `gitnexus-impact-*.json`, `gitnexus-index.txt`, puis `gitnexus-detect-changes.json` avant commit.

**BLOQUÉ externe / NON TESTÉ** : activation GPU distant, génération/rendu/pipeline complet réels, consentements OAuth et publication. Ces limites préexistantes ne bloquent pas la livraison locale UI. Aucun secret maître/.env consulté ou copié, aucun réseau fournisseur, achat, GPU/calcul IA, publication, production, push/fusion/déploiement. L'environnement du banc contient uniquement des valeurs synthétiques et le garde hors réseau existant.

Précommit : **PASS** Gitleaks0 finding (diff indexé, valeurs masquées), **PASS** diff whitespace ; `detect_changes(scope=staged)` MEDIUM,12 symboles (dont sections documentaires), trois flux attendus LibraryPage→FetchVideos/LoadFavorites/LoadFolders. Aucun symbole produit hors des trois fichiers réservés. Les nouveaux tests non présents dans le graphe de base sont revus directement. Le journal index est normalisé uniquement en fin de fichier pour la gate whitespace. Aucune exhaustivité GitNexus revendiquée.

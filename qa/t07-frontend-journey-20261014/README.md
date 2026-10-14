# T07 — parcours frontend, 14 octobre 2026

Base T01 vérifiée : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`, worktree auteur `sutra-t07-frontend-journey-20261014`, branche `codex/sutra-t07-frontend-journey-20261014`. Les trois fichiers du précédent lot T07 `654ae42a587d9934dbb29a63ec75eeec19062d72` étaient déjà intégrés à contenu identique. Leurs preuves bibliothèque/modes restent réutilisées ; pas de réimplémentation ni de gate globale rejouée.

## Défauts reproduits et corrections

| Défaut | Cause démontrée | Correction frontend | Vérification |
|---|---|---|---|
| Mentions légales inaccessibles depuis le consentement | Construction `/mentions`, HTTP404 | Correspondance explicite des quatre routes canoniques | `/mentions-legales` HTTP200 |
| Focus sort du consentement, aucun rôle modal | Overlay `div`, arrière-plan accessible au clavier | `dialog.showModal`, nom/description, focus sur document, boucle Tab, Escape conservant le consentement, restauration scroll/focus | 375 et1440px, Tab/Shift+Tab/Escape ; aucun modal/scroll résiduel après acceptation |
| Contraste insuffisant | Texte/bouton lié à une couleur primaire variable selon thème | Tokens de lien adaptés, bouton violet600 et focus visible | Axe contraste dark/light/oled : 3 échecs avant, 3 PASS après |
| Consentement reste en chargement sur réponse pendante | Aucun délai client | AbortController10s, état conservé et erreur réessayable | Même réponse simulée suspendue17s : bloqué au-delà de12s avant, récupéré10895ms après ; aucun consentement implicite |
| Vidéo failed/draft/ready sans fichier annoncée « en génération » ; contrôles sans effet | Message unique et contrôles actifs sans URL | Messages distincts, lecture/seek/volume/vitesse désactivés sans média | États et régressions375/1440px |
| Aucun accès au fichier existant depuis le lecteur | Seul bouton export, qui exige les sources de montage | Commande de téléchargement conditionnée au statut ready/published et reçu `sutraVerification` URL exacte/SHA256 | Sans preuve, preuve périmée et statut failed refusés ; fichier synthétique téléchargé au clavier et SHA comparé sans POST export |
| Le lien natif ne télécharge pas après redirection privée | `/api/media` renvoie 307 vers un stockage tiers inline ; aucun événement download dans les 15 s à deux largeurs | Fetch du média, Blob local, contrôle MIME/non-vide et SHA-256 exact, erreur expurgée, reprise, déduplication et limite 30 s | Vraie route locale 307 avec stockage HTTPS simulé ; 9 PASS dont clavier, HTTP403, HTML, SHA différent et corps suspendu |

Trois fichiers produit uniquement : `src/lib/legal/components/LegalReacceptanceGate.tsx`, `src/components/legal/LegalReacceptanceGateMount.tsx`, `src/components/editor/VideoPlayerPanel.tsx`. Aucun calcul de version juridique, route serveur, droit, média, publication, service backend, config applicative ou intégration modifié.

## Preuves et portée

Identité entièrement synthétique `legal-test@example.invalid`, base locale en mémoire. Connexion via le formulaire existant, refus cookies facultatifs, puis quatre clics explicites sur la vraie route locale `/api/legal/accept`. Auth/DB sont des doubles locaux ; aucune session utilisateur réelle. Versions enregistrées1.0 vérifiées et persistantes après reload. Ce test ne constitue pas un consentement de Matiss.

Next dev webpack et Chromium headless, largeurs375/1440, reduced-motion. Les opérations create/production/export/social sont interceptées par fixtures. Le serveur Next utilise `qa/t08/offline.cjs` : réseau hors loopback et lectures `.env*` refusés. Environnement construit avec valeurs factices explicites, aucun master ou `.env.local` lu/copié. Le petit MP4 est la fixture CPU déjà livrée par T05 (`qa/t05-real-export-20261014/fixtures/final-no-audio.mp4`,5702octets), sans génération nouvelle.

| Campagne | Résultat brut | Interprétation |
|---|---:|---|
| `before/results.json` | 6PASS /9FAIL | Reproduction du consentement sur source avant correction |
| `after/results.json` | 15PASS /0FAIL | Consentement corrigé, vraie API locale, erreurs/reprise/clavier/contrastes |
| `journey-before/results.json` | 12PASS /6FAIL | 2 défauts lecteur reproduits ; 2 attentes export erronées du banc ; 2 attentes trop courtes au démarrage dev |
| `journey-after/results.json` | 30PASS /4FAIL | Produit corrigé ; 2 sélecteurs de toast non uniques et 2 téléchargements non interceptables par `route.fulfill` dans le banc |
| `journey-retry/results.json` | 6PASS /0FAIL | Seulement les4 assertions touchées par correction du banc, plus setup/absence d'erreurs ; transport HTTP réel de la fixture |
| `private-download-final/results.json` | 2 PASS / 2 FAIL | Reproduction réelle du lien natif après résolution des problèmes TLS du banc, application et stockage HTTPS |
| `private-download-after/results.json` | 9 PASS / 0 FAIL | Correction du téléchargement privé, défauts de réponse et reprise ; aucun export ni rendu |
| `player-regression/results.json` | 18 PASS / 0 FAIL | Seulement les régressions lecteur touchées par la correction du téléchargement |
| `visual-download/results.json` | 4 PASS / 0 FAIL | Commande vérifiée : focus, contraste et absence de débordement à deux largeurs |
| `visual/results.json` | 6PASS /0FAIL | Animations terminées, 14 cartes sociales, aucun overflow ou modal résiduel, contraste lecteur375/1440 |

Les trois premiers essais du banc privé sont conservés dans `private-download`, `private-download-tls`, `private-download-https-storage` : origine CSRF HTTP/HTTPS incohérente, téléchargement HTTPS→HTTP puis CA non transmis par Next dev. Le dernier point est corrigé par `--experimental-https-ca` vers le certificat éphémère de test, sans installation de confiance système ni désactivation TLS du serveur. Ces échecs de montage ne sont pas des défauts produit.

Résultat final réconcilié : **61 assertions distinctes PASS, 0 FAIL résiduel** dans le périmètre local testé.

Les échecs historiques restent conservés, sans les transformer en PASS. `final-assertions.json` réconcilie les assertions finales par nom et indique leur fichier de preuve ; les setups communs ne sont pas additionnés. Les captures initiales prises pendant une animation ne constituent pas une validation visuelle ; les quatre captures `visual/*.png` et `after/legal-*.png` ont été affichées et inspectées. Les captures `visual-download/*.png` montrent le dernier contrôle après animation ; les captures intermédiaires du lecteur restent archivées mais ne servent pas de preuve visuelle.

Parcours couverts : bibliothèque vide, erreur503 distincte d'un vide et reprise ; formulaire création au clavier, réponse202 puis statut inconnu et reprise même clé d'idempotence ; double clic sans double requête ; API client distinct du worker distant désactivé ; production503 réessayable ; lecteur sans média/non validé/reçu périmé ; export refusé sans sources, export503 simulé réessayable ; connexion sociale503 expurgée sans navigation ni compte connecté. Ces réponses simulées prouvent l'interface, pas l'exécution d'un fournisseur.

Mesures : seule correction de lenteur nouvelle = sortie d'un consentement bloqué (même fixture, avant >12s/après10895ms). Les temps de compilation dev sont conservés dans les journaux, sans comparaison de performance de production. Ancienne réduction bibliothèque6GET→0GET,452ms→27,5ms réutilisée à source identique ; aucune optimisation spéculative ou promesse de génération gratuite/instantanée/GPU local.

## Commandes

Depuis la racine du worktree (Node24 local déjà installé, aucune installation) :

```sh
NODE24=/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node
"$NODE24" qa/t07-frontend-journey-20261014/run.mjs
"$NODE24" qa/t07-frontend-journey-20261014/run.mjs --journeys
"$NODE24" qa/t07-frontend-journey-20261014/run.mjs --journeys --retry
"$NODE24" qa/t07-frontend-journey-20261014/run.mjs --journeys --visual
"$NODE24" qa/t07-frontend-journey-20261014/run.mjs --journeys --private-download
"$NODE24" qa/t07-frontend-journey-20261014/run.mjs --journeys --player
"$NODE24" qa/t07-frontend-journey-20261014/run.mjs --journeys --visual --visual-download
"$NODE24" node_modules/typescript/bin/tsc --noEmit --incremental false
"$NODE24" node_modules/eslint/bin/eslint.js src/components/editor/VideoPlayerPanel.tsx src/components/legal/LegalReacceptanceGateMount.tsx src/lib/legal/components/LegalReacceptanceGate.tsx qa/t07-frontend-journey-20261014/*.mjs
git diff --check
```

`--baseline` et `--repro` nomment des dossiers de reproduction ; ils ne restaurent pas le code. Les résultats avant ont été capturés avant les modifications correspondantes. Ne pas les écraser avec le code corrigé. Le premier typecheck après téléchargement (`typecheck-download.txt`) a rencontré TS6053 : Next dev régénérait ses types pendant le contrôle ; il est conservé puis rejoué après arrêt du serveur propre. Les fichiers `typecheck-final.txt` et `lint-final.txt` sont vides en cas de réussite, codes retour dans `verification.json`.

## GitNexus et limites

Index local17749nœuds/34309arêtes, tronqué1143/1343entrées et667callees/3budgets de marche. Impact lecteur LOW :1 appelant EditorPage,0flux résolu. Consentement UNKNOWN : JSX non résolu, chaîne DashboardLayout→Mount→Gate vérifiée directement. Impacts exécutés avant édition ; `gitnexus-changes.json` avant commit. Aucun résultat du graphe ne prouve une exhaustivité.

PASS local à distinguer de l'intégration T01. Build/global CI inchangés non rejoués selon mandat ; T01 conserve la campagne intégrée unique. NON TESTÉ : Safari/Firefox/appareil physique/lecteur d'écran, performances du bundle de production, vrais fournisseurs/génération/rendu/publication, OAuth distant, stockage et cookies de production. Aucune acceptation légale ou connexion sociale réelle. Aucun défaut backend corrigé en parallèle.

Le téléchargement par Blob nécessite un accès CORS autorisé au stockage et garde le fichier en mémoire pour vérifier le SHA. Les gros fichiers, Safari et la configuration CORS réelle restent NON TESTÉS ; une réponse inaccessible échoue visiblement, sans export payant de secours.

Sécurité : scan QA brut exit1 sur six UUIDv4 d'idempotence synthétiques, et aucun autre résultat. Classification vérifiée par schéma/contexte et empreinte dans `gitleaks-disposition.json`. Exclusions limitées à ces six fingerprints dans `gitleaks-fixture.ignore` ; rapport brut conservé. Produit/docs : scan brut exit0. Journaux GitNexus et un journal Next normalisés uniquement pour espaces de fin de ligne/EOF, sans suppression de diagnostic.

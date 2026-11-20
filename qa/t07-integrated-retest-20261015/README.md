# T07 — retest du frontend intégré, 15 octobre 2026

**PASS local ciblé : 142 assertions Chromium, 0 FAIL ; 39 analyses axe, 0 violation dans les régions/règles testées.** Aucun nouveau défaut produit reproduit. Cette livraison ajoute un runner et des preuves ; aucun fichier frontend ou backend n'est modifié.

## Intégration et périmètre

- Candidat applicatif T01 : `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2` ; HEAD documentaire vérifié : `56754679abed9aa1e51323c29aed5bef38bc17d0`.
- Les neuf fichiers produit du dernier lot T07 `c72188a221588402498f10248f181cffe32bee1e` sont identiques au candidat, octet pour octet. Empreintes et différence documentaire d21→567 : [integration.json](integration.json).
- Worktree isolé : `/Users/matissdornier/purama-worktrees/sutra-t07-integrated-retest-20261015`, branche `codex/sutra-t07-integrated-retest-20261015`. Réservation `SUTRA-T07-20261015:INTEGRATED-RETEST` dans les deux LOCKS communs.
- Le runner importe les scénarios opérationnels T07 et les gardes natives corrigées par T01, sans les modifier. Les fichiers testés sont identifiés dans [tested-harness-manifest.json](tested-harness-manifest.json).

Le candidat possède déjà la CI exacte **38677062190 SUCCESS** : TypeScript/lint/build, contrats, PostgreSQL et vingt familles navigateur Chromium/WebKit. Ces preuves sont réutilisées depuis `qa/t01-final-20261015/README.md` et les reçus `ci-d21b7b4-*.json`, sans nouvelle requête distante ni nouvelle build identique. Elles ne sont pas comptées comme tests frais de ce lot. Cette campagne supplémentaire répond à la demande explicite de retest frontend.

## Exécution fraîche

Node24.21.0, Next16.3.8, React19.2.4, Playwright1.58.2. Chromium headless réel sur Mac ; viewports375×900 et1440×900 (contexte initial375×812), locale fr-FR, mouvement réduit. **Serveur Next en développement**, un processus isolé, états réinitialisés et contexte neuf pour chaque famille. Aucun nouvel install/build global. Dépendances existantes réutilisées après comparaison du lockfile.

```sh
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node qa/t07-integrated-retest-20261015/run.mjs
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --check qa/t07-integrated-retest-20261015/run.mjs
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node node_modules/eslint/bin/eslint.js qa/t07-integrated-retest-20261015/run.mjs
```

Le dossier `browser` est créé exclusivement : le runner refuse d'écraser un précédent reçu. Pour une future exécution justifiée, utiliser une copie de travail neuve sans les sorties ou réserver un nouveau dossier ; ne pas effacer les preuves existantes.

Identité synthétique, session via fixture et quatre consentements explicites par la **vraie route légale** vers une base locale jetable. Aucun consentement personnel contourné. Les opérations de génération, OAuth, export et publication sont simulées ; les écritures inattendues sont refusées. Réseau serveur borné au loopback par `qa/t08/offline.cjs`, navigateur limité à l'application et la fixture. Aucun master, `.env`, compte réel ou secret utilisé. Zéro appel payant/GPU/IA Mac/publication/migration/déploiement.

| Famille | PASS | FAIL | Risque couvert |
|---|---:|---:|---|
| Auth |22|0| Inscription/connexion, double soumission, erreurs visibles, clavier, labels |
| Social |10|0|503 et réponse malformée distinctes de zéro compte, retry, timeout, révocation incertaine, modal/focus |
| Planification |9|0| GET/PATCH bornés, double clic, brouillon et ID conservés, erreur de suppression, fuseau/labels |
| Consentement |15|0| Lecture des documents, consentement explicite,503/réponse perdue/réponse suspendue, reprise |
| Parcours |34|0| Création API/personnel, GPU distant désactivé, progression, résultat incertain/non vérifié, bibliothèque, montage/export, social |
| Téléchargement privé |9|0|307 vers stockage local signé, hash, clavier, refus/HTML/corruption/corps suspendu, retry unique |
| Parcours complémentaires |31|0| Dashboard503/reprise, brief en six étapes, formats/coût, cinq onglets montage, crédits absents, attente puis résultat simulé |
| Historique montage |5|0| Ajouter/modifier/supprimer sous-titres, undo/redo, narration initiale, branche après undo |
| Visuel social stabilisé |3|0|375/1440, erreurs/dialogue, contraste, noms accessibles, absence de débordement |
| Navigation |4|0| Bibliothèque/création, navigation client et départ forcé du document, garde d'erreurs |

[Résumé brut](browser/summary.json), [vérification](verification.json), `browser/chromium/*/results.json`, `runtime-errors.json` et `navigation.json` : **0 erreur runtime brute/inattendue, 0 mutation imprévue, 0 tentative externe observée**. Les annulations `net::ERR_ABORTED` du contrôle de navigation forcée restent dans les diagnostics ; elles ne sont pas des erreurs d'hydratation. Le processus propre du lot est arrêté, PID et état consignés dans `verification.json`.

## Mesures et interprétation

[metrics.json](metrics.json) conserve les mesures brutes. Elles comprennent les ressources d'instrumentation/axe et le mode développement ; compilation et caches ne sont pas normalisés. **Aucune comparaison de vitesse avec une build production ni gain de chargement revendiqué.**

| Page/largeur | Réponse document | DOMContentLoaded | Ressources | Octets transférés |
|---|---:|---:|---:|---:|
| Inscription375 |674ms|713ms|16|5290494|
| Inscription1440 |105ms|145ms|15|5290178|
| Connexion375 |37ms|138ms|15|5279776|
| Connexion1440 |31ms|54ms|15|5279781|

Ces poids sont ceux du banc de développement, pas des pages de production. Le premier chargement inscription plus lent ne démontre pas une lenteur produit reproductible : compilation/cache différents. Aucun correctif d'optimisation spéculatif.

Les doubles soumissions auth et planification produisent **une seule requête** à chaque largeur. Les anciennes reproductions comparables documentaient2→1 requête auth et2→1 PATCH planning mobile ; les conditions de ce nouveau run ne constituent pas un nouveau benchmark avant/après. Le délai d'erreur observé est10896ms pour social,10894ms pour planning et10899ms pour consentement, avec deadline applicative10s et observation du test. La mesure auth `recoveryMs` inclut800ms d'attente explicite du harnais ; elle n'est pas une mesure INP. Le délai du téléchargement suspendu est vérifié par horloge navigateur avancée31s, pas une mesure réelle30s. LCP/INP terrain, profil CPU/rendu et gros médias distants : NON TESTÉS.

## Captures inspectées et limites

Captures fraîches effectivement affichées : `browser/chromium/final/login-375.png`, `final/signup-1440.png`, `journey/create-error-375.png`, `journey/editor-1440.png`, `social/social-unavailable-375.png`, `visual/social-error-375.png`, `visual/social-dialog-1440.png`. Les captures prises pendant une animation dans les scénarios fonctionnels ne servent pas de mesure de contraste ; les captures `visual` sont prises après stabilisation. Le badge Next de développement est conservé. Les autres captures sont disponibles sans prétendre à une revue visuelle exhaustive.

- **FAIL : 0** dans cette campagne. Aucun nouveau correctif produit nécessaire sur les risques testés ; les corrections du lot précédent sont confirmées intégrées.
- **BLOQUÉ côté contrat T01/T03** : annulation durable de `/create` non exposée. La route production et l'intention create n'ont pas la même identité ; arrêter le fetch ne prouve pas l'arrêt du fournisseur. Limite déjà transmise, backend laissé à ses propriétaires. La reprise et les résultats incertains sont testés avec simulation.
- **NON TESTÉ** : Safari natif, appareil physique/iOS, VoiceOver réel, consentements/OAuth personnels, fournisseur ou GPU réel, publication, réseau/stockage distant réel. Le précédent blocage Safari WebDriver est connu ; aucune modification de réglage ni nouvelle tentative identique. WebKit de la CI T01 réutilisé ne vaut pas Safari natif validé.
- La recette indépendante T08 et toute décision de production restent à T01/T08 ; ce lot ne les remplace pas et n'autorise aucun déploiement.

GitNexus : index isolé sur56754679, impact exact du runner réutilisé **LOW**, un appelant QA, aucun flux produit. Analyse finale du delta et scan de secrets consignés dans les reçus associés ; les nouveaux fichiers QA hors graphe ne sont pas une certification exhaustive. Les anciens FAIL de l'auteur et de la CI restent conservés dans leurs dossiers historiques, sans réécriture.

Analyse finale : `detect-changes-all.txt` LOW,73 fichiers/6 sections documentaires/0 flux ; les sections anciennes apparaissent par recouvrement des limites du graphe, seules les nouvelles lignes T07 sont ajoutées. `detect-changes-main.txt` CRITICAL,3539fichiers/9344symboles/228flux, liste plafonnée : historique global, pas certification du delta. Aucun symbole produit changé. Scan `gitleaks dir` initial : deux UUIDv4 de la fixture détectés ; revue exacte et scan final PASS, aucun secret réel. Fichiers `secret-review.json`, `gitleaks-reviewed.ignore` et reçus expurgés. `final-scope.json` confirme encore les neuf blobs identiques et le HEAD T01 inchangé à la clôture.

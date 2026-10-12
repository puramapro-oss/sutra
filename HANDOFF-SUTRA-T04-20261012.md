# SUTRA T04 — reprise fournisseurs sur intégration, 12 octobre 2026

**DELTA_T04_LOCAL_VERIFIE — release et fournisseurs réels non certifiés.** Ce document remplace le handoff S5 présent dans la base ; l'historique Git et l'ancien worktree le conservent. La réconciliation S5/PR3 est déjà livrée par T01 : elle n'est pas refaite.

- Branche : `codex/sutra-t04-providers-final-20261012`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t04-providers-final-20261012`.
- Base intégrée demandée et vérifiée : `589732cb49959c1a576a3ba381b310cd594600ac`.
- Commit produit : `449150e4daa6e9e608b6b2ee0a490ca626d311bd`. Le commit contenant ce document ajoute seulement les preuves et documents ; SHA final communiqué dans le pointeur coordinateur et la réponse de livraison.
- [Manifest des 10 chemins et SHA-256 du contenu committé](qa/t04-final-20261012/manifest.json).

## Coordination

AGENTS, politique canonique, BATON/plan/brief/ERRORS et LOCKS vérifiés avant écriture ; `POLICY_OK`. Réservation racine `SUTRA-T04-20261012:REPRISE-589732c`. Nouveau worktree depuis l'intégration exacte, sans copie de source S5, reset/stash/clean ni écrasement. T01 reste propre à sa base ; anciens T04 et checkout canonique étrangers préservés. T02/T03/T05/T06/T07/T08 actifs sur leurs scopes séparés. Aucun fichier package/lockfile/CI, DB, orchestration, média ou UI changé. `vercel.json` ajoute uniquement la garde anti-preview de cette branche, conformément au mandat sans déploiement.

Dépendances de T01 réutilisées en lecture par lien local, lockfile identique, Node 24.21.0 ; aucune installation. Dernier contrôle disque : 17 GiB libres, aucun nettoyage. Commit et push de la seule branche T04 autorisés par le dernier mandat ; aucun déploiement, secret, mutation de DB distante ni appel payant.

## Cinq défauts reproduits puis corrigés

| Défaut sur la base | Correction et preuve |
| --- | --- |
| Callback de checkpoint absent : une intention en mémoire autorisait le POST payant | `durableLtxJob.save` exige le callback durable ; erreur `LTX_JOURNAL_UNAVAILABLE`, 0 POST si absent. Aucun faux acquittement mémoire |
| Deux wrappers d'une scène avaient chacun leur snapshot et leur file CAS ; 16 appels concurrents produisaient 16 POST | Lecture du slot courant et identité de sérialisation partagée par couple objet steps/clé ; 16 appels → 1 POST. Scènes distinctes indépendantes, chaque wrapper garde son propre callback de lease |
| Clé fournisseur absente après intention LTX : fallback stock possible | Journal existant ou contexte d'exécution explicite force le chemin de reprise/refus ; aucun appel Pexels malgré strictAI=false |
| Changement de plan vers WAN ignorait un contexte LTX explicite | Refus typé `SUTRA_LTX_RESUME_CONFLICT`, 0 appel WAN, propriétés non-retry/non-fallback conservées |
| Réponse 202 avec ID valide sans date : ID perdu malgré dépense possible | ID conservé sous `submission_unknown`, jamais annoncé comme succès ; réconciliation GET uniquement et récupération de `created_at`. ID malformé/non-202 non accepté |

Les anciennes fixtures ont reçu un callback de checkpoint simulé explicite ; le nouveau test négatif sans callback conserve le refus. Une fixture WAN ne transmet plus artificiellement un contexte LTX à un plan WAN. Aucune assertion produit affaiblie pour faire passer les tests.

## Contrats LTX V2 conservés et requalifiés

[Migration officielle](https://docs.ltx.io/migrate-v1-to-v2), [jobs asynchrones](https://docs.ltx.io/async-jobs) et [tarifs](https://docs.ltx.io/pricing) relus le 2026-10-12. V2 désigne le protocole ; aucun changement implicite de modèle ni prix inventé.

| Capacité | Comportement courant |
| --- | --- |
| Soumission / job ID | POST V2 unique après acquittement durable ; 202/ID/date validés ; toute issue ambiguë reste non rejouable |
| Polling / reprise | GET du même endpoint et ID, états pending/processing/completed/failed ; intervalle ≥5 s avec jitter, budget d'attente, Retry-After ; aucune resoumission pour timeout/404/échec distant |
| Texte→vidéo | Endpoint `text-to-video`, grille officielle de paramètres validée avant dépense |
| Image→vidéo / références | `image-to-video`, première image et dernière image selon capacité ; aucune référence multiple arbitraire |
| Retake / extension | Vrais endpoints `retake` et `extend`, source et métadonnées requises ; pas de faux retake par nouvelle seed |
| Vidéo→vidéo | Reframe et HDR documentés ; HDR reste archive EXR, jamais assimilé à MP4 ; V2V générique refusé |
| Webhook | Refus explicite : aucun contrat officiel endpoint/signature prouvé, aucune acceptation d'un callback non vérifié |
| Annulation | Annulation distante explicitement unsupported ; AbortSignal interrompt seulement l'attente locale, `mayStillBeBilled: true` |
| Coût / provenance | Fournisseur, modèle, endpoint, ID, état local/distant, dernier HTTP, estimation datée et coût réel distincts ; réel non fourni = null/not_reported |
| Quotas / timeout | 402/429 distingués, quota restant inconnu = null ; soumission/GET/attente/download bornés, timeout ≠ annulation distante |

L'autorité durable est toujours le checkpoint T03 protégé par lease. La sérialisation locale corrige plusieurs wrappers partageant les mêmes steps ; elle ne remplace pas le verrou et la persistance inter-workers de T03. Aucun `ltx-job-store.ts` S5 ni seconde autorité DB ajouté. Intention sans ID = réconciliation obligatoire, quel que soit l'âge ou l'expiration d'un lease. Anciens checkpoints PR3 avec ID reprennent par GET ; leur fingerprint reste conservé.

Downloader/JSON borné T02 et mesures média T05 restent canoniques. La résolution demandée ne devient pas une preuve de pixels natifs. URL signée non exposée dans la provenance publique ; champs sensibles restent dans le journal serveur autorisé.

WAN, voix et musique conservent la sélection explicite et les erreurs payantes non rejouables ; aucune cascade silencieuse vers stock ou autre fournisseur après issue inconnue. Estimation inconnue ou coût réel absent restent inconnus. Les gateways musicales historiques restent `legacy_not_live_verified`, pas un contrat officiel inventé. Le périmètre n'ajoute aucun moteur hybride S5 absent de l'intégration.

## Tests gratuits exécutés

Logs sous [qa/t04-final-20261012](qa/t04-final-20261012). Environnement enfant assaini par `scripts/run-ci.mjs`, clés factices et `qa/t08/offline.cjs` : réseau distant et lecture des fichiers .env interdits. HTTP/leases fournisseurs simulés, aucune génération payante. Les 147 tests ciblés sont inclus dans les 432 contrats, ils ne s'additionnent pas.

| Commande / gate | Résultat frais |
| --- | --- |
| Node24 `--experimental-test-module-mocks --import tsx --test` sur test-ltx-v2-contracts, test-provider-safety, test-ltx-v2-media, test-api-contracts | 147 PASS, 0 FAIL, 0 SKIP |
| Node24 `scripts/run-ci.mjs contracts` | 432 PASS, 7 SKIP, 0 FAIL ; schedule/composition/publication PASS |
| Node24 `scripts/run-ci.mjs media`, puis reprise du seul compositor avec FFmpeg T01 | 3 moteur local + 30 compositor = 33 PASS, 0 échec restant |
| Node24 `scripts/run-ci.mjs quality`, puis reprise du seul build avec police réelle en cache | TypeScript PASS ; lint 0 erreur/111 avertissements préexistants ; build webpack 197 pages PASS |
| `git diff --check` | PASS |

Premier compositor : 24 PASS/6 FAIL, binaire système sans drawtext/subtitles ; corrigé sans modifier le produit avec le même FFmpeg statique que T01, lié dans test-results/media-bin. Première compilation : refus réseau de Space Grotesk. Trois fichiers réels téléchargés gratuitement depuis Google Fonts, origines/SHA-256 dans `fonts.json`, réutilisés via le transport de test Next `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` ; build toujours hors réseau. **Build avec transport de police local**, pas preuve de téléchargement runtime. Logs d'échec conservés, JSON des reprises avec commandes exactes. Aucun premier échec présenté comme PASS.

7 SKIP : 4 INSEE live, 2 DB distante, 1 OpenTimestamps réseau. Les preuves SQL/navigateur/legacy/deploy de la base T01 sont conservées comme historiques sur sources inchangées ; pas réexécutées, pas comptées dans les résultats frais T04. Aucun parcours visuel nouvellement certifié.

## GitNexus et revue

Impacts exécutés avant édition : durableLtxJob CRITICAL (4 appelants directs), executionForCheckpoint CRITICAL (3), submit CRITICAL (3), fallback/Smart/poll/interface HIGH ; rayon création/production/auto/export/cron signalé. Les sorties initiales conservées sont impact-interface/smart/submit/poll ; trois impacts sont aussi archivés après réindexation.

Index final : 12 774 nœuds, 24 797 relations, 369 flux ; **TRUNCATED** (930 candidats d'entrée omis, 519 callees, 4 walks coupés). `detect-changes --scope staged --repo sutra-t04-final-20261012 --limit 300` avant commit : 10 fichiers/28 symboles, LOW et 0 flux annoncés. Ce résultat limité et variable après indexation ne remplace pas les impacts HIGH/CRITICAL ni la revue directe ; aucune preuve d'absence d'impact. `detect-code.log` archivé.

## Transmission T01 et limites réelles

- Intégrer uniquement le delta depuis `589732cb49959c1a576a3ba381b310cd594600ac` ; aucun nouveau port global S5. Reprendre les 10 chemins du manifest ; fusionner explicitement BATON/plan/handoff et les gardes Vercel si d'autres terminaux livrent en parallèle.
- Aucun échec restant dans les gates locales exécutées. Génération payante/live, facturation réelle, webhook/annulation distante non documentés et schéma/runtime distants ne sont pas qualifiés.
- La sûreté inter-workers dépend du checkpoint durable avec lease T03. WAN/voix/musique n'ont pas un journal crash-safe de bout en bout prouvé ; les wrappers historiques URL/ArrayBuffer ne transportent pas toute la provenance. Ces limites de consommateurs ne sont pas maquillées en succès fournisseur ni corrigées par une autorité concurrente dans T04.
- Le helper historique `generateAllScenes` sans contexte durable n'a pas d'appelant trouvé dans cette base ; ses appels LTX échouent avant dépense. Tout nouveau consommateur doit fournir un journal durable autorisé.
- Le workflow GitHub actuel ne déclenche pas de CI sur la branche T04. La CI de base T01 est documentée bloquée sur le credential SMARANA manquant ; aucun secret lu ni contourné. Le push T04 n'est ni une preuve CI distante ni une autorisation de déployer.

La seule étape d'intégration restante est l'acceptation de ce delta par le coordinateur sur sa branche ; aucune génération payante nécessaire pour cette acceptation locale.

# T04 → T01 — Salad accès et fournisseurs, 15 octobre 2026

Branche : `codex/sutra-t04-salad-access-20261015`. Worktree : `/Users/matissdornier/purama-worktrees/sutra-t04-salad-access-20261015`. Base intégrée confirmée `56754679abed9aa1e51323c29aed5bef38bc17d0` (candidat produit `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`, CI38677062190). SHA final transmis dans le miroir de coordination ; aucun push, merge ou déploiement.

## Livré

Un outil de saisie locale `getpass` pour les seuls `SALAD_API_KEY`, `SALAD_ORGANIZATION`, `SALAD_PROJECT`, avec lectures gratuites de quotas puis groupes avant sauvegarde atomique privée dans le master. Réutilise le lecteur Salad et tous les adaptateurs existants, sans nouveau moteur ni modification produit. Valeurs absentes des argv, de l'environnement enfant et des preuves. Aucune écriture du master ni requête authentifiée effectuée par T04.

**PASS : 27 nouveaux tests (21Python/6Node), lint, syntaxe et scan secrets ciblés.** Deux défauts de ce nouveau brouillon reproduits puis corrigés : remplacement multiligne partiel et perte de preuve HTTP lors d'un échec final. Rouge conservé. Aucun nouveau défaut démontré des adaptateurs intégrés.

**BLOQUÉ :** `SALAD_API_KEY` présente mais mal formée ; `SALAD_ORGANIZATION`, `SALAD_PROJECT` absentes. L'API publique ne découvre pas ces deux scopes. L'interface refuse Terminal et n'a pas de navigateur : saisie Matiss requise via le lanceur local `qa/t04-salad-access-20261015/Saisie-Salad.command`, Current API Key et noms techniques du [portail officiel](https://portal.salad.com). Ne jamais transmettre une valeur dans le chat. Aucun reçu de saisie terminée reçu.

**NON TESTÉ :** accès Salad réel, droits de création de groupe, crédits, image construite, CUDA/VRAM, génération, interruption/réplication réelle et facture. LTX auth/credits/génération non prouvés. RunPod health200, Shotstack stage/v1 templates200 et SunoAPI crédits200 sont les reçus datés du14octobre13:58UTC, non rejoués et non assimilés à une génération. Aucun FAIL résiduel des27tests, sans garantie « zéro bug ».

## Réutilisation et limites

89/90 fichiers vérifiés identiques au lot T04 `6ba23d4c31e4a511997b260ecb49e71ace293b2e` ; seul `scripts/test-t04-provider-fixes.mts` a été stabilisé par T01 et validé dans sa CI. Aucun changement de ce fichier ici. TypeScript, build et gates globaux inchangés réutilisés, pas de nouvelle gate globale. GitNexus LOW sur l'outil nouveau, index partiel/tronqué ; analyses finales conservées, pas de certification exhaustive.

LTX jobs, endpoints I2V/T2V/retake/extend, limites/rétention/prix et absence de webhook/cancel documentés relus. Arbitrary V2V et multi-références restent non annoncés. RunPod `/cancel/{id}` documenté, mais non exposé par l'adaptateur actuel ; aucun faux arrêt. SunoAPI est le tiers configuré, distinct de Suno officiel. Détails et liens officiels dans [README](qa/t04-salad-access-20261015/README.md).

La recette Docker intégrée `src/lib/salad/container/Dockerfile` est réutilisée sans modification : versions/digests/locks et contexte allowlist existants. **Recette disponible, image non construite, aucun GPU qualifié.** Worker LTX-Video0.9.8 T2V uniquement, pas LTX V2. La seule VRAM d'une carte ne démontre pas sa compatibilité, et0,09USD/h historique n'est pas un devis garanti.

## Ce qui reste avant l'essai payant, à autoriser séparément

1. Matiss : saisie locale masquée, deux GET de scope validés, master enregistré uniquement après succès. Aucune activation automatique.
2. T01 : builder Linux/image/digest, poids officiels et licences/SHA, journal PostgreSQL/TLS et rôle dédié, Gateway/auth/probes, devis total avec cold start et budget explicite, une réplique sans autoscaling.
3. Premier calcul de qualification du workflow canonique sur GPU autorisé, preuve réelle du seul profil mesuré ; puis un job HTTP distinct après manifeste réel. Deux calculs facturables à autoriser, récupération GET uniquement après intention/ID durable, contrôle média/SHA et provenance/coût. Arrêt ressource selon procédure autorisée. Éviction/réplication/OOM sont des essais ultérieurs, pas couverts par ce minimum.

Noms observés manquants : `SALAD_ORGANIZATION`, `SALAD_PROJECT`. Nom à remplacer : `SALAD_API_KEY`. Autres noms à vérifier par T01, présence non relue : `SALAD_ENABLED`, `SALAD_GATEWAY_URL`, `SALAD_WORKER_TOKEN`, `SALAD_QUALIFICATION_JSON`, `SALAD_QUOTE_JSON`, `SALAD_REQUEST_TIMEOUT_MS`, `SALAD_GENERATION_TIMEOUT_MS`, `SALAD_MAX_ESTIMATED_COMPUTE_USD`, `SALAD_WORKER_DATABASE_URL`, `SALAD_DEPLOYMENT_RECEIPT_PATH`, `SALAD_COMFY_URL`, `SALAD_BRIDGE_URL`, `SALAD_WORKER_PORT`. Groupe d'exploitation à sélectionner explicitement ; aucune création automatique.

Fichiers exacts : `qa/t04-salad-access-20261015/files.json` ; preuves/commandes : `proof.json`, `checks.json`, `python-tests.txt`, `node-tests.txt`, `python-red.txt`, `reuse.json`, métadonnées master expurgées et rapports GitNexus. Autres changements : ce handoff et seules sections propres ajoutées à `BATON.md`, `task_plan.md`, `ERRORS.md`. Produit/config/SQL/UI/OVH inchangés. Intégration/réception T01 non présumées.

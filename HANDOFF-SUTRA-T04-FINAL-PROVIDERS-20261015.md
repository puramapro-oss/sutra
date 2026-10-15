# T04 → T01 — fournisseurs et GPU distant, livraison locale du 15 octobre

Branche `codex/sutra-t04-final-providers-20261015`, worktree `/Users/matissdornier/purama-worktrees/sutra-t04-final-providers-20261015`. Base intégrée confirmée `49c166d4c15412d2a3c1246c216cf0df319f2df0`, produit testé T01 `3855665fa79e3cc2171124d864a834214d6ac617`. SHA de livraison : commit contenant ce fichier, reporté intégralement dans le miroir de coordination `T04-FINAL-PROVIDERS-20261015.md`. Aucun push, fusion, provisioning, déploiement, génération ou publication effectué.

## Delta et ownership

Nouveaux fichiers produit, tous dans `src/lib/salad/container/` :

- `Dockerfile`, `package.json`, `package-lock.json`, `requirements.txt`, `requirements.lock` : recette Linux/amd64 désactivée, bases par digest, ComfyUI par commit, dépendances exactes avec hashes.
- `launch.mjs` : un seul ComfyUI, bridge et host canoniques ; Linux seulement, attente de démarrage bornée, environnement enfant restreint, drainage avant arrêt, aucune relance de calcul.
- `health.mjs` : authentification serveur et schéma contrôlés ; `busy` reste sain.
- `prepare-context.mjs` : contexte limité à18 fichiers, sans secrets/modèles, manifeste SHA, refus d’écrasement/symlink.

Preuves, trois suites et lecteur GET Salad dans `qa/t04-final-providers-20261015/` ; inventaire exhaustif via `git show --name-only` et `proof.json`. Ce handoff et appendices propres `BATON.md`, `task_plan.md`, `ERRORS.md`. **Aucun fichier produit existant modifié**, y compris le README container historique ; la recette et ses limites actuelles sont documentées dans le README QA. Aucun fichier T03/T05/T06/UI/config/SQL/OVH touché.

## Vérification

- **PASS** :30 tests distincts hors ligne (15 lancement/sondes/arrêt,3 contexte/imports,12 lecteur Salad). Après verrou Python final,3 tests contexte rejoués, non additionnés.
- **PASS** : TypeScript ciblé du worker, lint des nouveaux modules, audits npm0avis et Python103dépendances/0avis/0ignoré. Scan secrets et revue GitNexus avant commit : preuves dédiées et limites dans `proof.json`.
- **Corrigé dans le nouveau brouillon** : deux sondes acceptaient HTTP200 sans schéma ; COPY incomplet de `media-probe.ts`. Reproduction10PASS/3FAIL puis13PASS, couverture finale15PASS. Deux avis PyTorch corrigés par la paire officielle2.13.0/0.28.0 ; CUDA13 exige qualification réelle ultérieure. Un échec de fixture Content-Type conservé et corrigé, pas classé défaut produit.
- **Réutilisé** :36 empreintes identiques des entrées des91 tests intégrés T04 ; quatre GET HTTP200 du14octobre13:58Z (RunPod endpoint health, Shotstack stage/v1 templates, SunoAPI crédit). Pas de nouveau test de crédit ou de génération ni répétition de CI globale.
- **BLOQUÉ** : clé Salad présente mais syntaxe master incompatible avec une valeur HTTP littérale sûre ; organisation/projet absents. Zéro appel authentifié Salad, aucun401 présumé. Docker/Podman absent, image non construite.
- **NON TESTÉ** : authentification LTX/Salad, génération/crédits actuels/facture, compatibilité GPU/VRAM, installation/imports CUDA, réplication/éviction/redémarrage réels, annulation distante. Aucun FAIL résiduel dans les tests exécutés ; cela ne certifie pas la production.

Contrats officiels et capacités exactes des cinq fournisseurs : [dossier détaillé](qa/t04-final-providers-20261015/README.md). RunPod cancel est documenté par la plateforme mais non exposé par l’adaptateur ; LTX cancel reste local. SunoAPI est tiers. Aucun webhook, V2V arbitraire ou référence générique affirmé sans preuve. Aucun fallback payant ni retry après ACK incertain.

## Activation restante — T01/utilisateur

1. Dans `~/.env.purama.master`, corriger **SALAD_API_KEY** en valeur littérale, puis fournir **SALAD_ORGANIZATION**, **SALAD_PROJECT** depuis [le portail Salad](https://portal.salad.com). Leurs noms ne sont pas énumérables par l’API publique. Choisir **SALAD_CONTAINER_GROUP** après lecture GET autorisée. Ne pas exécuter/décoder une expression du master ni transmettre ses valeurs dans le handoff.
2. À préparer seulement après preuves : **SALAD_GATEWAY_URL**, **SALAD_WORKER_TOKEN**, **SALAD_WORKER_DATABASE_URL**, **SALAD_QUALIFICATION_JSON**, **SALAD_QUOTE_JSON**, **SALAD_MAX_ESTIMATED_COMPUTE_USD**, **SALAD_REQUEST_TIMEOUT_MS**, **SALAD_GENERATION_TIMEOUT_MS**. Reçu de déploiement indépendant nécessaire. Ports/chemins sont fixés par la recette. Maintenir **SALAD_ENABLED** désactivé.
3. Autoriser un builder Linux, scan de l’image et acquisition des seuls poids officiels ; puis fixer image/digest, GPU/pilote, devis et budget d’arrêt. Aucun modèle/GPU précis déjà qualifié. Prix RTX3090 historique non garanti.
4. Plus petit essai : une réplique, qualification du workflow canonique sur le plus petit profil mesuré, puis un job HTTP du worker sur journal PostgreSQL externe. **Deux passages GPU distincts à budgéter explicitement**, aucun manifeste de qualification inventé. GET santé/capacités, un POST, polling du même ID, récupération média/SHA, reprise GET après coupure cliente, rapprochement facture, arrêt autorisé. Pas de nouvelle soumission après statut incertain.

Protocole complet, variables avec provenance, commandes reproductibles et limites : `qa/t04-final-providers-20261015/README.md` et `proof.json`. Réception/intégration T01 requise ; aucun ACK ni activation présumé.

# T03 — preuves orchestration et persistance, 14 octobre 2026

Base réellement intégrée T01 : `b7cf848d07fca2734db36a2e30d045ca312a3162`, produit `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`. Branche `codex/sutra-t03-orchestration-fixes-20261014`. Ce dossier concerne uniquement les nouveaux défauts ; les anciennes campagnes globales ne sont pas rejouées. Les reçus JSON fixent commandes, base et SHA-256 des sources.

## Reproduction → cause → correction

| Défaut démontré sur la base | Cause | Correction T03 / preuve |
| --- | --- | --- |
| Une fin demandée `done` accepte `failed`, `queued` ou `reconciliation_required` | `finishJob` vérifiait une liste de statuts plutôt que l'issue demandée | Reçu exact obligatoire ; seule la quarantaine SQL d'une remise en queue reste acceptée. Trois refus testés. |
| Fin/quota committés, ACK HTTP perdu : erreur définitive malgré résultat durable | Pas de lecture de réconciliation après RPC incertaine | Une lecture du job ; issue terminale exacte, verrou libéré, résultat présent ou musique explicitement omise. Aucun retry de mutation. PostgreSQL réel vérifie règlement unique. |
| Interruption entre checkpoint final et fin du job rejoue effets du pipeline | `runVideoJob` ignorait `progress.result` | Contrôles propriétaire/type/liaison vidéo + heartbeat, puis réutilisation du résultat final. Quatre kinds testés ; lease expiré/interdit refusés. |
| Visuel obtenu, log ou reçu scène échoué : résultat perdu | URL fournisseur conservée seulement en mémoire avant le reçu scène | Checkpoint distinct `scene:N:visual` avant opérations métier ; reprise du visuel acquis. Intentions et ID distants existants conservés. |
| Production `music` ou `all` accepte une musique obligatoire absente | Absence de garde de piste à cette frontière | `requireTracks` avant poursuite ; aucune génération aval ni succès ; `musicStyle=none` reste une omission explicite. |
| Auto voix reçue, upload interrompu : synthèse payante impossible à récupérer | Intention voix sans sauvegarde des octets | Réutilisation du manifeste/morceaux `voiceB64Checkpointed` opérationnel ; seul l'upload est repris. Anciens états ambigus restent en quarantaine. |
| Suno accepté puis attente interrompue : ID non disponible aux trois orchestrateurs | Port de persistance absent chez les consommateurs | Intention avant soumission, `music:suno` / `asset:music:suno` immuables, ACK attendu avant polling ; reprise seulement avec ID valide, GET côté T04. Sans ID durable, jamais de nouvelle soumission/fallback. |

`before-regression.log` : **20 PASS / 15 FAIL**, mêmes 35 assertions sur les six sources produit de la base. `before-suno.log` : **7 PASS / 12 FAIL**, mêmes 19 assertions sur les trois anciens consommateurs. Les résultats acquis et les refus déjà conformes sont conservés, les tests n'ont pas été remplacés pour obtenir le vert. Le baseline a utilisé les blobs Git de la base puis restauré les octets WIP propres en `finally`, sans reset/stash ni écriture étrangère.

## Résultats ciblés

| Preuve | Résultat | Commande exacte depuis le worktree |
| --- | --- | --- |
| Nouvelles régressions orchestration | PASS 35/35 | `python3 qa/t03-orchestration-fixes-20261014/verify.py regression` |
| Trois consommateurs du port Suno (fixtures) | PASS 19/19 | `python3 qa/t03-orchestration-fixes-20261014/verify.py suno` |
| Régressions touchées Salad + production | PASS 21/21 | `python3 qa/t03-orchestration-fixes-20261014/verify.py affected` |
| Auto/export et voix fractionnée 24 Mo | PASS 5/5 | `python3 qa/t03-orchestration-fixes-20261014/verify.py auto` |
| Transactions/concurrence PostgreSQL | PASS 6/6 | `node qa/t03-orchestration-fixes-20261014/postgres.mjs` |
| ESLint produit/tests | PASS, zéro warning | `python3 qa/t03-orchestration-fixes-20261014/verify.py lint` |
| TypeScript sur base sans lot T04 | FAIL, 8 diagnostics de dépendance | `python3 qa/t03-orchestration-fixes-20261014/verify.py typecheck` |
| TypeScript avec port T04, lecture seule | PASS 0 diagnostic, provisoire tant que T04 WIP | `node qa/t03-orchestration-fixes-20261014/typecheck-with-t04.mjs /Users/matissdornier/purama-worktrees/sutra-t04-provider-fixes-20261014` |

**Total tests : 86 PASS, 0 FAIL, 0 SKIP après correction.** Ceci n'efface ni les FAIL de reproduction, ni la dépendance TypeScript. Les tests de port remplacent uniquement le fournisseur, jamais la logique de checkpoints. Le compilateur supplémentaire redirige en mémoire deux lectures (`suno.ts`, `provider-response.ts`) vers les fichiers T04 ; aucune copie/import Git/écriture fournisseur. Son reçu indique empreintes, stabilité et correspondance au HEAD T04. Il qualifie les types, pas un pipeline fournisseur intégré.

Les six scénarios PostgreSQL utilisent les migrations existantes v10/v11 sur un cluster privé local Homebrew 18 et une base dédiée : douze réservations concurrentes pour un budget de un ; douze fins dupliquées avec réponse perdue ; douze candidats sur lease expiré et refus d'ancien checkpoint ; six courses annulation/fin ; rollback en l'absence du compteur quota ; omission explicite et libération unique sur échec. Le SQL n'est pas modifié. Échec/cancel libèrent via le compteur canonique `released`, pas `failed`. Le cluster propre est arrêté dans `finally`, ses données préservées ; aucun cluster partagé/distant.

`verify.py` n'hérite que PATH/HOME/TMPDIR, ajoute des valeurs synthétiques et charge le garde hors réseau existant. Secrets `.env*`, sockets et processus de génération sont interdits ; le harnais PostgreSQL n'autorise que loopback. Aucun maître lu, aucune variable réelle copiée, aucun moteur IA ou GPU. Un `fetch` non prévu fait échouer le test.

## GitNexus, sécurité et limites

Impacts exécutés avant édition : `finishJob`, `runVideoJob`, `executeCreateJob`, `executeProductionStep`, `defaultProviders` CRITICAL ; `generateAutoVideoAssets`, `voiceB64Checkpointed` et transport de test LOW. Avertissement utilisateur émis ; callers directs vérifiés. Index final et `detect-changes` joints. Le graphe tronque des entrées/branches : **exhaustivité UNKNOWN**, aucun faux certificat global.

`detect-changes.txt` : risque MEDIUM, trois flux touchés (GET → Run/Music/Script) cohérents avec les orchestrateurs. Complément direct : exactement six fichiers produit réservés et trois fichiers de tests, aucun fichier fournisseur/média/config. Gitleaks sur tout le delta préparé, logs de fixtures inclus : PASS, zéro fuite. Syntaxe des deux harnais Node et Python + lint des harnais : PASS. Les `.log` de preuve sont ajoutés explicitement malgré la règle générale d'exclusion des logs ; seuls leurs espaces de fin de ligne et lignes vides finales sont normalisés pour `git diff --check`.

Le nouveau port Suno est une dépendance **T04 + T03 à intégrer ensemble par T01**. La branche T03 seule sur b7cf848 n'est pas un candidat de release. Contrat attendu : `SunoJobState { taskId }`, `SunoJobPort { current?, onSubmitted(state): Promise<void>, timeoutMs?, signal? }`, `generateMusic(params, job?)`. Le provider garde la responsabilité HTTP/validation fournisseur ; T05 garde la validation/composition média. Aucun adaptateur ou validateur média modifié ici.

**BLOQUÉ intégration** : typecheck/build candidat complet et activation restent à T01 après les commits propriétaires. **NON TESTÉ** : fournisseur live, interruption GPU réelle, rendu/génération payants, production, publication. Selon le constat T01, aucun cron/worker SUTRA autonome actif sur OVH ; ce lot ne crée ni n'active un ordonnanceur. Une intention sans ID durable exige toujours réconciliation opérateur : pas de résultat inventé, pas de libération aveugle du budget, pas de fallback payant. La panne DB réelle est simulée localement ; elle ne constitue pas un incident distant observé.

La seule adaptation d'un ancien test est le transport GET de `test-t03-salad-recovery.mts`, nécessaire à la réconciliation terminale nouvelle. Toutes ses assertions sont conservées. Pas de gate globale/build identique, push, fusion, migration distante, déploiement ou secret.

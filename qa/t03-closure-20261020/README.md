# T03 — clôture différentielle du pipeline, 20 octobre 2026

**NACK propriétaire sur le candidat exact `79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a` : R107 est reproduit. Correction locale vérifiée, à intégrer par T1.** L'ancien ACK sur `ab935e59ca4e39776630f05b2ba6c0422c74ec62` ne couvre pas ce défaut. Branche `codex/sutra-t03-closure-20261020` ; le SHA du commit contenant ce dossier est transmis dans le miroir partagé T03-FINAL-DURABLE-20261015.md.

## Provenance et périmètre

`integration.json` confronte 18 fichiers pertinents du dernier ACK au candidat : moteur, file, états, checkpoints, annulation, journal de publication, migration canonique et dépendances identiques. Les anciens commits T03 sont donc intégrés au contenu réel. Les deltas T1 depuis cet ACK sont aussi listés : partenaire/stock/env/health/UI sociale, sans remplacement du moteur. Les preuves historiques restaurées dans `qa/t03-final-ack-20261019` proviennent de `fd8c92837b595cc51d60bb8ef74ff8ada565b4b8` ; elles restent explicitement des archives ab935, pas un ACK nouveau. Aucun adaptateur T4, média T5, publication T6 ou annulation T7 modifié.

Écritures produit : cron `src/app/api/cron/sutra-auto/route.ts`, helper `src/lib/auto-scheduler.ts`, migration et rollback `20261020_t03_auto_scheduler`. Aucun second worker/moteur. Les RPC `submit_video_job`, leases, quotas et identités existantes sont réutilisées.

## Reproduction et correction

- **R107, candidat79cd** : ticks à00h puis20h, programmation12h. Ancienne fenêtre now−1h/now+3h → zéro job au lieu d'un. `red/r107-red.log`, exit1 attendu ; cluster privé arrêté, quota0.
- **Correction** : curseur persistant par configuration, fenêtre (curseur,min(curseur+24h,now+3h)]. Sous un verrou SQL de configuration : CAS curseur/version, réservation et création via la RPC existante, avance du curseur dans une même transaction. Une réponse perdue n'entraîne aucun retry inline ; le tick suivant relit le curseur. La clé logique de l'occurrence demeure identique.
- **Défauts découverts dans le delta avant livraison** : UPDATE de curseur supprimé par trigger accepté ; planning historique invalide ignoré ; exception transport privée propagée ; état de reçu inconnu ou reconciliation_required accepté comme succès ; ancien droit INSERT permettant un curseur historique arbitraire. Reproductions `guard-red`, `receipt-red`, `reconciliation-red`, `insert-red`. Correction : RETURNING contrôlé, validateur canonique, erreur expurgée stable, allowlist exhaustive issue de VideoJob, résultat partiel explicite, initialisation DB obligatoire à INSERT.
- `green-1` échouait à cause du relais de test convertissant les timestamps PostgreSQL en Date et perdant leurs microsecondes ; correction du relais par `to_jsonb`, comme le contrat texte PostgREST. Ce n'était pas un défaut du CAS produit. Les journaux rouges sont conservés.

Une fenêtre rattrape au plus24h par tick ; l'arriéré donne `partial_failure/scheduling_catchup_pending`, sans avancer au-delà de la fenêtre validée. Un échec de quota annule toute la fenêtre : aucun trou ni réservation partielle, mais la progression attend une capacité disponible. Une configuration nouvellement installée, créée, modifiée ou réactivée commence à l'horloge DB courante ; aucun achat historique implicite. Les jobs déjà matérialisés restent intacts. Une désactivation n'annule pas silencieusement des jobs existants : utiliser l'annulation durable explicite.

## Tests autorisés et preuves

**134 cas distincts PASS, 0 FAIL restant dans ces sélections, 0 SKIP.** Aucun cumul avec les211anciens cas. La campagne `final` compte133cas ; seul le nouveau contrôle INSERT s'ajoute. Après la dernière correction SQL, les19cas de reprise/migration ont été rejoués dans `final-insert`, puis `final-rls` pour RLS propriétaire et portabilité du runner. Les114autres cas portent sur des sources et migrations inchangées depuis leur PASS.

| Risque | Preuve / résultat |
|---|---|
| R107,19 cas route+SQL : concurrence12ticks, ACK perdu, reçus invalides, SQL/quota,6jours de rattrapage, redémarrage PostgreSQL, DST, activation/édition, droits | `final-rls/recovery.log`,19PASS |
| Checkpoints aux10frontières, budget concurrent, musique échouée après vidéo, résultat invalidé, lease expiré, musique désactivée, annulation atomique, migration historique | `final/postgres.log`,14PASS |
| Backoff persistant ciblé/batch et tentatives épuisées | `final/backoff.log`,2PASS sélectionnés ; autres cas non revendiqués |
| Interruptions, résultats/final-media, checkpoints, file production, annulation T7/T1, contrat port WanGP simulé | `final/contracts.log`,62PASS |
| AUTO/export/publication par compte et consommateur cron T6 | `final/delivery.log`,37PASS ; aucun appel réel |
| Calendrier UTC/IANA/DST, doublons et bornes | `final/calendar.log`, assertions PASS |
| TypeScript et lint ciblés après dernier test | `quality.json`, deux exit0, lint0warning |
| Quotas et arrêt | `final/settle-*.log`, `final-rls/recovery-settlement.json`, tous reserved=0, deux DB restaurées soldées ; `pg-stop.log`/receipts |

Toutes les commandes détaillées et empreintes sont dans les `receipt.json`. HEAD y désigne la base79cd, les empreintes l'arbre local corrigé testé : **ces reçus ne rendent pas79cd vert**. Environnement synthétique filtré, PostgreSQL18 loopback, garde `qa/t08/offline.cjs` : réseau externe et lecture `.env` refusés. Aucun secret master utile ou lu. Zéro appel fournisseur/publication/GPU/modèle. Dumps privés uniquement synthétiques, hors commit, SHA256 dans `backup-manifest.json`.

Commandes reproductibles depuis le commit livré, avec un nouveau label (les dossiers existants ne sont jamais écrasés) :

```sh
node qa/t03-closure-20261020/run.mjs t1-integrated gate
node qa/t03-closure-20261020/run.mjs t1-scheduler-delta recovery
node --require ./qa/t08/offline.cjs node_modules/typescript/bin/tsc -p qa/t03-closure-20261020/tsconfig.json --pretty false
node --require ./qa/t08/offline.cjs node_modules/eslint/bin/eslint.js --max-warnings 0 src/lib/auto-scheduler.ts src/app/api/cron/sutra-auto/route.ts qa/t03-closure-20261020/recovery.test.mts qa/t03-closure-20261020/run.mjs qa/t03-closure-20261020/reproduce.mjs
```

`gate` utilise un cluster privé neuf, rejoue les groupes ciblés et solde ses réservations avant arrêt. `recovery` suffit pour un delta uniquement scheduler/SQL ; ne pas relancer les autres PASS invariants sans raison. Les binaires PostgreSQL sont configurables par `SUTRA_TEST_PG_BIN`, fallback local `/opt/homebrew/opt/postgresql@18/bin`, Node local26.0.0 (CI T1 utilise24, non revendiquée ici). Les dépendances existantes sont réutilisées. Aucune gate globale/build identique relancé ; CI39328438907 du candidat demeure une preuve T1 historique, pas celle de ce nouveau delta.

## Machine d'états et checkpoints

La file canonique demeure unique : `queued → processing → done/failed/cancelled/reconciliation_required`; `processing → queued` impose le backoff SQL. Claim atomique, lease expiré repris sans droits résiduels de l'ancien propriétaire, CAS et ACK contrôlés. Nouvelle intention : une réservation ; succès durable : une consommation ; échec définitif/annulation : une libération ; incertitude : conservation en réconciliation, pas de nouveau POST. Les tests soldent ensuite les fixtures, sans prétendre libérer une opération de production inconnue.

Les six états VideoJob sont compatibles avec les contraintes SQL. `compositing_failed` est refusé ; l'échec d'assemblage est `failed` et préserve ses checkpoints. La RPC génération protège les états sociaux existants. `ready/done` exige un export mesuré durable, URL finale distincte du brut, SHA256, dimensions/durée/fps valides et pistes requises. Le validateur média T5 est simulé ici ; aucune preuve d'objet distant réel.

Checkpoints existants indépendants : script, storyboard, scènes, images, voix, musique, sous-titres, composition, export, publication ; acquis par scène et IDs distants persistés. `skipped/null` pour musique désactivée, reçu obligatoire pour musique demandée. Un échec musique après succès vidéo ne recommence pas la vidéo. Résultat absent/invalide/invalidé et écriture SQL échouée empêchent la finalisation. Le journal T6 reste l'autorité par compte ; les succès partiels ne sont pas republiés et l'incertain est réconcilié avant toute tentative.

## Migration proposée, ordre et rollback

**Aucune migration distante appliquée.** Ordre minimal vérifié : tables canoniques sutra_auto + trigger updated_at → occurrence integrity20261006 → v10 → v11 → final durable20261015 → `20261020_t03_auto_scheduler.sql`. Migration partenaire20261019/rejeu/rollback exécutés dans la même DB : définitions/ACL/jobs durables inchangés. Les autres migrations T1/T2/T6 restent dans leur ordre intégré ; ne pas les retirer.

Migration nouvelle transactionnelle : colonne `scheduler_cursor timestamptz NOT NULL`, trigger INSERT/UPDATE de calendrier, RPC service_role seulement. Échec SQL/DDL = rollback entier ; garde de définition+COMMENT empêche d'écraser une version inconnue. Rejeu deux fois, sauvegarde pg_dump custom, pg_restore en seconde DB, comparaison données, rollback deux fois puis réapplication : PASS. Migration finale historique : égalité fonctions/ACL/contraintes et annulation/audit après restauration également prouvées par les4cas archivés réexécutés.

Avant une éventuelle opération réelle, **T1 seul**, après autorisation : backup frais de la DB et définitions/ACL, restauration testée, ordonnanceur arrêté ; appliquer avec ON_ERROR_STOP, vérifier état attendu puis application correspondante. L'installation initialise les configurations à sa date : tout arriéré antérieur doit faire l'objet d'une décision explicite, pas d'un UPDATE de curseur automatique.

Rollback proposé `20261020_t03_auto_scheduler.rollback.sql` : garder ordonnanceur arrêté, restaurer l'image applicative compatible, retirer seulement la RPC avec garde anti-drift. Conserver colonne, curseurs, trigger de calendrier, jobs/quotas/checkpoints et toutes les nouvelles écritures. **Ne pas réactiver l'ancien cron qui contient R107.** Réapplication corrigée requise pour reprendre. Un ancien dump ne doit jamais écraser les nouvelles lignes. Restauration complète objets/auth/runtime, version PostgreSQL production, backup actuel et charge réelle : NON TESTÉS.

## WanGP et limites

Contrat `ProductionProviders.visual` existant conservé. Deux tests du port : ID durable → reprise par consultation et12livraisons sans second POST ; intention sans ID après réponse perdue → réconciliation sans fallback. T9 doit fournir requête déterministe/clé stable, état distant durable, polling borné, erreurs/annulation explicites, validation T5 avant ready. Le journal actuel LTX/Salad et ses chemins SQL mutables ne sont pas un contrat WanGP validé : nouveaux champs/clés/version éventuels à proposer par T9/T4 à T1, sans se faire passer pour Salad. Aucun adaptateur créé.

**PASS local** : sélections ci-dessus, aucune régression T03 démontrée restante. **FAIL candidat79cd** : R107 ; les3défauts musique T4 sont livrés séparément par T04 dans a87fefe8a3c33d09bb1a09cc5d6b20fa85aaf451, sans ACK intégré ici. **BLOQUÉ** : ACK final d'intégration jusqu'à livraison d'un nouveau SHA T1 incluant les corrections et retest des seuls parcours affectés. **NON TESTÉ** : facturation/remboursement réel, GPU/fournisseurs, médias/stockage distants, comptes/publication, disponibilité/SLA et restauration production. Annulation applicative ne garantit pas arrêt ou remboursement d'un calcul distant.

GitNexus upstream exécuté : helper LOW/un appelant cron ; GET et SQL UNKNOWN faute de résolution exhaustive, recherche directe bornée. Graphe partiel/FTS indisponible explicitement conservé. Détection staged avant commit consignée séparément ; aucune certification exhaustive de graphe revendiquée. Produit limité aux4fichiers nommés, sans changement d'un autre propriétaire.


Contrôles de livraison : GitNexus staged signale CRITICAL,46symboles/184parcours (165fichiers au dernier passage), avec associations génériques de fixtures. Comparaison main globale :5643fichiers/3148symboles/421parcours, sortie bornée, impropre à certifier ce delta seul. Les4fichiers produit sont revus directement ; impact helper LOW, SQL/route UNKNOWN restent réserves explicites. Scan Gitleaks brut :198alertes expurgées, toutes des SHA256 de fichiers dont l'égalité est vérifiée avec les blobs courants/historiques (`gitleaks-classification.json`). Re-scan après remplacement en mémoire de ces seules empreintes vérifiées :0alerte (`gitleaks-verified.json`), aucun contenu de preuve modifié. Le diff-check global signale des blancs EOF dans les journaux bruts ; diff-check source/docs hors logs PASS. Les journaux sont préservés intégralement.

Dernier delta de preuve demandé par T1 : `SUTRA_TEST_PG_BIN=/opt/homebrew/opt/postgresql@18/bin node qa/t03-closure-20261020/run.mjs final-rls recovery` →19PASS. RLS owner : INSERT2000, DELETE+INSERT2100 réinitialisent à l'horloge DB ; un second utilisateur ne supprime aucune ligne et son INSERT est rejetée. L'UPDATE service_role/table-owner reste testé pour seeds synthétiques. Aucun parcours Linux CI n'est revendiqué avant exécution par T1.

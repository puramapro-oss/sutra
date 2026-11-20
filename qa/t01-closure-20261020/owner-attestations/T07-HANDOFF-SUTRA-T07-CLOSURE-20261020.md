# T07 — clôture technique bornée, activation bloquée

Candidat examiné : **79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a**. Branche de livraison : `codex/sutra-t07-closure-20261020`. Worktree : `sutra-t07-final-two-20261015`. Dossier : `qa/t07-closure-20261020/`.

**ACK propriétaire technique limité aux sources/preuves vérifiées ; NACK pour une activation autonome avec garantie de reprise sans perte.** R107 échoue encore sur ce candidat et reste exclusivement T03. Aucun fichier produit, moteur, SQL, configuration, dépendance ou composant d'un autre propriétaire modifié. Aucun second ordonnanceur.

## Vérification du candidat et des preuves

`verify.py` relit les 1188 blobs Git du manifeste T01 et les compare à leurs SHA256. Les sources ordonnanceur/annulation/création/queue, les anciennes migrations, les dépendances et les relais de test recensés sont identiques à ab935. Les deux attestations T07 archivées par T01 sont comparées au commit propriétaire `8becf38d5f5c35b706eee9061d47bf16d679c838` ; elles restent historiques et ne sont pas renommées en ACK du nouveau candidat.

Le vérificateur a terminé **1207 assertions de provenance PASS** (ce ne sont pas 1207 tests fonctionnels). Son premier essai a échoué sur le nom du champ historique `baseCommit` ; cette erreur du banc a été corrigée et le log initial est conservé.

Le delta intégré concerne notamment stock/Coverr (T04/T01), social (T06/T01), sécurité/scan (T02/T01) et séquencement du banc légal (T01). Le reçu de ce dernier correspond aux trois fichiers intégrés : 46 tests de barrière et 15 contrôles légaux par moteur. Revue directe : l'attente vise uniquement le GET exact de la bibliothèque de l'identité synthétique, après réception du corps complet, et échoue sur erreur/délai/document remplacé. Aucun filtre général d'erreur ou contournement du consentement ajouté.

Les reçus CI **39328438907** portent le SHA exact : trois jobs SUCCESS, TypeScript/lint/build PASS, 1261 contrats PASS/7 SKIP, 26 scénarios intégrés Chromium/WebKit, 118 contrôles garde/barrière, legacy 1022 PASS/25 SKIP/0 flaky. Le vérificateur conserve les chemins et empreintes des reçus centraux et les assertions contrôlées. Il s'agit de preuves CI existantes relues localement, pas d'une nouvelle exécution distante par T07. Pas de nouveau build global.

## Contre-test frais R107

Commande : `node qa/t07-closure-20261020/run.mjs recovery candidate-79cd`.

**2 PASS / 1 FAIL / 1 NON TESTÉ**, code de sortie1. PostgreSQL18 privé réellement redémarré une fois puis arrêté ; environnement synthétique et garde hors réseau/secrets existante. Routes, file et SQL canoniques ; session et transport Supabase simulés. Aucun worker, fournisseur ou publication appelé. Durée du banc : 3641 ms, Node26 ; ce n'est pas une mesure de latence utilisateur.

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Tick à 00h, occurrence prévue12h non préparée | PASS | zéro occurrence |
| Redémarrage PostgreSQL puis reprise20h | **FAIL R107** | occurrence12h absente, zéro tâche/quota |
| Doublons/retry/redémarrage après rattrapage | NON TESTÉ | dépend du rattrapage absent ; aucun faux PASS sur un ensemble vide |
| Absence de worker/provider/publication | PASS | compteurs tous nuls |

Cause inchangée : le handler lit de maintenant−1h à maintenant+3h ; à20h, midi est hors fenêtre. Le test exprime la garantie attendue et échoue réellement. Les reçus sont dans `candidate-79cd-recovery/`, avec exécution, arrêt PG et garde du périmètre dans les fichiers voisins.

Contrat T03 communiqué à22:52UTC, encore sans commit livré : `schedule_auto_video_jobs(p_user_id,p_from,p_through,p_updated_at,p_jobs,p_limit)`, colonne `scheduler_cursor`, CAS préservant les microsecondes PostgreSQL, arriéré borné24h/tick et état `scheduling_catchup_pending`. Le test doit utiliser la vraie RPC livrée et conserver `updated_at`/curseur en chaînes ; aucune adaptation sur son WIP.

T03 prépare un curseur durable/CAS et une RPC qui réutilise `submit_video_job`. Sa réservation du20/10 précise une initialisation au moment d'installation, sans rattrapage historique implicite. Aucun WIP T03 repris. Le contre-test futur devra appliquer la migration livrée dans une base jetable, positionner le curseur synthétique à00h, adapter explicitement le transport de la nouvelle RPC et vérifier la production de12h, les ticks concurrents et le second redémarrage. Le relais partagé actuel ne connaît pas ce contrat : ne pas obtenir un faux vert en simulant la RPC elle-même.

## Garanties déjà testées, bornes et état actuel

Les **32 contrôles locaux historiques** sur ab935 (11 création,12 ordonnanceur UI,9 simulation continue) restent distincts du contre-test actuel. Sources/fixtures identiques vérifiées ; résultats détaillés et empreintes relus depuis8bec. Pas de répétition inchangée.

- **PASS local historique / CI candidate** : configuration UI mobile375/desktop1440 ; quotidien, hebdomadaire, toutes les deux semaines, mensuel ; IANA et bascule automnale DST ; double clic, erreurs et retry ; annulation durable, audits et quotas libérés une fois ; réponses perdues, leases et checkpoints fournisseur conservés ; reprise après redémarragesPG ; concurrence et nombre de tentatives bornés. Les contrats sociaux CI couvrent les identités production/plateforme/compte, états partiels et non confirmés ; cet ACK ne remplace pas l'ACK T06.
- **PASS local historique** : 308 appels manuels du handler, 287 échantillons horaires sur12jours,16 occurrences uniques, huit redémarragesPG au total dans les trois bancs. Aucune exécution continue réelle, aucun service lancé. R107 démontre précisément une limite de cette simulation.
- **BLOQUÉ** : activation autonome fiable tant que R107 n'est pas corrigé/intégré/contre-testé. Runtime et DB OVH arrêtés selon reçu T01 ; aucune vérification distante nouvelle ni redémarrage par T07.
- **NON TESTÉ** : soak24/7 réel, quotas/coûts et concurrence des plateformes réelles, mois de quota SQL accéléré, vrai PostgREST/RLS distant, fournisseur réel, diffusion live autonome, Safari natif, appareil physique et lecteur d'écran. Les tests CI WebKit ne valent pas Safari natif.
- Une annulation locale empêche la reprise des tâches annulées. Elle ne prouve pas l'arrêt d'une requête déjà acceptée chez un fournisseur ; son reçu doit rester disponible pour réconciliation et un résultat incertain ne doit pas déclencher un nouvel achat/publication. Aucun prix, plafond monétaire ou gratuité illimitée inventé.

Anciennes mesures UI Next dev : sauvegardes110–139ms, médiane115,5ms ; aucune mesure nouvelle justifiant une optimisation frontend. Aucun avant/après fictif ni nouveau visuel déclaré validé.

## Conditions d'activation réelle — réservées à T01

1. Livrer/intégrer le correctif R107 et son contrat de curseur/rattrapage borné : concurrence, pagination, erreurs quota/RPC sans avancement perdant, pause/réactivation, changement de planning, DST, migration/rejeu/rollback et ACL. Contre-test T07/T08 sur le **nouveau SHA exact**, jamais transfert automatique de cet ACK.
2. Obtenir l'autorisation explicite de remise en service/promotion/activation. T01 coordonne la DB partagée, sauvegarde/restauration fraîches, migrations et rollback. Cet ACK n'autorise aucune de ces actions. Scheduler/dispatch restent désactivés.
3. Vérifier comptes connectés, consentements personnels, droits d'organisation, révocation/expiration et autorisations de publication. Conserver approbation humaine et preuve de média final vérifié. État fournisseur indisponible ou compte déconnecté doit rester bloquant.
4. Définir et vérifier les plafonds de coût, quotas, concurrence, ressources, délais, reprise et arrêt ; prouver réconciliation après réponse perdue sans resoumission aveugle. Une lecture d'authentification ne certifie ni génération ni disponibilité GPU.
5. Après autorisations séparées, effectuer un pilote contrôlé et une observation réelle. Ni les simulations ni un timer d'observation ne certifient un service24/7 ou un live autonome. Aucun de ces essais réels n'est exécuté ici.

## Reproduction

Le runner et le vérificateur refusent volontairement un HEAD différent du candidat79cd. Après livraison, utiliser un worktree de test séparé à ce SHA et y importer uniquement le dossier QA de ce commit ; conserver les dépendances identiques. Le préfixe de reçu doit être inédit, par exemple `node qa/t07-closure-20261020/run.mjs recovery reproduction`. Les anciens reçus ne doivent pas être écrasés. Le vérificateur de provenance est un reçu de clôture lié aux archives de coordination de ce poste, pas un test portable de CI.

## Livraison et contrôle de périmètre

Commandes et résultats définitifs : `qa/t07-closure-20261020/ACK-T07.json`, `verified-evidence.json`, `validation.json` et logs. GitNexus a été exécuté avant le nouveau banc et avant commit. L'impact du relais partagé est CRITICAL ; il est laissé intact. Après réindexation, `detect-changes --scope staged` signale **CRITICAL :29 fichiers,82 symboles,418 parcours** ; les exemples affichés remontent des propriétés homonymes telles que `email` jusque dans des écrans inchangés. Alerte conservée et signalée. Revue directe du diff : aucune source produit/SQL/dépendance modifiée ; ajouts QA invoqués explicitement et documents seulement. Comparaison historique main : CRITICAL sur5512fichiers, hors delta. Graphe tronqué (1371 entrées et871 callee exclus), FTS/BM25 dégradé : aucune exhaustivité ni requalification LOW revendiquée. La génération automatique du bloc AGENTS a été annulée à l'identique de HEAD ; les nouveaux skills générés non suivis restent hors livraison, sans suppression. Aucun secret lu, push, merge, déploiement, service payant ou publication réelle.

Gates QA : syntaxe, ESLint ciblé, périmètre, blancs source/docs et scan expurgé Gitleaks PASS. `git diff --cached --check` global retourne2 uniquement pour trois blancs finaux dans les logs bruts PostgreSQL/GitNexus ; ces preuves restent intactes et cette exception n’est pas masquée.

T01/T08 sont destinataires du miroir partagé `T07-AUTOMATION-FINAL-20261019.md`. Le SHA de livraison est communiqué après commit local ; aucune réception/lecture ni intégration n'est présumée.

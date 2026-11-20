# T01 — intégration finale SUTRA15octobre2026

État : sept lots intégrés localement, campagne exacte et revue T08 requises. Ce document ne certifie pas le runtime de production.

La liste des exigences, leurs propriétaires, correctifs, preuves et limites est dans [RECONCILIATION](qa/t01-final-20261015/RECONCILIATION.md). Les reçus integration-t02…t08 donnent SHA complet, base et fichiers importés ; terminal-preservation.json constate leurs commits propres et conservés. AGENTS.md et six skills étrangers sont exclus du commit et contrôlés par empreintes.

Candidat : identifié par le commit contenant le manifeste qa/t01-final-20261015/tested-source-manifest.json ; base49c166d4c15412d2a3c1246c216cf0df319f2df0. Runtime OVH observé86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164, https://sutra.purama.dev. Aucune migration de production ni promotion de ce lot à la rédaction.

Correctifs : signature privée après autorité/provenance ; terminal/checkpoints durables et ACK expurgés ; concurrence/délais FFmpeg ; revalidation OAuth et révocation idempotente/purge ; formulaires sociaux/auth/planning et historique sous-titres ; préparation conteneur Salad désactivée ; migrations droits clients et journal social ; gates de promotion et rollback exacts.

Tests : commandes intégrées .github/workflows/web-ci.yml et scripts/run-ci.mjs ; preuves ciblées exactes datées dans qa/t01-final-20261015. Les rouges historiques restent conservés. Les résultats de la CI exacte seront ajoutés séparément sans transformer les preuves auteurs en résultats intégrés.

Avant production : CI3jobsPASS, recette T08 du même SHA, candidat OVH isolé, backup frais/restauration vérifiée, application des trois migrations avec reçus exacts, snapshot protégé et rollback CAS. La commande autorisée reste python3 deploy/ovh.py deploy --source-ref SHA40 --ci-run RUN_ID --schema-ready --proof-dir qa/t01-final-20261015 ; SHA40 et RUN_ID doivent provenir des gates et ne sont pas des valeurs à inventer.

Non testé/bloqué : image et génération GPU Salad, génération facturée des fournisseurs, publication réelle et consentements personnels, Safari/iOS natifs, ordonnanceur continu, annulation durable via /create. Aucune activation payante ni contournement de consentement permis.

### T01 2026-10-15T03:34:44.387950+00:00 — delta QA profil/HEAD

CIa520114 FAIL conserve (deux gardes WebKit); app/SQL/config inchanges. Reproduction native du profil synthetique puis qualification strictement bornee, HEAD lecture classe separement et absence ecran erreur persistant verifiee.56controles harnais PASS/0FAIL/0SKIP, social10etnavigation4PASS par moteur sur diagnostic production isole. CI exacte nouveau commit attendue, original T08 requis; production86d04c8 inchangee. Aucune generation/publication/migration/deploy.

### T01 2026-10-15T04:11:50.419783+00:00 — recette exacte complète, promotion suspendue à T08

Candidat **d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2**, CI **38677062190 SUCCESS**, trois jobs PASS. Contrats955PASS/0FAIL/7SKIP ; legacy1022PASS/0FAIL/25SKIP ; vingt familles Chromium/WebKit PASS ; médias CPU réels17exports ; PostgreSQL/RLS et simulations livraison PASS. Résultats détaillés sans addition des recouvrements : [rapport final](qa/t01-final-20261015/README.md) et reçus ci-d21b7b4-tests/database/status.json. Les SKIP historiques et les sept alertes npm low/moderate restent affichés. Aucune nouvelle exclusion.

Les douze défauts de la matrice historique ont leurs corrections intégrées et contrôles T01 exacts PASS ; ceci ne réécrit pas le verdict indépendant T08. R66/R67/R72 restent NON DÉPLOYÉS. Production **86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164**, https://sutra.purama.dev, image/source/démarrage inchangés au contrôle03:40UTC. Candidat OVH d21 isolé construit et arrêté, cinq smokes/FFmpeg PASS. Aucun apply SQL/promotion de ce lot.

Prochaine étape : ACK indépendant du T08 original sur d21b7b4 et CI38677062190. Transport terminal indisponible (-32603), relais déjà demandé ; aucun accord inventé. Après ACK : revalider backup de moins de4h (actuel01:10UTC), manifeste, runtime et reçus SQL avant la promotion déjà autorisée. Aucun nouveau build complet sans delta. Salad reste désactivé (clé master malformée non envoyée, clé valide requise depuis https://portal.salad.com/). Consentements légaux/OAuth personnels requis pour les réseaux voulus ; aucun compte connecté automatiquement.

Sept livraisons intégrées/préservées, neuf worktrees auteurs/historiques propres et HEAD inchangés, sept empreintes WIP étrangères et1034fichiers du manifeste vérifiés. T02–T07 FIN_ECRITURE ; T08 attente revue exacte ; T01 intégré/testé, release bloquée externe. Aucun terminal fermé ni FERMABLE global présumé. Secrets non affichés, aucune dépense/génération/publication.


## T01 — 2026-10-15T15:02:31.852012+00:00 — consolidation c7 et CI exacte verte

Candidat **c7a7ebd876d36c521b1c30f6d487b7bb07f000a8**, CI **38750974353 SUCCESS** : quality/contracts/disposable-database PASS. Rapport courant : [consolidation finale](qa/t01-promotion-20261015/README.md). Commandes et reçus exacts ci-c7a7ebd-completed/quality/database/contract-counts.json. TypeScript/lint/build PASS ; contrats990PASS/0FAIL/7SKIP historiques ; legacy1022PASS/0FAIL/25SKIP historiques ;20familles navigateur PASS. Compteurs recouvrants non additionnés. Audit production seuil high PASS,2low/5moderate conservés. Aucune exclusion nouvelle.

Sept livraisons intégrées et WIP préservés ;1074fichiers manifeste et7empreintes étrangères inchangés. Dernière recette T08 indépendante99ad7a5 :112PASS sur parent72f, pas encore de certification différentielle c7. Nouveau SHA et CI verte transmis au handoff commun ; contrôle automatique Terminal refusé par outil, relais demandé. **INTEGRE / TESTE / PROMOTION BLOQUEE PAR ACK T08 EXACT ABSENT**. Aucune nouvelle autorisation de déployer demandée et aucun ACK inventé.

OVH reste **86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164**, https://sutra.purama.dev, healthy/zéro restart au contrôle14:50UTC ; accueil/login200 TLS vérifié. Image candidate c7 isolée construite et arrêtée,5smokes/FFmpeg PASS. Trois migrations prêtes, non appliquées ; snapshot13:21UTC,141tables restauration/comptages PASS, gate fraîcheur jusqu'à17:21UTC. Aucun changement runtime, cron/observer ou DDL de ce lot. Commandes apply/deploy/rollback conditionnelles dans le rapport. Après ACK exact : vérifier fraîcheur backup et état attendu avant suite séquentielle ; ne pas répéter les suites vertes inchangées.

R30 ordonnanceur autonome et R74 annulation UI durable restent absents. Salad désactivé, clé master malformée au dernier contrôleT04/org-projet absents ; aucune dépense/GPU/publication. Consentements personnels, génération réelle, appareils physiques/SLA/DR complet restent non testés. Aucun terminal fermé.

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

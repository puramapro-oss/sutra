# T06 → T01 et T08 — recette sociale finale

Claim `SUTRA-T06-20261016:FINAL-F360`, branche `codex/sutra-t06-social-f360-20261016`, base T01 `f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5`. Commit local de ce handoff = livraison QA ; SHA40 transmis dans le miroir commun après commit. Sources sociales inchangées, aucun nouveau correctif produit requis par les preuves.

- **PASS** : intégration exacte révocation `3edae7a` et autopilot `b8a5a3b`, 46 empreintes sources et 3 blobs livrés conformes. CI exacte 38809803219 : 213 cas sociaux nominatifs PASS, IANA/publication non TAP PASS, job PostgreSQL privé PASS, lint/TS/build PASS. Aucun rerun local prétendu.
- **FAIL** : CI quality, deux harnais repris exclusivement par T01. Sous-ensemble social/planning Chromium+WebKit : 71 PASS/1 FAIL (WebKit reload, garde runtime notifications). Ses cinq comportements reload passent, sans annuler le FAIL. L'autre échec est Chromium private-download.
- **BLOQUÉ** : clôture globale sur successeur SHA/CI T01, aucune permission d'intégration/déploiement supposée. Pas de nouveau code T06 à importer ; les corrections précédentes sont déjà intégrées.
- **NON TESTÉ** : consentements/grants réels, chiffrement et rotation des tokens chez Zernio, appartenance distante à une organisation, révocation réelle, publication réelle et runtime autonome. Le modèle est utilisateur UUID → profil Zernio, pas organisation native.

Fichiers livrés : `qa/t06-final-f360-20261016/**`, ce handoff, append propres à BATON/task_plan. Détails, commandes, empreintes et limites : [rapport QA](qa/t06-final-f360-20261016/README.md). Matiss : [trois étapes personnelles](qa/t06-final-f360-20261016/PARCOURS-MATISS.md). Aucun secret lu, clé demandée, compte connecté, provider payé, publication, push, fusion, migration ou déploiement.

T02 : contrôles session/profil, erreurs expurgées, absence de tokens locaux conformes aux preuves ; custody/rotation distante non certifiée. T07 : UI comptes/config/révocation/planning vérifiée via CI optimisée, frontière garde notifications détenue T01 ; aucun fichier UI édité T06.

# T06 → T01/T08, frontières T02/T07

Branche `codex/sutra-t06-integrated-retest-20261015`, parent `3edae7ae1d3c13ed2b385a9602a9ad8da6ca5b6d`. Candidat relu `cb3f893c35599a6c9c50a4d23c82013c10c5f3ae`. Le SHA du présent commit sera inscrit dans le miroir partagé après commit.

**PASS : lot OAuth/publication et SQL T06 antérieur intégrés. Nouveau delta local corrigé, intégration T01 attendue.** Ne pas réappliquer 3edae7a ni la migration corrigée. Le seul fichier produit du nouveau commit est `src/app/api/social/autopilot/route.ts` ; sources QA/docs sous `qa/t06-final-integration-20261015/`, ce handoff et append BATON/task_plan.

- Correctifs : diagnostics privés GET/POST retirés ; plateformes dédupliquées en conservant l'ordre. Rouge23tests12PASS11FAIL → **23PASS0FAIL0SKIP**, TypeScript ciblé/lint PASS. Logs avant/après et commandes exactes conservés.
- Preuves antérieures rapprochées à la CI exacte38797929920 : **76OAuth +92publication +22auto/config** PASS sans skip dans ces groupes ; IANA/DST et auto-publication PASS ; PostgreSQL history/CAS PASS. Aucun rerun local des suites invariantes, aucun build global parallèle. Les22auto/config ne couvraient pas social/autopilot : le nouveau banc ferme cette lacune.
- Régression T07/T01 transmise : page settings/social charge uniquement accounts, attend un champ autopilot absent, affiche donc disabled/[] même quand la configuration API est active. Charger GET social/autopilot et conserver un état indisponible si échec. T06 ne modifie pas l'UI propriétaire. Reproduction navigateur reste à T07.
- T02 : aucun contrôle d'accès modifié ; vrai enforceAccountAccess conservé et testé absent/expiré/révoqué. Erreurs normalisées sans nouvelle journalisation. T01 conserve SQL/bindings/config/production.

Reproduire le **seul nouveau delta** : `python3 qa/t06-final-integration-20261015/run.py gate` (Node24 local, aucune variable secrète ; argv explicites dans gate-results.json). En CI, ajouter `qa/t06-final-integration-20261015/autopilot.test.mts` à la commande existante Node/tsx/module-mocks, sans créer un second harnais. TypeScript : projet QA fourni. Le build intégré du nouveau delta reste NON TESTÉ par T06, à la gate finale unique T01.

`qa/t06-final-integration-20261015/README.md` détaille la matrice, les preuves et limites. GitNexus impact GET CRITICAL461/POST UNKNOWN, index stale avec flux étrangers, contrôle detect_changes avant commit conservé : pas de certification exhaustive du graphe. Diff produit borné et tests ciblés servent de preuve locale complémentaire.

**BLOQUÉ** : intégration de ce delta et traitement UI par propriétaires, avant acceptation finale. **NON TESTÉ** : fournisseur réel, chiffrement/rotation Zernio, scopes accordés, organisation distante, déploiement et publication. Aucun compte connecté, aucun consentement, achat, appel payant, GPU, secret, push, fusion ou déploiement effectué. Le runtime ne doit pas être assimilé au candidat.

Seule intervention personnelle préparée pour Matiss : consentir aux comptes voulus depuis https://sutra.purama.dev/settings/social, puis vérifier le compte affiché ; détails dans `qa/t06-final-integration-20261015/PARCOURS-MATISS.md`. Aucun renouvellement de clé demandé.

Clôture locale : Gitleaks du patch stagé **PASS, zéro finding**, syntaxe Python et diff-check **PASS**. Le TAP rouge brut reste dans before-autopilot.log.gz ; copie texte normalisée uniquement en fin de ligne, empreintes dans log-normalization.json. detect_changes exécuté :17fichiers/6symboles/363flux, **CRITICAL**, associations étrangères et index stale ; exhaustivité **UNKNOWN**. Aucune certification globale du graphe. Reçu closure.json.

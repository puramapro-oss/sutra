# T01 — clôture intégrée du 20 octobre 2026

Base exacte : `79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a`, descendant de `ab935e59ca4e39776630f05b2ba6c0422c74ec62`. Nouveau SHA après commit et CI/ACK dans le registre partagé `T01-CLOSURE-20261020.md`. Les reçus précommit portent le HEAD de départ ; le manifeste de sources relie leur contenu au candidat. Aucun ACK ancien transféré. **Intégration locale testée ; certification finale et production non acquises.**

## Livraisons

| Responsable | Commit livré | Décision |
|---|---|---|
| T02 | `5fcfd7868553ebaa3605d6b81b11c4ecca3e1c54` | QA seule, attestation bornée 79cd archivée ; nouveau contre-avis sécurité demandé. |
| T03 | `5fbdb238aceaf2c2ef937e7ebbedd692eadb282c` | Cron, helper, SQL/rollback R107 et preuves importés à blobs exacts. |
| T04 | `a87fefe8a3c33d09bb1a09cc5d6b20fa85aaf451` | Stable Audio, Riffusion et contrat d'erreur durable importés à blobs exacts. |
| T05 | `c63464a171ecf6e2dd35b1c4a604083aaa1a424e` | QA seule ; export/média inchangés, attestation originale archivée. |
| T06 | `773fafef461776c30da81b8bb64832be0419a1bf` | Page sociale et QA importées ; harnais ensuite adapté par T01 pour deux moteurs sur un build. |
| T07 | `2f94037e551140b51894da4f41bf67a3ed15f364` | QA seule, NACK R107 sur 79cd conservé ; contre-test demandé après nouveau SHA. |
| T08 | `6b9b549c99af48675b0b4ab65bad2399ddd0701f` | Matrice indépendante 79cd archivée : 119 exigences, 89 PASS / 12 FAIL / 6 BLOQUÉES / 12 NON TESTÉES. Ce n'est pas la certification de ce nouveau code. |

Parents 79cd, branches et états vérifiés dans `owner-states.json`. Les trois reçus `integration-t03/t04/t06.json` relient chaque blob à son auteur ; aucun conflit entre ces périmètres. BATON/task_plan propriétaires conservés dans leurs commits, jamais écrasés. T07 conserve six fichiers GitNexus non suivis. Les 3108 chemins WIP historiques T01 restent byte-identiques (`wip-preserved.json`). Les 1160 chemins du manifeste ab935 sont conservés ; différences expliquées par `manifest-delta.json`, aucun fichier manquant. Les cinq ancêtres protégés restent dans l'historique.

ElevenLabs `6d7d75a` était déjà intégré depuis f1849c0 : blob `ea5fcdfca79859e79c7bac9dea85eb0dfe78a2c0`, aucun deuxième correctif. L'ancien HTTP401 de clé ne devient pas un défaut de code ou une validation actuelle.

## Défauts corrigés et limites

- **R107, T03** : curseur SQL brut, verrou/CAS, jobs/quota/curseur atomiques via RPC existante, reprise bornée de 24 h par tick ; pas de deuxième soumission après ACK perdu. Horloge DB lors création/édition/réactivation, aucun rattrapage payant historique implicite. Retest PostgreSQL réel privé : 19 PASS, dont reboot, douze ticks concurrents, ACL/RLS, DST et rollback.
- **Musique, T04** : un résultat Stable Audio en cours n'est plus accepté ; corps d'erreur expurgé ; contrat Riffusion imbriqué lu ; id/statut/incertitude conservés, sans retry POST ni fallback payant implicite. Contrats gratuits uniquement, aucune musique réelle produite.
- **OAuth UI, T06** : garde synchrone contre double POST, délai dix secondes/récupération manuelle, abandon lors démontage, callback allowlist et alerte persistante. Aucun compte connecté ni publication réelle.
- **Titre création, T01** : catalogue `create.title` existant utilisé. Sous-titre prudent conservé ; aucune promesse de délai inventée.
- **R119, T01** : promotion refuse l'absence ou la divergence des preuves des migrations partenaire et ordonnanceur. Schéma/ACL/trigger/index vérifiés avant et après promotion ; backup périmé refusé. Voir `MIGRATIONS-ROLLBACK.md`. Aucune migration distante effectuée.
- **Banc navigateur, T01** : les deux moteurs utilisent un seul build, chacun avec état de fixture initial, traces et captures propres. Première tentative Chromium 15 PASS puis WebKit bloqué par consentement de fixture déjà accepté : exit1 conservé. Correction d'isolation, aucun test supprimé ; nouvelle campagne 15/15 par moteur. Anciennes erreurs dev de navigation/hydration conservées, non reproduites sur ces parcours production ; pas de garantie générale sur tous les parcours.

## Vérifications locales

Node canonique 24.22.0 ; variables de fixture uniquement. Les groupes se recouvrent, ne pas les additionner.

| Commande | Résultat / preuve |
|---|---|
| `node scripts/run-ci.mjs contracts` | **1302 PASS / 0 FAIL / 7 SKIP** ; plus sous-processus durable18 PASS et schedule/composition/publication PASS. `campaign-contracts-scheduler.json`, journal canonique `test-results/ci/contracts/contracts.log`. |
| `SUTRA_TEST_PG_BIN=/opt/homebrew/opt/postgresql@18/bin node qa/t03-closure-20261020/run.mjs t01-integrated-node24 recovery` | **19 PASS / 0 FAIL / 0 SKIP**, PG18 privé arrêté, reçu dans dossier du label. |
| `python3 qa/t01-closure-20261020/verify_catalogue.py qa/t03-closure-20261020/t01-integrated-node24/receipt.json` | PASS : vraie requête catalogue sur même cluster privé, trois fonctions/tables et garde-fous validés, cluster arrêté. Aucun accès distant. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS, `quality.json`. |
| `node node_modules/eslint/bin/eslint.js .` | PASS, zéro erreur, 111 avertissements hérités. Harnais final lint ciblé PASS. |
| `node --test qa/t06-closure-79cd95b-20261020/callback-errors.mjs` | **6 PASS / 0 FAIL / 0 SKIP**. |
| `node qa/t06-closure-79cd95b-20261020/journeys.mjs --production --both-engines --out=t01-integrated-production-v2` | Build production PASS ; **15 PASS Chromium + 15 PASS WebKit**, zéro FAIL/SKIP, zéro erreur runtime inattendue ; fixture authentifiée, modes client/indisponible/prêt, reprise GET et annulation DELETE, OAuth simulé, axe375/1440 zéro violation. |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` | **77 PASS**, simulations de déploiement/rollback uniquement. |
| `python3 -m unittest discover -s qa/t01-closure-20261020 -p test_migration_promotion.py -v` | **5 PASS**, avec sous-cas de reçu invalide/catalogue/permissions ; premier test rouge avant correction conservé. |
| `python3 -m unittest discover -s qa/t01-consolidation-20261014 -p 'test_*.py'` | **25 PASS**, `consolidation.log`. |
| `test_salad_promotion` avec `SOURCE=qa/t01-consolidation-20261014` | **8 PASS**, `exact-promotion.log`, point d'entrée réel sous ports simulés. |

Sept SKIP contrats inchangés : quatre INSEE live, deux DB distantes, un OTS live. Aucun échec transformé en skip. Dépendances/lockfile inchangés ; installation propre, médias, suites invariantes et campagne complète exécutées par CI du SHA final, résultat à consigner hors candidat. La CI 39328438907 verte appartient à 79cd seulement. Pas de somme avec ses tests.

Captures WebKit social375 et Chromium création1440 affichées et examinées : contenu et états présents, pas de débordement horizontal détecté. Ceci n'est ni une recette Safari natif, ni un lecteur d'écran, ni un appareil réel. Les montants affichés dans ces captures sont des fixtures, pas une offre fournisseur.

## État distant et coordination

Aucune nouvelle sonde ou mutation distante dans ce lot. Dernière preuve RO du19/10 : application et Supabase OVH arrêtées, SHA installé ab935, URL `https://sutra.purama.dev` retournant404. Timer observateur actif mais dispatch OFF et données indisponibles ; aucun worker autonome opérationnel prouvé. Le dernier backup est périmé. La disponibilité actuelle reste à recontrôler avant toute action explicitement autorisée.

Pas de secret lu/affiché, achat, GPU, modèle Mac, appel IA payant, migration distante, push production, déploiement, publication, consentement personnel ou fermeture de terminal. L'état des fournisseurs reste celui des preuves T04 datées, pas une nouvelle authentification. Génération réelle, frais, GPU24Go, consentements sociaux, publication, restauration complète identités/sessions/blobs et SLA distant NON TESTÉS.

Après commit : publier le SHA exact aux sept propriétaires, attendre leurs ACK individuels et le verdict T08. Toute correction ultérieure invalide les ACK concernés. T09 ne reçoit aucune disponibilité tant que les réservations/ACK et les blocages de release ne sont pas réconciliés. Aucun transfert d'ownership ni fermeture.

GitNexus : impacts avant édition, graphe partiel ; détection staged/compare avant commit archivée. Une liste plafonnée ou un handler UNKNOWN n'est pas une preuve exhaustive. Revue directe des seuls fichiers d'intégration conservée.

Détection GitNexus staged : HIGH,62symboles/13flux ; comparaison main plafonnée. Entrées create/social/cron et fonctions génériques QA rapprochées, couverture partielle explicite. Aucun nouveau symbole produit édité après cette analyse.

Scan gitleaks staged expurgé : exit1,245alertes qualifiées individuellement (233valeurs SHA256 de reçus,12UUID d'idempotence synthétiques navigateur), zéro alerte non résolue. Ce n'est pas un exit0 du scanner ; classifications dans secret-scan-review.json.

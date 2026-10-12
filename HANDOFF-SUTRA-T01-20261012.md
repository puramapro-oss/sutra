# SUTRA T01 CHEF — sept reprises intégrées, 2026-10-12

**LOCAL_INTEGRATION_PASS / RELEASE_BLOCKED. Aucun nouveau commit déployé.** Le dernier mandat autorise commit/push et un déploiement OVH seulement si tous les contrôles critiques passent. Cette condition échoue : stockage média privé non livré, schéma OVH incomplet, domaine public HTTP 402. Aucune migration de production, aucun changement DNS, aucune publication ni aucun appel fournisseur payant effectué.

Branche finale unique `codex/sutra-t01-integration-20261012`, worktree `/Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012`. Base de cette reprise : `589732cb49959c1a576a3ba381b310cd594600ac`. Le commit contenant ce handoff est la livraison finale de code ; son SHA se lit avec `git rev-parse HEAD`. Manifest des sources, dépendances, configuration et preuves : [verification.json](qa/release-20261012/verification.json). Matrice courante : [MATRIX.md](qa/release-20261012/MATRIX.md). Les matrices et rapports antérieurs restent historiques.

## Collecte et préservation

AGENTS, POLITIQUE-GLOBALE, fichiers d’état, les deux LOCKS, handoffs, branches/worktrees, processus visibles et modifications locales inspectés avant écriture. Contrôle de politique : `POLICY_OK`. Claim courant dans les deux LOCKS : `SUTRA-T01-20261012:REPRISE-7-LOTS-RELEASE`. Aucun reset/stash/clean, aucune suppression de worktree, aucun arrêt de processus étranger.

54 entrées de worktrees recensées, dont T01 ; les 53 entrées étrangères conservent leur HEAD, état Git et hashes des fichiers suivis modifiés : [preservation-final.json](qa/release-20261012/preservation-final.json). L’entrée `/private/tmp/r2_sutra_claude_fix` reste absente/prunable, conservée et non inspectable. Le checkout canonique `renfort/r4-sutra-smart-split-double-effects@8ff4fd26bb85178eb239496ae171bbd8ea9a1afb` et ses six fichiers suivis modifiés restent inchangés. Aucun fichier WIP ou non suivi étranger repris.

`main` reste `a6568e81c108d911ff827756c9b0ab20c9ae1c97`. Les cinq références protégées sont toujours ancêtres de la branche finale :

| Référence | SHA vérifié |
| --- | --- |
| main demandé | `35c137fc0bc0bd5ff6e54c3ef44ef8b6e46b2fc5` |
| PR1 | `a322e53d046b02005b3e05b91f42083a5ca20b1e` |
| PR2 | `e1bdd1b5489721aef7b7b8a42e946e2dee1202e8` |
| correctif média | `05d164daafff3502ab764d852742f5e1bf17a8ca` |
| PR3 | `7088a0a3e733de8d2e85f3576bd86627127da369` |

## Sept livraisons vérifiées et acceptées

Chaque branche propriétaire est propre ; objet Git, HEAD propriétaire et SHA distant comparés. Les 1105 entrées SHA-256 des manifests propriétaires sont vérifiées sans divergence. Deltas calculés depuis leur base commune `589732c`, revus puis appliqués par chemins, sans merge/cherry-pick global. 329 chemins acceptés ; BATON/task_plan réconciliés par T01, gardes Vercel réunies. Les huit branches ont leur déploiement Git Vercel désactivé pour que le push ne déploie rien. [Inventaire](qa/release-20261012/deliveries.json), [comparaison des octets acceptés](qa/release-20261012/accepted-content-audit.json).

| Lot | SHA final propriétaire | Résultat intégré |
| --- | --- | --- |
| T02 | `0b8df4d348d29d6b98e3b4a3b3e0a6ba18099f46` | POST points refuse avant lecture/effet ; permissions SQL finales, droits de colonnes OAuth, 147 assertions SQL |
| T03 | `79b4b974773a21ab8c249f2a16ced08c7354a2bd` | Worker/lease SQL obligatoire ; ready exige étapes, scènes, pistes applicables et preuve média finale mesurée ; 12 tests PostgreSQL |
| T04 | `23d188d668af5708e87d43cf383d7f0259c3d636` | Journal avant POST LTX payant ; reprise concurrente sérialisée, pas de fallback dépensier sur état ambigu, conflit WAN typé |
| T05 | `09c1e4890951c0968aa699f20f0b3a3ece666f8e` | Validation native/enhanced/voix/musique, provenance complète ; hash/taille des octets uploadés égaux à la preuve |
| T06 | `b2ec2eca250948fdb1012ada36829c0296ccab4e` | Revalidation compte/profil/approbation après claim avant publication ; réponses ambiguës conservées en réconciliation |
| T07 | `4993feb9b95196200ac611203285da3ed9842a5b` | Ref synchrone anti-double export ; abort et réponses obsolètes ; navigation utilisateur préservée ; recherche stock cohérente avec le script |
| T08 | `a5ac45b8e8e237244b896a94a6d8b3ade0450987` | Garde fichiers/réseau, 14 tests redteam et six scénarios navigateur adversariaux ; rapports historiques conservés |

Aucune divergence d’octets sur les chemins acceptés T02–T07. Trois ajustements T08 assumés : runner sans cache Google Fonts, extension navigateur avec le scénario respiration T01 et horloge isolée, README courant. Les preuves historiques des sept lots restent intactes.

Raccords T01 : police Space Grotesk embarquée avec licence/provenance/hash, `next/font/local` pour le build sans réseau ; écran respiration cohérent avec le refus sécurisé T02, sans POST points ni XP annoncé ; CI exécute redteam et browser-redteam. PR1/PR2/PR3 et `05d164d` conservent les contrats déjà réconciliés à589 : calendrier/DST, persistance asynchrone, deux probes médias distincts et publication par destination.

## Commandes exactes et résultats frais

macOS arm64, Node24.21.0, npm11.12.1, PostgreSQL local18.4. OVH utilise PostgreSQL15.8 ; la CI prévoit16. Ce sont des environnements distincts. Préfixe local équivalent aux appels du binaire absolu exécutés :

```sh
SUTRA_NODE=/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node
```

Toutes les commandes suivantes partent du worktree final. FFmpeg/ffprobe proviennent des dépendances T05 existantes, exposées par les symlinks `test-results/media-bin` ; aucune dépendance étrangère modifiée. Les tests applicatifs utilisent environnements synthétiques et garde réseau T08. Seuls les audits gratuits et contrôles OVH en lecture/sauvegarde ont joint des services externes.

| Commande | Résultat frais |
| --- | --- |
| `PATH="$PWD/test-results/media-bin:$PATH" "$SUTRA_NODE" scripts/run-ci.mjs contracts` | 466 PASS, 7 SKIP, 0 FAIL sur473 ; schedule/composition/publication PASS |
| `PATH="$PWD/test-results/media-bin:$PATH" "$SUTRA_NODE" scripts/run-ci.mjs media` | 34 PASS, 0 FAIL : moteur local3 + composition/probe/décodage31 |
| `"$SUTRA_NODE" scripts/run-ci.mjs quality` | Typecheck PASS ; lint 0 erreur/111 avertissements ; build webpack197 pages PASS, sans cache/police distante |
| `"$SUTRA_NODE" qa/release-20261012/run-postgres.mjs --full` | 13 contrôles migration +12 tests pipeline PostgreSQL PASS ; cluster privé arrêté proprement |
| `LC_ALL=C "$SUTRA_NODE" scripts/test-security-rls.mjs` | 147 assertions PASS, droits SQL réels et double application des migrations ; cluster privé arrêté |
| `"$SUTRA_NODE" qa/t08/run.mjs redteam` | 14 PASS : 12 gardes fichiers/réseau +2 charges en mémoire |
| `"$SUTRA_NODE" qa/t08/run.mjs browser-redteam` | Suite complète PASS : 210 contrôles canoniques +7 supplémentaires ; 165 audits axe, 0 violation, 0 erreur navigateur |
| `"$SUTRA_NODE" qa/t08/run.mjs legacy-offline` | Suite complète : 1022 PASS, 25 SKIP, 0 FAIL, 0 flaky sur1047 |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` | 9 PASS ; transport SSH/Docker simulé |
| `actionlint .github/workflows/web-ci.yml` | PASS |
| `shellcheck tooling/git-askpass.sh` | PASS |
| `npm audit --omit=dev --audit-level=high --json` | PASS seuil high ; 0 haute/critique, 5 modérées et2 faibles OpenTimestamps résiduelles |
| `"$SUTRA_NODE" node_modules/eslint/bin/eslint.js qa/t08/run.mjs qa/t08/integrated/browser-extension.mjs` | PASS après isolation de l’horloge du nouveau scénario |

Les sept exclusions contrats sont quatre INSEE live, deux DB distantes et un OTS réseau. Les exclusions legacy restent détaillées dans son rapport. `test-connect.mjs` et `test-storage-video-proofs.mjs` nécessitent des secrets/mutations distantes ; non exécutés. Les wrappers déjà inclus ne sont pas recomptés. Aucun test mobile/appareil réel ni parcours navigateur complet sur DB réelle n’est revendiqué.

Diagnostic navigateur conservé : première exécution, les six scénarios T08 et la respiration passent mais l’horloge accélérée installée dans la page principale efface ses observations Performance API. Correction du harnais : contexte navigateur séparé, guard localhost, stockage synthétique, fermeture garantie ; la page principale conserve son horloge native. La nouvelle exécution complète est verte. Preuves avant correction : `qa/release-20261012/browser-before-clock-isolation/`. Captures respiration et landing affichées ; pas de validation visuelle exhaustive ni de média fournisseur réel.

Résultats bruts copiés dans `qa/release-20261012/evidence/`. Aucune preuve propriétaire remplacée. Tous les changements de code des lots acceptés sont couverts par la gate intégrée ; les preuves historiques ne sont pas additionnées aux résultats frais.

## OVH : lecture, sauvegarde et smoke gratuits

Hôte `144.217.14.210`, seul service SUTRA inspecté. Conteneur inchangé `purama-sutra`, image `purama/sutra:35c137fc0bc0-9d0c6671-envn1`, healthy. GET internes réels : `/`200, `/login`200, `/api/points`401 sans session. `/api/health` n’a pas été appelé car il contacte des fournisseurs. Aucune génération, publication sociale ou paiement déclenché.

Lecture SQL en transaction read-only : 133 tables SUTRA existantes. Manquent `video_jobs`, `video_quota_counters`, `social_publication_journals` et15 fonctions requises ; détail dans [ovh-schema.json](qa/release-20261012/ovh-schema.json). La table `public.social_accounts` correspond au contrat Zernio attendu. Le bucket `sutra-assets` est **public**. Aucun DDL ni changement de bucket effectué.

Sauvegardes autorisées créées dans `/opt/purama/apps/sutra/backup-t01-20261012-OXl8CklD/`, dossier0700/fichiers0600 :

- `sutra.dump` : 5079451 octets, SHA256 `452dd860599e2a63abfed92dc6645eddfccd0e040c3360915b4b451e206b92f5`.
- `public-social.dump` : 22282 octets, SHA256 `08048685ff23b18ac9139249463104bf475024db7ed3552befafa222a2183a56`.

Archives décodées intégralement avec `pg_restore --file=/dev/null`, sans afficher ni transférer leur contenu. Deux snapshots cohérents séparés, aucune garantie d’un snapshot transactionnel commun. Aucun restore dans une DB ; blobs Storage, auth et autres applications exclus. Ce n’est pas une qualification de restauration complète Supabase.

**URL publique non fonctionnelle** : `https://sutra.purama.dev/`, `/login`, `/api/points`, `/api/video/jobs/00000000-0000-0000-0000-000000000000` répondent HTTP402, serveur Vercel, sans cf-ray. DNS A `216.150.16.129` et `216.150.1.65` ; NS `viddy.ns.cloudflare.com` et `rita.ns.cloudflare.com`. Cloudflare fournit le DNS, mais le routage HTTP observé aboutit encore à Vercel. HTTPS direct OVH avec SNI SUTRA échoue à valider l’émetteur TLS (curl60/verify20) ; configuration Cloudflare/TLS complète non qualifiée. Aucun DNS modifié.

## Blocages et reprise nécessaire

1. **Code/contrat stockage privé** : `uploadToStorage` retourne une URL publique persistée par les jobs, médias et journaux. T02/T06 signalent explicitement le besoin d’une référence durable bucket/chemin/propriétaire et de signatures renouvelées après autorisation. Changer seulement le bucket ou persister une URL expirante casse la reprise immuable. Migration des références/objets existants et tests interutilisateurs nécessaires ; aucune équivalence inventée.
2. **Schéma OVH** : trois tables/quinze fonctions manquent. Ordre vérifié localement : v10, v11, publication journals, account permissions, puis final permissions T02 en dernier. L’interdiction précédente de migration de production n’a pas été remplacée par une autorisation explicite de DDL. Compatibilité des données et migration de production à qualifier/autoriser séparément ; ne pas passer `--schema-ready` dans l’état actuel.
3. **CI distante** : aucun secret de dépôt disponible au contrôle des noms ; `SMARANA_READ_TOKEN` manque. Run précédent38289517548 : trois jobs bloqués en setup, PostgreSQL16 démarre. Le nouveau push déclenche la CI ; résultat à joindre à la clôture. Aucun token lu ni source privée SMARANA copiée dans le dépôt public.
4. **Exploitation** : domaine sur Vercel402, chaîne TLS directe non qualifiée. Accès Cloudflare/configuration de l’origine nécessaires après résolution des autres contrôles. Docker local absent ; nouvelle image Linux non construite/déployée. Aucun rollback réel revendiqué.
5. **Fonctions S5 non livrées** : approbation budgétaire hybride, restauration des versions, logger/cron-runs ; le script édité ne régénère pas la voix. Ce sont des limites de produit explicites, pas des tests PASS.

Le déploiement n’a pas commencé : aucun rollback n’était nécessaire. Commandes conditionnelles exactes et limites d’automatisation dans [deploy/README.md](deploy/README.md). Le helper construit avant remplacement et restaure Compose en cas d’échec de santé ; un échec de smoke applicatif/public requiert aussi le rollback explicite. Ce mécanisme n’a pas été exécuté ni qualifié en production.

## GitNexus et contrôle avant commit

Impacts exécutés avant modification : plusieurs dépendances HIGH/CRITICAL signalées (média/pipeline/publication). Les raccords respiration et harnais sont LOW connus, certains composants restent UNKNOWN. Index T01 deux commits en retard, marqué TRUNCATED (929 entrées,519 callees,4 walks coupés) : jamais utilisé comme preuve d’exhaustivité. Diffs directs, manifests propriétaires et tests frais complètent cette preuve limitée.

`node /Users/matissdornier/purama/.gitnexus/run.cjs detect-changes --scope staged --repo sutra-t01-20261012 --limit 3000` exécuté : 410 fichiers,134 symboles,16 flux, risque CRITICAL. La sortie CLI ne développe que15 symboles/10 flux ; résultat dans `gitnexus-detect-staged.log`, non exhaustif. Portée revue directement, aucun chemin produit hors SUTRA.

Gitleaks8.30.1 sur le diff préparé : 31 détections brutes,31 SHA-256 sources vérifiés,0 non classée dans `gitleaks-triage.json` ; chaque empreinte signalée est vérifiée contre le contenu source au commit exact. Aucun secret/env lu. Les copies T01 des logs ont leurs espaces de fin de ligne normalisés ; originaux de test et preuves propriétaires inchangés. Licence de police conservée avec fins de ligne LF.

Le commit final ne modifie que le worktree T01. Push de la branche finale uniquement, sans force, sans toucher main ni branches propriétaires. Les claims racine/.coord seront clos avec son SHA et `RELEASE_BLOCKED`.

# T02 — contre-épreuve de sécurité du candidat intégré

Candidat testé : **f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5**.
Branche : `codex/sutra-t02-security-f36013a-20261016`.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t02-final-sha-security-20261015`.

**PASS contrôles de sécurité locaux exécutés ; FAIL gate finale du candidat ; BLOQUÉ pour le verdict final du prochain SHA T01.** Aucun nouveau défaut produit démontré par ces contrôles. Aucun produit, fichier OAuth/média/worker tiers, SQL ou dépendance modifié dans ce lot. Le commit ne contient que preuves et journaux T02. Il ne certifie pas la production.

## Intégration effective

Le correctif admin/webhook `6d4d72993c44233807d847228255a28dafdb1d30` est intégré : cinq routes et quatre fichiers de harnais comparés SHA-256, tous MATCH (`integration-check.json`). La reproduction historique 28 PASS / 10 FAIL est conservée dans `qa/t02-final-sha-security-20261015`; la contre-épreuve intégrée donne 38 PASS. Les corrections RPC production `8c416290ebdabe9b0e8a1fa9708f537c8c0a45f5` et révocation OAuth T06 sont également retestées. Ne pas réappliquer ces commits.

Le manifeste courant contient 847 fichiers sources/scripts/SQL/config/dépendances. Les tests s'exécutent sur HEAD exact, sans diff produit. Dépendances installées réutilisées en lecture seule, package/lock identiques, 1117 versions comparées. Le premier contrôle avait classé à tort le workspace link ESLint comme mismatch : reçu initial conservé, résolution via son entrée lock explicite dans `dependency-tree-check.json`. Aucun install/build global.

## Commandes exécutées et résultats

Node v24.22.0 ; environnement synthétique reconstruit, aucun HOME/master/.env transmis, preload réseau offline. Tests à doubles contrôlés ; PostgreSQL local jetable sur socket privé pour RLS/permissions. Aucun appel fournisseur ni publication.

```sh
SUTRA_EXPECTED_SHA=f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5 python3 qa/t02-final-integration-proof-20261015/run.py delta admin-webhook autopilot oauth publication boundaries cron ssrf routes rls write-permissions
SUTRA_EXPECTED_SHA=f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5 python3 qa/t02-final-integration-proof-20261015/run.py typecheck lint
```

Chaque `<groupe>.json` contient la commande exacte, le SHA testé, le résultat et le SHA-256 du log adjacent. Groupes recouvrants : ne pas additionner les comptes.

| Groupe | Résultat | Risque couvert |
| --- | --- | --- |
| delta | PASS 70, 0 FAIL, 0 SKIP | Diagnostics RPC/production, lookup propriétaire, auth/config |
| admin-webhook | PASS 38, 0 FAIL, 0 SKIP | Non-admin, sessions invalides, erreurs internes expurgées, webhook |
| autopilot | PASS 23, 0 FAIL, 0 SKIP | Diagnostic, authentification, validation, déduplication |
| oauth | PASS 76, 0 FAIL, 0 SKIP | State, session, usage unique, expiration, révocation, concurrence |
| publication | PASS 92, 0 FAIL, 0 SKIP | Autorisation sociale, validation et refus de publication (mocks) |
| boundaries | PASS 76, 0 FAIL, 0 SKIP | Sessions expirées, accès croisés utilisateurs, ownership et médias privés |
| cron | PASS 21, 0 FAIL, 0 SKIP | Secret absent, mauvais secret, rotation, absence de bypass |
| ssrf | PASS 61, 0 FAIL, 0 SKIP | URL internes/réservées, DNS, redirections, médias, transport OTS/worker |
| routes | PASS 10, 0 FAIL, 0 SKIP | Contrat des protections serveur |
| changed-boundaries | PASS 76, 0 FAIL, 0 SKIP | CAS planning, stock sans fallback, timeout corps Shotstack, contrats adaptateurs |
| rls | PASS 261 assertions | PostgreSQL réel privé, isolation et permissions sensibles |
| write-permissions | PASS 30 contrôles | Écritures serveur/client, grants et refus PostgreSQL |
| typecheck / lint | PASS / PASS | Cinq routes corrigées et harnais concernés |

Le groupe `changed-boundaries` est exécuté avec le même environnement/prefix du runner et les cinq fichiers exacts listés dans `changed-boundaries.json` : schedule-cas, stock-boundary, shotstack-boundary, contracts T04 et ltx-body. Il n'est pas une nouvelle commande persistée dans le runner. Pour toute reprise, utiliser le tableau `command` du reçu avec l'environnement `FIXTURE_ENV` du runner. Le runner copié est inchangé depuis la préparation `bafb01bf968ad1334f436f50ca8f292b88548d18`.

L'inventaire couvre 20 points d'entrée cron : 19 appels directs au mécanisme `assertCronAuth`, et `auto-plan` réexporte le handler protégé `sutra-auto` (`cron-inventory.json`). Aucun second système d'auth cron.

La CI exacte 38809803219 apporte en complément contrats 1199 PASS / 0 FAIL / 7 SKIP, groupe durable 18 PASS et PostgreSQL/history/révocation PASS. Reçus et hashes des artefacts T01 contrôlés dans `ci-reuse.json`. Pas de duplication des groupes PostgreSQL historiques qui réécriraient leurs reçus. Les sept SKIP historiques demeurent explicites.

## Dépendances et secrets

```sh
npm audit --omit=dev --json --ignore-scripts --registry=https://registry.npmjs.org
npm audit --json --ignore-scripts --registry=https://registry.npmjs.org
```

Commandes gratuites exécutées dans un environnement minimal, npmrc vides distincts et cache temporaire, sans install. **FAIL audit brut** : production 7 alertes (2 low, 5 moderate), total 30 (4 low, 8 moderate, 17 high, 1 critical). Avis inchangés par rapport au triage T02 précédent, égalité des objets `vulnerabilities` vérifiée (`dependency-reuse.json`). Aucun chemin API SUTRA exploitable démontré dans les usages examinés. Cela n'est pas une garantie universelle d'inexploitabilité.

`request`/OTS : ancien transport remplacé par le transport borné ; tripwires request/ECDSA/Bitcoin RPC retestés sans appel. `uuid` : utilisation v4, pas les opérations v3/v5 concernées. `proxy-addr` critique et `compression` relèvent de l'outillage LHCI, serveur non utilisé/exposé dans les configurations examinées ; risque conditionnel si exposé. Pins non majeurs possibles 2.0.8/1.8.2 à traiter par T01 propriétaire package/lock. Autres alertes dev concernent configurations ou archives non fiables. Triage détaillé conservé dans `qa/t02-rpc-security-20261015/README.md` et `dependency-reachability.json`, aucun changement massif aveugle.

Gitleaks règles par défaut, redaction 100 %, scan sources/scripts/SQL/config et preuves propres : un finding brut, exclusivement fixture synthétique `scripts/test-release-regressions.mts:41`. Reçu et triage hashé conservés ; aucune règle supprimée/allowlist ajoutée. Aucun secret réel identifié dans ce périmètre. Master et `.env*` jamais ouverts ; ce contrôle ne prouve pas l'absence de secrets dans toute l'histoire Git ou la production. Le scan final du diff est enregistré séparément.

## Blocage externe précis

**CI38809803219 FAIL sur f360**, confirmé par les hashes des deux artefacts T08/T01 (`ci-quality-blocker.json`) :

- Chromium `private-download` : scénario corps suspendu, `waitForResponse` dépasse 15000 ms.
- WebKit `social-reload` : pageerror de lecture notifications pendant navigation.

416 assertions navigateur PASS / 2 FAIL. Cinq étapes ultérieures ont été SKIPPED par orchestration, donc NON TESTÉES, pas cinq nouveaux échecs fonctionnels. T01 a réservé exclusivement les deux frontières de harnais/fixtures à 22:23 UTC. Aucun de ces fichiers n'est modifié ici. Nouveau SHA final et CI exacte requis ; aucun ACK global f360. La distinction défaut produit/harnais reste sous reproduction T01, sans présumer que le rouge est inoffensif.

## Limites restantes

- **NON TESTÉ** isolation entre deux organisations natives : aucune dimension organisation dans le modèle canonique identifié. Deux utilisateurs/profils fournisseur ne valent pas deux organisations (`organization-model.json`).
- **NON TESTÉ** ACL/storage réels, consentements/révocation fournisseur, rotation des clés réelles et production. Les tests OAuth prouvent les routes/contrats et la concurrence en base privée, pas un fournisseur réel.
- URLs déjà émises utilisables jusqu'au TTL (300 s), sans garantie de révocation instantanée. Rate limits en mémoire par processus, non distribués.
- En-têtes HSTS/CSP/nosniff/X-Frame-Options absents de la configuration candidate selon observation T01/T08 : absence seule sans exploit démontré ; configuration/proxy T01. Pas de CSP aveugle ajoutée.
- GitNexus rafraîchi, impact effectué, graphe partiel (candidats/chemins tronqués et résolution interlangages incomplète). Aucun symbole produit édité. `detect_changes` avant commit conservé ; ne certifie pas une couverture exhaustive.
- Aucun secret lu/affiché, fournisseur payant, GPU, connexion sociale, publication, push, fusion, migration ou déploiement.

## Reprise

T01/T08 sont informés par le miroir T02 canonique. Attendre le prochain SHA T01, comparer les blobs produit/dépendances/harnais à ce manifeste, puis retester uniquement le delta affecté. Les preuves invariantes ne doivent pas être rejouées en boucle. Ne pas qualifier PASS global avant traitement des deux rouges et rapprochement de la CI du SHA réellement final.

Contrôle avant commit : `detect_changes --scope staged` LOW,35fichiers/16symboles/0processus (avant ajout des logs), aucun symbole produit modifié. `detect_changes --scope compare --base-ref main` CRITICAL,4768fichiers/7338symboles/486processus sur toute l’intégration historique, listing plafonné ; ne décrit pas le seul lot T02. Avertissement transmis. Gitleaks diff préparé :53fichiers,0finding, règles par défaut/redaction100 (`gitleaks-staged-receipt.json`).

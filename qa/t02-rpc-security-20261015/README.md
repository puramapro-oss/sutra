# T02 — sécurité RPC et dépendances, 15 octobre 2026

## Verdict borné

**PASS local** pour le correctif `T02-RPC-02` et les régressions ciblées ci-dessous. **FAIL candidat social** signalé par T06, distinct de ces tests simulés. **BLOQUÉ** pour le retest après intégration : T01 doit importer ce lot et annoncer son nouveau SHA. Aucune affirmation de sécurité exhaustive ni de validation en production.

- Base réelle T01 : `56754679abed9aa1e51323c29aed5bef38bc17d0`, reçu du candidat produit `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`.
- Branche : `codex/sutra-t02-rpc-security-20261015`, worktree isolé `sutra-t02-rpc-security-20261015`.
- Unique fichier produit modifié : `src/app/api/production/route.ts`, bloc `catch` de `POST` seulement. T03 queue/submission, T06 OAuth, T05 médias, T01 package/lock/SQL/config inchangés.
- Réservations `SUTRA-T02-20261015:RPC-DEPS-RECHECK` et `:PRODUCTION` dans les deux LOCKS canoniques ; notification T01/T03 dans le miroir T02 avant modification.
- Six blobs de correctifs précédents comparés exactement aux commits auteurs et déjà intégrés : voir `integrated-fixes.json` (47f6896, 5822770, a01c7a2).

## Reproduire → cause → correction → régression

**T02-RPC-02 — diagnostic RPC/profil/worker exposé en HTTP et dans last_error.** Le correctif antérieur filtrait seulement `submit_video_job`. `claimJobByKey` pouvait encore lever une erreur incluant le diagnostic de `claim_video_job_by_key`; le `catch` de la route réutilisait librement `Error.message`, également pour `finishJob(..., p_error)`. Un diagnostic contenant un code métier pouvait aussi produire un statut 400/403/409 trompeur.

Nouvelle suite sur la vraie route, le vrai contrôle de session et les vrais helpers ; seuls Supabase et le worker sont des fixtures. Avant correction : **12 PASS / 7 FAIL**, `production-red.log`. Après : **19 PASS / 0 FAIL / 0 SKIP**, `production.log`, `production.json`. Le marqueur utilisé est synthétique, sans secret réel. Les succès 202, l'identité/plan dérivés côté serveur, les refus 401 avant I/O privilégiée, les codes publics exacts 400/403/409 et l'échec de confirmation durable 503 sont conservés.

Correction : liste exacte des codes publics avant réponse **et** écriture de l'erreur durable ; toute autre valeur devient `Generation indisponible`. Aucun détail arbitraire, préfixe, suffixe ou objet lancé ne franchit cette limite. Les contrôles d'autorisation et les helpers opérationnels sont réutilisés.

`fixture-invalid-request-id.*` conserve une première erreur de fixture (UUID invalide provoquant 400 avant RPC) ; ce n'est pas un défaut produit. La fixture a été corrigée, puis le test d'injection de plan renforcé pour exiger réellement 202 et un appel RPC avec identité et plan serveur.

## Tests exécutés et portée

Commandes exactes, codes retour, SHA de base et empreintes route/lock dans chaque reçu JSON. Node **24.21.0**, environnement reconstruit avec valeurs factices uniquement, aucun HOME/master/.env chargé. Dépendances du candidat réutilisées en lecture seule via symlink, même lock SHA-256. Aucun appel réseau fournisseur, aucun calcul IA/GPU, aucune génération facturée.

```sh
python3 qa/t02-rpc-security-20261015/run.py security cron rls write-permissions social-history typecheck lint
# Rejeu seulement après renforcement de fixture et isolation de la sortie des reçus SQL :
python3 qa/t02-rpc-security-20261015/run.py production social-history
```

`SUTRA_TEST_NODE=/chemin/vers/node24` permet de choisir Node sans lire de fichier d'environnement. Le défaut du runner est le binaire Node24 déjà installé sur ce Mac.

| Contrôle | Résultat | Risques effectivement couverts |
|---|---:|---|
| 20 fichiers ciblés, `security` | **PASS 252 tests** | Auth/session expirée/révocation, permissions serveur, deux utilisateurs, propriété de projet/média, grants privés, absence de secret, TTL/jetons, OAuth state/liaison/usage unique/expiration simulés, SSRF/réseaux réservés/redirections/DNS épinglé, moteur personnel propriétaire seulement, MIME/taille/médias malformés, erreurs RPC |
| `cron` filtré dans la suite release | **PASS 21 tests** | `assertCronAuth` existant, secret absent/dev/invalide refusé avant effet ; secret valide et rotation relue |
| PostgreSQL RLS local jetable | **PASS 261 assertions** | Rôles anonymes et deux utilisateurs, accès croisés, escalade de référence reproduite puis refusée par migrations canoniques, rejeu des migrations |
| PostgreSQL droits d'écriture | **PASS 30 contrôles** | ACL clientes bornées ; aucune base distante |
| PostgreSQL historique social canonique | **PASS 23 contrôles** | Ownership, provenance, écriture immuable, rôles inter-applications, pending revoke, rollback/replay ; ne couvre pas les deux nouveaux cas T06 ci-dessous |
| TypeScript ciblé route + nouveaux tests + dépendances de types | **PASS** | Sans build ni gate globale identique |
| ESLint route + deux nouveaux scripts | **PASS, 0 erreur / 1 warning existant** | `_requestId` inutilisé ligne108, hors hunk réservé ; pas de désactivation de protection |

**587 contrôles dans ces cinq groupes**, sans sommer les rejeux ni ajouter les 19 tests RPC déjà inclus dans 252. Le groupe `security` a précédé le renforcement de l'assertion d'injection ; les 19 tests de sa seule suite modifiée ont ensuite tous été rejoués avec succès. Le reçu social-history final utilise `evidence-output.cjs` pour rediriger uniquement les reçus de ce harnais vers le dossier T02 ; SQL et assertions T01 inchangés. Une première sortie locale a touché le reçu T01 de notre worktree isolé, restauré aux octets HEAD ; aucun diff étranger ni écriture dans le worktree T01.

`typecheck-fixture-missing-next.*` conserve le premier échec du banc (augmentation Next `fetch.next` absente faute de next-env généré). `framework.d.ts` charge explicitement les types Next dans le projet QA, puis TypeScript est PASS. Aucun code produit n'a été changé pour contourner une erreur de type.

## npm : inventaire complet et exploitabilité

Audit réseau gratuit du registre officiel, configuration npm vierge, sans jeton ni installation. Résultats bruts conservés, pas de `npm audit fix` ni override massif.

- Production : `npm audit --omit=dev --json --ignore-scripts --registry=https://registry.npmjs.org` → **7 alertes : 2 faibles, 5 modérées, 0 élevée, 0 critique**.
- Toutes dépendances : `npm audit --json --ignore-scripts --registry=https://registry.npmjs.org` → **30 alertes : 4 faibles, 8 modérées, 17 élevées, 1 critique**. Les sept précédentes sont incluses, pas additionnelles.
- Exit1 est le résultat attendu de la présence d'alertes, **ce n'est pas un audit vert**. `npm-audit*.json` et `dependency-inventory.json` donnent versions, chaînes, sévérités et URL des avis. Le premier lancement avec deux npmrc identiques a échoué avant audit ; reçu conservé, puis configuration corrigée.
- `dependency-reachability.json` consigne les recherches de chemins d'import/usages et les appels concernés. Les occurrences `request` de tables/commentaires/import i18n ne sont pas le module vulnérable.

| Famille / avis | Chemin examiné et décision |
|---|---|
| `request`2.88.2 → request-promise/core → opentimestamps0.4.9 ; [SSRF par redirection](https://github.com/advisories/GHSA-p8p7-x288-28g6) | Adaptateur OTS durci déjà intégré : remplacement permanent des méthodes RemoteCalendar/Esplora, HTTPS sur destinations bornées, toutes adresses DNS vérifiées et connexion épinglée, aucune redirection, tailles/deadline bornées. Nouveau tripwire sur `request.Request.prototype.init` : **0 appel** dans les flux OTS réels exercés. Aucun transport vulnérable accessible démontré dans ces usages. |
| `elliptic`6.6.1 → bitcore-lib8.25.47 ; [nonce ECDSA](https://github.com/advisories/GHSA-848j-6mx2-7j84) | OTS inspecte des transactions, ne signe pas avec une clé privée. Tripwire `ec.prototype.sign` : **0 appel**. BitcoinNode.callRPC également **0 appel**, verify utilise ignoreBitcoinNode. Pas de correctif amont annoncé pour cet avis ; ne pas inventer une version sûre. |
| `uuid`3.4.0 sous request et9.0.1 sous LHCI ; [bornes du buffer](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Avis portant sur v3/v5/v6 avec buffer/offset externe ; request importe v4 seulement et son transport n'est pas atteint. Aucun import uuid applicatif ni buffer externe identifié. |
| `proxy-addr`2.0.7, **critique**, via LHCI ; [IP usurpée avec trust proxy](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | Dépendance de développement ; pas de serveur Express SUTRA ni de configuration trust proxy utilisant ce chemin. Fallback LHCI sans trust proxy, non utilisé par scripts/CI SUTRA. Correctif2.0.8 disponible ; T01 propriétaire du lock peut appliquer un pin étroit avant usage exposé de cet outil. Pas de chemin d'authentification SUTRA exploitable démontré. |
| `compression`1.8.1 via fallback LHCI ; [fuite mémoire de réponse interrompue](https://github.com/advisories/GHSA-vc2v-76pw-4v95) | Mode serveur LHCI non configuré/utilisé ici ; **risque réel conditionnel si ce serveur optionnel est lancé**, écoute sans host explicite. Correctif1.8.2 à faire appliquer par T01 avant ce mode. Ne pas assimiler « dev » à absence de risque. |
| `braces`3.0.3 → micromatch/fast-glob → plugin/config ESLint Next ; [épuisement de pile](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Patterns venant de la configuration ESLint versionnée et chemins du dépôt, aucune entrée API identifiée. Pas de version corrigée fournie par cet audit. La revue des contributions/config non fiables reste nécessaire. |
| `basic-ftp`5.3.1 → get-uri/pac-proxy-agent/proxy-agent | Parser de listing FTP hostile dans outils LHCI/Puppeteer ; aucun flux FTP applicatif identifié. Ne pas utiliser de proxy/FTP non fiable dans ces outils. |
| `extract-zip`2.0.1 → @puppeteer/browsers → puppeteer-core/Lighthouse | Traversée de chemins via archives à liens ; outil d'installation de navigateur, pas d'upload ZIP SUTRA. Archives/installations hostiles non testées et pas de chemin client SUTRA identifié. |
| `tmp`0.0.33/0.1.0 → external-editor/inquirer/@lhci/cli | Symlinks ou paramètres chemin non fiables ; outils locaux interactifs, aucun paramètre HTTP transmis. Risque de poste/outillage distinct, non déclaré corrigé. |
| `sprintf-js`1.0.3 → argparse/js-yaml/@lhci/utils | Précision de format non bornée ; formats fixes du parseur CLI, aucun format client SUTRA identifié. |

Les 30 entrées npm, y compris les paquets signalés uniquement par propagation, sont couvertes par ces familles et l'inventaire machine. **Aucun nouveau chemin exploitable depuis les API SUTRA démontré** pour ces alertes après examen des usages et tripwires ; ce constat est borné, pas une preuve universelle d'inexploitabilité. Le retrait de LHCI inutilisé ou les pins étroits2.0.8/1.8.2 sont à décider par T01 dans son scope package/lock. Aucun faux audit clean, aucun downgrade d'opentimestamps vers0.0.0 proposé par npm, aucune modification parallèle du lock.

## GitNexus et limites d'intégration

Impact préalable `POST` par UID exact : **UNKNOWN**, aucun appelant HTTP résolu. Deux consommateurs HTTP vérifiés directement dans `useProductionGeneration.ts` ; signalement utilisateur avant édition. Index local **TRUNCATED** (limites de parcours), pas de certification exhaustive. `detect-all.txt` : un fichier/symbole POST, quatre flux, risque **medium**. Comparaison historique à main :3468fichiers/9344symboles/228flux, **CRITICAL/LISTING_CAPPED**, inclut toute la lignée et non ce seul lot ; utilisateur prévenu. Analyse staged finale conservée dans `detect-staged.txt`. Scan du diff staged avec les règles par défaut Gitleaks, environnement vierge et redaction100 : **PASS, aucune fuite détectée** (`gitleaks.json`, `gitleaks.txt`). Diff-check PASS. Les nouveaux tests absents de l’index ne sont pas certifiés par le graphe ; ils ont été exécutés directement.

- **FAIL extérieur au lot T02, reproductible par T06** : `T06-INTEGRATED-01` CAS de révocation compare timestamp JS au timestamp remplacé par trigger SQL ; `T06-INTEGRATED-02` ancien compte Zernio sans sutra_oauth_revision ne peut être révoqué et reste connected. Reçu T06 du15oct13:17UTC, PostgreSQL4PASS/2FAIL, commande `NODE24 qa/t06-integrated-retest-20261015/run.mjs history`. Correction helper T06, trigger SQL T01 ; fichiers étrangers non modifiés. Ces FAIL empêchent un PASS global de révocation malgré les tests simulés verts.
- **NON TESTÉ organisations applicatives distinctes** : aucune dimension organization_id/org_id/tenant_id ni table d'organisation native trouvée dans les migrations canoniques examinées (`organization-model.json`). Deux utilisateurs et deux profils Zernio croisés sont testés ; ne pas les présenter comme deux organisations applicatives.
- **NON TESTÉ** : configuration/ACL réellement déployées, base distante, comptes OAuth réels, rotation/révocation fournisseur réelle, stockage fournisseur réel, toutes chaînes d'exploitation possibles des outils dev. Les URL signées déjà émises restent valides jusqu'à leur TTL300s ; révocation instantanée d'une capacité déjà distribuée non promise.
- **BLOQUÉ retest après intégration** tant que T01 n'a pas fourni un SHA intégrant ce commit. Ne pas fusionner nous-mêmes, ne pas modifier son WIP. Commande minimale après vérification du SHA/lock : `python3 qa/t02-rpc-security-20261015/run.py production typecheck lint`; étendre aux seuls fichiers modifiés par l'intégration, notamment les deux cas T06/SQL sous leurs propriétaires.
- CI globale d21b7b4 fraîche déjà fournie par T01, non rejouée : ce lot n'est pas une nouvelle preuve build/navigateur complète. Aucun push, déploiement, migration distante ou publication effectué.

Les espaces de fin de ligne et lignes vides finales des sorties texte ont été normalisés pour `git diff --check` ; diagnostics, échecs, commandes et compteurs conservés.

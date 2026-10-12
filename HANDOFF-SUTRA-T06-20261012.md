# SUTRA T06 — autonomie sociale — 2026-10-12

**LOCAL_DELTA_VERIFIED / INTEGRATION_NOT_CERTIFIED.** Tests distants et DB simulés exclusivement. Aucune publication réelle, migration appliquée, API payante, opération distante, push ou déploiement.

## Identité et reprise

- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t06-social-autonomy-20261012`.
- Branche : `codex/sutra-t06-social-autonomy-20261012`.
- Base PR3 : `7088a0a3e733de8d2e85f3576bd86627127da369`, contenant PR2 `e1bdd1b5489721aef7b7b8a42e946e2dee1202e8`.
- Code, migration et tests : **`9906e2da01ac33e9069c75be9cbc1876bfe40c8a`**.
- `qa/t06/manifest.json` lie les 20 fichiers du lot à leurs objets Git committés et SHA-256 ; aucun payload lié à du WIP.
- Coordination et ownership inspectés avant création du worktree ; démarrage `POLICY_OK`. Principal et WIP étrangers préservés. Génération, jobs et checkpoints T03 inchangés.

## Comportements livrés

### Planification et occurrences

Règles PR2 conservées : fuseaux IANA, récurrences quotidiennes/hebdomadaires/bimensuelles/mensuelles et identité UTC d'occurrence. Validation stricte des heures et jours, définitions identiques dédupliquées, identifiants absents ou contradictoires refusés.

Simulations : Paris (heure absente au printemps, répétée à l'automne), Lord Howe (décalage de 30 minutes), Kiritimati (changement de jour), bornes temporelles, semaine de référence bimensuelle et premier jour sélectionné du mois. Pour l'heure répétée de Paris, le choix PR2 de l'occurrence UTC la plus tardive est conservé. Fenêtre de génération du cron et vérification d'unicité avant quota/enqueue préservées.

Le cron sépare génération et reprise de publication. Il réconcilie les publications partielles/en cours par lecture distante même après désactivation de la configuration automatique. Une configuration inactive n'autorise aucun nouvel envoi ni retry.

### Publication, comptes et historique

`src/lib/publication-journal.ts` conserve la requête et la clé d'idempotence immuables de chaque opération. Les destinations sont identifiées par **type de production, production, plateforme et compte externe exact**. Une révision CAS arbitre les prises en charge concurrentes. Le journal est indépendant des projections/historiques réparables et des lignes de production supprimables.

- Réponse perdue : même requête et même clé après le bail de 120 secondes, dans une fenêtre conservatrice de 24 heures moins 5 minutes. Au-delà, ou si une programmation perdue est déjà échue, réconciliation requise ; aucune nouvelle clé pour masquer l'incertitude.
- Identifiant distant connu : GET avant décision. Identifiant et ensemble exact des destinations contrôlés avant retry. Accepté/programmé/en cours ne signifie pas publié.
- Publication partielle : succès acquis conservés ; reprise des destinations échouées via le post distant existant. Un timeout du retry bloque sa répétition aveugle. Statut global publié seulement après confirmation de toutes les destinations.
- Compte absent/déconnecté/révoqué/expiré ou expiration invalide : destination refusée. Compte ambigu refusé. Aucun changement silencieux de compte externe après reconnexion ; la route classique accepte une sélection explicite par `accountIds` locaux appartenant à l'utilisateur.
- Révocation : statut local `revoked` avant appel distant ; ligne et historique conservés. Révocation distante non confirmée : HTTP 202, succès faux, retry possible ; 404 distant = révocation déjà effectuée.
- Historique : identités déterministes et upsert réparable après échec de projection. Identités PR3 existantes conservées lors de l'import.
- PATCH/DELETE : publications partielles/publiées, occurrences ou productions avec journal protégées contre réinitialisation/suppression. Transition concurrente vers `publishing` : HTTP 409 sans écrasement.

Publication classique : média propriétaire prêt/publié et reçu PR3 `sutraVerification` URL + SHA-256 obligatoires. Publication auto : job d'assemblage terminé appartenant à l'utilisateur, preuve URL/SHA-256 et autorisation applicable obligatoires. Média, configuration auto et compte relus avant envoi. Changement d'URL ou empreinte pour une production avec journal refusé : le succès de l'ancien export ne certifie pas le nouveau. Erreurs transport/JSON et logs Zernio sans message fournisseur brut.

Les résultats auto PR2 sans identité de compte suffisante sont conservés et signalés comme nécessitant réconciliation. Aucune identité inventée ni republication automatique de ces dossiers ambigus.

`publishAutoVideo`/`publishAutoVideoRecord` sont extraits dans `src/lib/auto-publication.ts`, réexportés depuis `sutra-auto.ts`. Les cinq premiers paramètres restent compatibles ; gateway injectable et mode lecture seule permettent simulations/réconciliation. `sutra-auto.ts` reste sous 300 lignes.

## Migration et intégration

`migrations/20261012_social_publication_journals.sql` ajoute `sutra.social_publication_journals` : clé primaire `(kind, production_id)`, propriétaire, révision, opérations JSON, date de modification. RLS activée ; droits retirés à PUBLIC/anon/authenticated ; SELECT/INSERT/UPDATE au service_role, sans DELETE. **Migration non appliquée. Contraintes, concurrence PostgreSQL réelle et RLS : NON TESTÉS.** Le mock vérifie les décisions applicatives et réponses CAS, pas le moteur SQL.

Contrat source des tables publiques consommées : **`sql/social-autopilot.sql`**, présent dans PR3, utilise des noms non qualifiés destinés au schéma public. Il décrit `social_accounts` (connected/expired/revoked/error, unicité user_id/platform) et `social_posts`. `migrations/audit_completion.sql` décrit d'autres tables qualifiées `sutra.social_accounts`/`sutra.social_posts` ; ne pas les confondre. Aucune base distante inspectée.

Points transmis aux propriétaires :

1. **T01** : intégrer depuis PR3, qualifier graphe et migration sur la base intégrée. Aucun changement de package/lockfile/scripts npm ; nouveau runner `scripts/test-t06-gate.mjs`. Dans `scripts/test-release-regressions.mts`, ne reprendre que le modèle et les assertions publication T06, en conservant les changements T03.
2. **T02** : rapprocher auth/OAuth et `profiles.access_revoked_at` des relectures applicatives et du journal service-only. La révocation conserve désormais compte et historique. Privilèges réels des tables publiques et migration à éprouver dans l'intégration autorisée.
3. **T02/T05/T01** : preuve PR3 URL + SHA-256 conservée. Contrat commun des médias privés (bucket/path/propriétaire stable, URL signée fraîche) encore à arrêter : les sources PR3 conservent des URL persistées. Le replay idempotent exige un payload identique ; renouveler une URL signée dans ce payload n'est pas un replay identique. Aucune politique de stockage public/signature certifiée ici.
4. **T03** : `video-pipeline.ts:triggerAutopilot` conserve son contrôle existant de configuration avant appel au helper. Les contrôles avant envoi ne constituent pas une atomicité distribuée entre révocation et POST distant. Génération/jobs/workers/checkpoints restent T03.
5. **T08** : audit consulté au commit `d3fcedf96b96c857670f82210454c1761eee49ec`, basé sur S5 `6a64fba103a084c71ecbfd1a07af53076af097c6`. Le PATCH concurrent écrasant `publishing` est couvert ici. Les constats ciblant `src/lib/autonomy/publisher.ts` ou `src/lib/autonomy/observability.ts` ne s'appliquent pas aux fichiers de cette base PR3 où ils sont absents ; ils ne sont pas déclarés PASS. T01 doit rapprocher les lignées.

## Preuves locales

Node **v26.0.0**, Next **16.3.8**, TypeScript **5.9.3**. Dépendances et configuration ESLint réutilisées en lecture seule depuis T01, liées au commit **`19ea35fbbfe99a978f119f3939ff9935362191dc`**. Package/lock/config T01 comparés à leurs objets Git et empreintes au manifeste. Ce résultat ne prouve ni `npm ci` sur le lockfile PR3 inchangé, ni la CI Node 24 T01.

Commande de gate :

```sh
node scripts/test-t06-gate.mjs /Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012/eslint.config.mjs
```

Le runner refuse un checkout avec fichiers d'environnement locaux, n'en lit aucun, retire les identifiants hérités de l'environnement des sous-processus et fournit uniquement des fixtures. Commandes exactes et codes retour initiaux/delta/finaux : `qa/t06/verification.json`.

| Vérification | Résultat et portée |
| --- | --- |
| Publication sociale | SIMULÉ — 23/23 PASS |
| Autonomie T06 | SIMULÉ — 30/30 PASS |
| Routes réelles, dépendances simulées | SIMULÉ — 9/9 PASS |
| Régressions release locales | SIMULÉ — 50/50 PASS |
| Total distinct final | **112 PASS, 0 FAIL, 0 SKIP** |
| Calendrier / helper publication | SIMULÉ — deux scripts PASS |
| Typecheck final | PROUVÉ localement — PASS, `tsc --noEmit --incremental false` |
| Build final | PROUVÉ localement — PASS, `next build --webpack`, 197/197 pages |
| Lint des 19 fichiers T06 | PROUVÉ localement — 0 erreur, 0 avertissement |
| Lint global | **FAIL** — 2 erreurs max-lines hors T06 : `src/lib/ltx.ts` (T04), `src/lib/production-pipeline.ts` (T03) |
| GitNexus impact / detect-changes | **UNKNOWN** — index format 43 incompatible runtime 42 |
| PostgreSQL réel / RLS / fournisseurs / médias privés / release intégrée | **NON TESTÉS** |

Provenance : gate initiale 110/110 ; deux cas ajoutés, seuls fichiers affectés rejoués (routes + publication 31/31, puis publication finale 23/23). PASS inchangés non rejoués. Lint global initial : 136 avertissements dont un T06 corrigé/revalidé ; aucun avertissement étranger revendiqué corrigé. Les 19 fichiers T06 sont couverts par le rapport initial et les reprises ciblées à zéro avertissement. Le runner conserve un code retour d'échec pour le lint global.

Journaux bornés : `qa/t06/`. Warnings Next middleware/proxy, Edge runtime interne et cache webpack présents, sans échec du build. Aucun runtime déployé certifié. `git diff --check` PASS sur le code committé.

Avant édition, impact des symboles concernés tenté ; avant commit, `detect-changes --scope staged --repo purama-master` tenté. Échec format de stockage 43/42 : risque annoncé UNKNOWN, aucun graphe partagé reconstruit. Détail : `qa/t06/gitnexus.txt`. Revue locale et tests ne remplacent pas la certification du graphe.

Contrats fournisseur consultés : [idempotence Zernio](https://docs.zernio.com/guides/idempotency), [erreurs/retry](https://docs.zernio.com/guides/error-handling). Fenêtre et réponses simulées ici, sans vérification en service réel.

## Prochaine action

T01 : intégrer les contrats et hunks compatibles avec T02/T03/T05, qualifier la migration, tester seulement le delta d'intégration. Les points ci-dessus empêchent une certification intégrée et n'autorisent aucune publication réelle. Aucun push, déploiement ou test distant autorisé par ce handoff.

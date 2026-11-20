# T06 — OAuth/social sur le candidat T01 f36013a

Base exacte : `f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5`.
Branche : `codex/sutra-t06-social-f360-20261016`.
Claim : `SUTRA-T06-20261016:FINAL-F360`, dans les deux LOCKS communs.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t06-integrated-retest-20261015`.

**PASS contrats sociaux simulés ; FAIL recette navigateur globale ; BLOQUÉ sur le prochain candidat/CI T01.** Aucun défaut supplémentaire du backend social démontré. Ce lot ajoute uniquement preuves, vérificateur et documentation. Aucun appel fournisseur, compte réel, consentement, publication, génération, lecture de secret, migration, push ou déploiement.

## Intégration des corrections

Le vérificateur compare 46 empreintes sources/entrées de tests et trois blobs livrés :

- `3edae7ae1d3c13ed2b385a9602a9ad8da6ca5b6d` : révocation après trigger SQL `updated_at`, confirmation à partir de la révision réellement persistée, sans second DELETE distant.
- `b8a5a3b91f56219ffffb61c134e10b03e732abcc` : route autopilot et ses 23 tests, erreurs publiques expurgées et plateformes dédupliquées. Défauts antérieurs : 12 PASS/11 FAIL, puis 23 PASS/0 FAIL ; ils ne sont pas de nouveaux rouges sur f360.
- La migration canonique d'historique correspond à la fixture PostgreSQL déjà exercée, SHA-256 `d2f6a9cb380a15285759085cdf602701f0d9d785d4a7f76f2061438d38ab9ddc`.
- La page sociale corrigée par T01 charge comptes et configuration via leurs GET distincts ; configuration absente/invalide/en erreur reste inconnue. T06 ne réédite pas cette frontière UI T01/T07.

## Preuves exactes, sans répéter les suites inchangées

[CI 38809803219](https://github.com/puramapro-oss/sutra/actions/runs/38809803219) exécutée sur f360 : jobs `contracts` et `disposable-database` SUCCESS ; `quality` FAILURE. Métadonnées conservées dans `ci-run.json`. Les artefacts déjà téléchargés par T01 sont lus sans duplication ; chaque log utilisé est rapproché de son SHA-256. `integration.json` conserve chemins, empreintes, commandes et noms des assertions.

| Risque | Preuve sur f360 | Verdict |
|---|---|---|
| State aléatoire, TTL 600 s, session/utilisateur/profil/navigateur, consommation atomique, expiré/refusé/rejoué | 76 cas OAuth et routes, dont neuf plateformes, changement de session/profil, callbacks concurrents ; générateur `randomBytes(32)` et cookie distinct | PASS mocks |
| Comptes absents, isolation, diagnostics, tokens locaux, déconnexion/reconnexion et révocation incertaine | Mêmes 76 cas ; projection sans champs privés ; tokens reçus non stockés, anciennes colonnes effacées ; révocation inconnue reste bloquante | PASS mocks |
| Scopes minimaux demandés | Les neuf parcours route→adaptateur exigent `scopes=posting` | PASS contrat demandé ; grants réels NON TESTÉS |
| Publication par compte, plateformes dédupliquées, `partially_published`, reprise ciblée | 92 cas publication ; succès historique conservé, identité/empreinte média vérifiée, compte non connecté explicite | PASS mocks |
| Réponse perdue, résultat distant inconnu, relecture et idempotence | Mêmes 92 cas : intention persistée, clé/corps stables, GET de rapprochement, pas de retry POST aveugle ni publication devenue immédiate | PASS mocks |
| Configuration automatique et auth | 22 cas auto-config + 23 autopilot ; pas d'activation par défaut, erreurs expurgées, schémas et isolation | PASS mocks |
| IANA, quotidien/hebdomadaire/tous les 14 jours/mensuel, déduplication d'occurrences | `node scripts/test-auto-schedule.mjs` ; Paris gap/fold, Lord Howe 30 min, ligne de date Kiritimati, fenêtres bornées et identités conflictuelles | PASS contrats |
| Publication prématurée, média non vérifié, approbation absente | Publication 92 cas et `node scripts/test-auto-publication.mjs` | PASS mocks |
| Historique, révocation concurrente, triggers canoniques et CAS de planning | Job PostgreSQL privé SUCCESS ; étapes social history, routes révocation, schedule CAS, OAuth races | PASS PostgreSQL privé, pas production |
| Interface sociale/reload/planning/CAS, Chromium + WebKit, 375/1440 px | 8 familles, 71 PASS/1 FAIL ; cinq comportements reload WebKit verts puis garde runtime rouge | FAIL parcours complet |

Les **213 cas nominatifs (76 + 92 + 22 + 23)** apparaissent exactement une fois chacun en PASS dans la CI exacte. Ce sous-ensemble est inclus dans ses 1199 PASS/0 FAIL/7 SKIP globaux contrats : ne pas additionner ces groupes. Les étapes PostgreSQL se recouvrent aussi ; aucun total combiné inventé. Les deux scripts non TAP IANA/publication passent séparément. `selected-ci-assertions.txt` fournit les noms, pas un nouveau résultat d'exécution locale.

**FAIL hors backend T06** : WebKit `social-reload`, garde runtime après navigation, erreur CORS de GET notifications loopback ; Chromium `private-download`, attente de réponse du corps suspendu. T01 réserve les deux harnais sous `SUTRA-T01-20261016:CI-FINAL-BOUNDARIES`. Aucun filtre élargi, retry ou skip ajouté par T06. Les étapes legacy/rollback sautées par orchestration ne deviennent pas PASS. Lint, TypeScript et build (`npm run check`) ont PASS dans cette même CI ; aucun second build local.

## Commandes et limites

Exécutées dans cette reprise :

```sh
gh run view 38809803219 --repo puramapro-oss/sutra --json headSha,status,conclusion,jobs,url
python3 qa/t06-final-f360-20261016/verify.py /Users/matissdornier/purama-worktrees/sutra-final-providers-20261013
```

Le vérificateur produit `verification.txt`, `integration.json` et `selected-ci-assertions.txt` : 46 empreintes + 3 blobs livrés conformes, 213 PASS retrouvés, sous-ensemble navigateur 71 PASS/1 FAIL. **Zéro nouvelle exécution fonctionnelle locale** : la CI avait déjà retesté ce SHA exact et les sources sont inchangées. Contrôle syntaxe, diff, scan de secrets et GitNexus avant commit consignés dans ce dossier. Premier essai du vérificateur interrompu sur un nom de fichier QA inexistant, corrigé vers `social-reload-checks.mjs` avant le reçu PASS ; aucun défaut produit associé.

GitNexus indexé sur 5675467, donc ancien. Aucun symbole produit modifié ; contrôle `detect_changes` obligatoire exécuté avant commit, couverture exhaustive UNKNOWN. Pas de réindexation globale pendant la pression disque (12 Gio libres) et les travaux concurrents T01.

**NON TESTÉ** : consentements effectifs, grants réellement accordés, chiffrement/rotation des tokens conservés par Zernio, révocation chez les réseaux, publication réelle, exécution autonome continue et production. L'app rattache un UUID utilisateur à un profil Zernio unique ; elle n'a pas de dimension organisation native. Les mocks refusent le profil/organisation fourni par le client et une réattribution concurrente ; cela ne certifie pas l'appartenance réelle à une organisation distante. `posting` demandé ne prouve pas les permissions réellement consenties.

**Seul blocage logiciel externe à ce lot** : T01 doit livrer le successeur et sa CI pour fermer les deux rouges de harnais. Aucun nouveau code T06 à intégrer ; importer ce commit de preuves si souhaité, puis rapprocher uniquement le delta du nouveau candidat. T02 garde la sécurité transversale, T07 l'interface, T01 SQL/config/intégration. La présence du code ne certifie pas son déploiement.

[Parcours personnel Matiss](PARCOURS-MATISS.md) : consentement distinct de ce blocage logiciel, aucune nouvelle clé réclamée.

Contrôle final local : syntaxe Python/JSON PASS, diff staged PASS, Gitleaks zéro finding. GitNexus `detect_changes --scope staged` exécuté : 11 fichiers de preuve/docs, aucun symbole indexé recouvrant ; index ancien, exhaustivité UNKNOWN. `local-gate.json` conserve les commandes et distingue cette vérification des tests CI.

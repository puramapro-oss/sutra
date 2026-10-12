# SUTRA T06 — autonomie sociale — reprise du 2026-10-12

**LOCAL_DELTA_VERIFIED — RELEASE_NON_CERTIFIEE.** La livraison est le commit portant ce handoff. Commit et push autorisés par le mandat courant ; aucune publication sociale réelle, API payante, migration distante ni déploiement exécuté.

## Branche et propriété

- Branche : `codex/sutra-t06-social-final-20261012`.
- Worktree T06 réutilisé : `/Users/matissdornier/purama-worktrees/sutra-t06-social-autonomy-20261012`.
- Base d'intégration exigée et vérifiée : **`589732cb49959c1a576a3ba381b310cd594600ac`**, branche T01 inchangée.
- Commit du code et des tests : **`d4238596abb84a88f84e3c3e49f3a46aed44fd0d`**.
- Ancienne livraison T06 `9906e2d` / `0be9a90` et branche `codex/sutra-t06-social-autonomy-20261012` conservées. Leurs corrections sont déjà dans la base intégrée : aucune seconde implémentation.
- AGENTS, politique, LOCKS, coordination, handoffs, Git et processus inspectés ; démarrage `POLICY_OK`. Réservation `SUTRA-T06-20261012:REPRISE-589732c`. Seul le worktree T06 a reçu des modifications produit. Aucun reset/stash/clean, installation ou arrêt de processus étranger.

## Défauts corrigés depuis l'intégration

Le premier envoi relisait déjà les droits après le claim durable. Les reprises `replay` et `retry` ne le faisaient pas : une révocation, déconnexion, modification de compte, du reçu média ou de l'approbation intervenant pendant le claim pouvait encore être suivie d'un POST. Les deux chemins relisent maintenant les autorisations immédiatement après le claim, avant tout POST.

Le journal service-role pouvait également contourner la révocation du profil vérifiée par les sessions T02. Il applique désormais le même contrat source que `account-access.ts` : profil absent, propriétaire incorrect, abonnement `banned` ou `access_revoked_at` refuse l'envoi ; lecture impossible refuse avec `SUTRA_ACCOUNT_ACCESS_UNAVAILABLE`. Aucun fichier auth/OAuth T02 modifié. Le compte social exact et sa connexion/expiration restent vérifiés à chaque autorisation.

Si l'autorisation échoue après le claim d'un retry **avant tout POST**, l'opération revient à `recorded` pour permettre une reprise après rétablissement des droits. Si le fournisseur a pu recevoir le POST et que sa réponse est perdue, elle reste `retrying` : aucune répétition aveugle. Le replay conserve strictement la requête et sa clé d'idempotence. La révocation n'interdit pas la lecture GET du statut distant ; les succès acquis et l'historique restent conservés.

21 cas nouveaux reproduisaient l'erreur sur la base intégrée : 30 PASS / 21 FAIL. Après correction et ajustement de deux assertions au code canonique de refus, les 51 tests T06 passent dans la gate contrats complète. Les nouveaux cas couvrent replay/retry, mutations pendant le claim, compte révoqué/déconnecté/remplacé, empreinte média changée, approbation retirée, profil révoqué/banni/absent/illisible, récupération après réautorisation et GET après révocation.

## Contrats PR2 et première livraison conservés

- Calendrier IANA, DST (Paris et Lord Howe), changement de jour Kiritimati, quotidien/hebdomadaire/bimensuel/mensuel, bornes UTC et identité d'occurrence dédupliquée. L'occurrence tardive du pli de Paris reste le choix PR2. Scripts calendrier PASS ; aucun changement de calendrier requis sur cette base.
- Journal par type de production/production/plateforme/compte externe exact ; CAS de révision, bail120s et requête/clé immuables. Réponse perdue reprise seulement dans la fenêtre conservatrice 24h moins5min ; programmation perdue déjà échue ou identité legacy insuffisante exige réconciliation.
- Publication partielle et projections réparables, GET avant retry des seules destinations échouées, statut publié après confirmation distante de toutes les destinations. Compte ambigu, absent, déconnecté, révoqué, expiré ou expiration invalide refusé.
- Média propriétaire avec reçu final URL+SHA-256 et autorisation obligatoire. Changement d'export pour une production journalisée refusé. Aucune nouvelle voie d'envoi, aucun média brut accepté.
- Révocation locale avant la tentative distante, résultat202 honnête si non confirmé, lignes/historique conservés ; protections PATCH/DELETE concurrentes inchangées.
- Cron de génération et réservation atomique T03, migrations intégrées et révocation SQL des droits DELETE/TRUNCATE service_role préservés byte pour byte.

## Fichiers du delta

| Fichier | Changement |
| --- | --- |
| `src/lib/publication-journal.ts` | Contrat profil actif et relecture après claim replay/retry ; récupération du retry refusé avant POST |
| `scripts/helpers/social-database.mts` | Fixture de profil et erreur de lecture simulée |
| `scripts/test-t06-social-autonomy.mts` | 21 régressions supplémentaires |
| `vercel.json` | `deploymentEnabled=false` uniquement pour la nouvelle branche T06, garde T01 conservée |
| `HANDOFF-SUTRA-T06-20261012.md`, `BATON.md`, `task_plan.md`, `qa/t06-final/**` | Reprise, preuves et transmission |

Aucun package, lockfile, workflow, migration, route étrangère ou composant UI modifié. La garde Vercel de branche empêche le preview au push selon le [contrat Git Vercel](https://vercel.com/docs/project-configuration/git-configuration), vérifié dans cette session. Les workflows actuels n'exécutent pas de déploiement sur cette branche. Conserver les gardes des autres propriétaires lors de l'intégration.

## Tests actuels

Environnement : macOS arm64, Node24.21.0, Next16.3.8, TypeScript5.9.3. Dépendances T01 existantes en lecture seule, aucune installation. Fixtures uniquement et réseau externe bloqué par le runner. Commandes exactes, journaux, SHA-256 et objets Git : [qa/t06-final/README.md](qa/t06-final/README.md), [verification.json](qa/t06-final/verification.json).

| Vérification | Résultat actuel |
| --- | --- |
| Contrats | **448 PASS / 7 SKIP / 0 FAIL**, sur455, dont51 T06 |
| Calendrier, composition, publication | Trois scripts PASS |
| Typecheck / lint / build | PASS ; 0 erreur lint,111 avertissements préexistants ;197 pages |
| Média synthétique | 3 moteur local +30 compositeur PASS après correction du PATH de test |
| Navigateur complet | **203 PASS**,155 audits axe/0 violation,0 erreur navigateur |
| Legacy complet | **1022 PASS /25 SKIP /0 FAIL**,0 flaky, sur1047 |
| Python déploiement simulé | 9 PASS, aucun SSH ni déploiement |
| Git / manifest | Diff sans erreur d'espaces ; empreintes vérifiées contre le commit de code |

L'échec initial du compositeur (24 PASS/6 FAIL) provenait de FFmpeg système sans `drawtext`. Seul ce sous-ensemble a été repris avec le FFmpeg-static déjà présent chez T05, en lecture seule :30/30. Les journaux d'échec et de reprise sont conservés, sans nouveau binaire installé ni changement média T05. Les 51 T06 sont inclus dans448, ne pas les additionner.

Les 7 SKIP contrats nécessitent services réels :4 INSEE,2 DB distante,1 OTS. Les25 SKIP legacy sont nommés dans `evidence/legacy-summary.json`. Aucun visuel n'est déclaré validé humainement. SQL local13+9+49, audit dépendances et actionlint : preuves intégrées T01 inchangées, **non rejouées et non comptées comme preuves fraîches T06**. Les suites demandant secrets/services de production restent exclues.

GitNexus avant édition : HIGH sur `runPublicationJournal`,2 appelants directs/7 éléments ; LOW sur fixture. Avant commit, `detect_changes` appliqué explicitement au worktree T06 :4 fichiers/14 symboles/11 flux, HIGH sur les flux attendus. Index T01 TRUNCATED et légèrement ancien : aucune certification exhaustive. Détail et sortie JSON sous `qa/t06-final/`.

## Transmission et limites réelles

1. **T01** : intégrer uniquement le delta ci-dessus depuis589732c. Le périmètre initial planification/publication partielle/réconciliation est déjà intégré ; ne pas reprendre l'ancien lot en doublon. Conserver le cron atomique T03, les migrations intégrées et toutes les gardes de branches. Le commit de preuves ne change pas le code testé.
2. **T02** : contrat profil actif consommé désormais par chaque envoi service-role. La coordination T02 finale annonce une migration additive durcissant `public.social_accounts` depuis le contrat `sql/social-autopilot.sql` ; ce delta appartient à T02 et n'est pas incorporé dans cette branche. La relecture immédiatement avant POST ne constitue pas une transaction distribuée entre base et fournisseur.
3. **T01/T02/T05** : contrat privé durable bucket/path/propriétaire et renouvellement d'URL à terminer entre propriétaires. Le replay identique ne peut remplacer l'URL de son payload par une URL signée fraîche. Aucun changement arbitraire de bucket ni certification de stockage distant ici.
4. **Qualification externe** : schéma distant, garanties d'idempotence et statut réel fournisseur, runtime Linux/OVH et publication réelle non testés. La CI de cette branche n'est pas déclenchée automatiquement par les filtres actuels ; aucun PASS distant revendiqué. La dernière clôture T01 documente la CI bloquée avant tests par `SMARANA_READ_TOKEN`, sans lecture de valeur de secret.
5. **Disque** : DISK_PRESSURE observé jusqu'à17Gi disponibles, aucune suppression ni réinstallation ; worktrees et artefacts préservés.

Aucun blocage restant dans le delta T06 simulé. La qualification intégrée après collecte des autres propriétaires et la release restent distinctes de cette livraison. Aucun déploiement ni publication réelle autorisé par ce handoff.

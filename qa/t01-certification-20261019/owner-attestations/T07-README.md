# ACK T07 — automatisation, candidat ab935

Candidat exact : **ab935e59ca4e39776630f05b2ba6c0422c74ec62**. Branche de livraison : `codex/sutra-t07-automation-final-20261019`.

**PASS technique local avec réserves.** 32 contrôles fonctionnels PASS / 0 FAIL dans les trois exécutions finales. Deux échecs antérieurs du banc sont conservés ; ils ne sont pas effacés du bilan. Aucun moteur, fichier produit, SQL, configuration ni dépendance versionnée modifié. Pas de second ordonnanceur.

## Preuves nouvelles

| Risque | Preuve | Résultat |
| --- | --- | --- |
| Création, réponse perdue, double clic, annulation trop précoce, reprise et fournisseur déjà lancé | `chromium-create/results.json`, `database.json` | 11 PASS, Chromium 375/1440 px, six tâches annulées, six audits et libérations uniques, deux redémarrages PG |
| Configuration des quatre récurrences, IANA/DST, erreur/retry, pause, annulation production | `retry-scheduler/results.json`, `database.json` | 12 PASS, Chromium 375/1440 px, quatre redémarrages PG, configuration réellement persistée par la route SQL |
| Continuité, concurrence, bail expiré, retries bornés et arrêt | `first-continuous/results.json`, `database.json` | 9 PASS, 308 appels manuels, 287 échantillons horaires, 16 occurrences uniques, deux redémarrages PG |

La simulation parcourt du 23 octobre au 4 novembre 2026 et le retour à l'heure d'hiver Europe/Paris : quotidien 12, hebdomadaire 2, toutes les deux semaines 1, premier jour sélectionné du mois 1. Douze ticks simultanés réservent une seule occurrence. Les deux workers concurrents obtiennent un unique bail. Le reçu fournisseur simulé survit au redémarrage ; un ancien worker ne termine pas la tâche. Le cooldown empêche une reprise immédiate, l'épuisement des tentatives place la tâche en réconciliation avec quota réservé. Annuler deux fois libère une seule fois ; seize audits persistants, aucune tâche annulée réclamable.

La pause du planning empêche les nouvelles occurrences et conserve les tâches déjà créées. Le contrôle d'approbation humaine empêche la publication des lignes ready. Aucun travailleur réel, fournisseur ou publication appelé. Les mocks de worker des parcours UI enregistrent seulement un reçu synthétique puis attendent l'annulation.

## Intégration et preuves réutilisées

`integration-and-reused-evidence.json` vérifie **1160/1160 hashes** du manifeste T01, les six reçus de la livraison T07 `57a79f2` inchangés, et la CI **38827288351** avec SHA exact et trois jobs SUCCESS. Le manifeste porte historiquement 7d96 ; son contenu est identique, et le reçu CI lie indépendamment ab935.

Le delta produit depuis T07 concerne sept fichiers de création, statut et suivi : il est couvert par le nouveau parcours `chromium-create`. Le calendrier, le moteur et les migrations sont inchangés. Les gates globales TypeScript/lint/build et les suites invariantes ne sont pas relancées. Les chemins, SHA256 et extraits des reçus centraux sont enregistrés ; aucun résultat ancien n'est présenté comme un nouveau test local.

Les preuves CI réutilisées couvrent notamment : idempotence sociale par production/plateforme/compte, compte révoqué/déconnecté, publication partielle, réponse perdue, absence de retry aveugle, refus sans preuve média/approbation ; workflows J01–J12 création/montage/validation/suivi ; 13 tests API/PostgreSQL et 50 tests durables comprenant quotas/concurrence/rollback/audit. Ces groupes se recouvrent et ne sont pas additionnés aux 32 contrôles nouveaux. T03 et T06 restent propriétaires de ces moteurs/contrats.

## Limites démontrées et réserves

- **BLOQUÉ — garantie de rattrapage illimité** : le handler canonique ne cherche que de maintenant−1h à maintenant+3h. Des ticks à 00h puis 20h ne récupèrent pas une occurrence non préparée de 12h. Reproduction dans le huitième contrôle continu. Comportement actuel documenté, pas une correction backend T07 ; décision de contrat/correction réservée T01/T03. Le PASS du test caractérise cette limite, pas l'absence d'occurrence manquée.
- **NON TESTÉ — 24/7 réel** : horloge JavaScript accélérée ; horloge SQL réelle. La simulation ne prouve ni un soak réel, ni le changement de mois des quotas, ni les quotas/concurrences des plateformes. Les tests de quota historiques restent distincts.
- **NON TESTÉ — diffusion live autonome** : aucune route dédiée live/broadcast identifiée dans l'inventaire API. Aucun moteur ni plateforme live validé. Aucun live planifié ou démarré.
- **NON TESTÉ — runtime distant/dispatch** : aucun cron/service lancé, aucun accès OVH. L'UI dit que le moteur serveur n'est pas vérifiable. L'ancien constat dispatch OFF appartient aux preuves T01, pas à ce retest local.
- **NON TESTÉ — fournisseurs, publication réelle, Safari/appareil physique et lecteur d'écran**. Auth et transport Supabase simulés ; routes et SQL réels, pas preuve de PostgREST/RLS distant. Les consentements légaux sont effectués avec l'identité de test et les quatre acceptations sont enregistrées.
- T06 corrige séparément des défauts UI de publication sur son lot du 19/10 ; cet ACK T07 ne les absorbe pas et ne vaut pas ACK global de la publication sociale. Toute nouvelle intégration T01 demande une comparaison de delta avant de réutiliser cet ACK exact.

## Incidents du banc, captures et mesures

`first-create` : FAIL du banc avant parcours, navigateur Chromium1208 absent. Résolu par l'installation gratuite du seul Chromium headless requis ; retest 11 PASS. `chromium-scheduler` : FAIL avant calendrier, Next dev retourne « Manifest file is empty » pendant le consentement ; serveur local arrêté, reprise unique `retry-scheduler` 12 PASS. Cause de cette erreur transitoire non établie, aucun correctif produit revendiqué. Les reçus, traces et captures d'échec sont conservés. Seules les lignes vides terminales des logs initdb/GitNexus ont été normalisées pour le contrôle de whitespace ; aucun diagnostic retiré.

Captures affichées et inspectées : `retry-scheduler/schedules-375.png` et `retry-scheduler/cancel-inflight-1440.png`. Les captures de création sont prises pendant une transition d'opacité : preuve de texte/état, pas certification du contraste. Aucune certification visuelle exhaustive.

Huit sauvegardes UI→route→SQL : **110–139 ms**, médiane **115,5 ms** en Next dev local. Détails et temps des ticks dans `summary.json`. Pas de lenteur produit reproductible établie, donc aucune optimisation ni comparaison avant/après artificielle. Ces mesures ne sont pas des latences de production.

## Commandes exactes

Exécutées à HEAD ab935, avec les nouveaux fichiers QA non commités ; chaque reçu conserve le hash des scripts, les arbres produit et le lockfile. PostgreSQL18 privé jetable sur loopback ; environnement synthétique autorisé explicitement, garde secrets/sockets `qa/t08/offline.cjs`.

```sh
node qa/t07-automation-final-20261019/run.mjs create first
node node_modules/playwright/cli.js install chromium --only-shell
node qa/t07-automation-final-20261019/run.mjs create chromium
node qa/t07-automation-final-20261019/run.mjs continuous first
node qa/t07-automation-final-20261019/run.mjs scheduler chromium
node qa/t07-automation-final-20261019/run.mjs scheduler retry
node qa/t07-automation-final-20261019/verify-evidence.mjs
node node_modules/eslint/bin/eslint.js qa/t07-automation-final-20261019/*.mjs
node --check qa/t07-automation-final-20261019/run.mjs
node --check qa/t07-automation-final-20261019/continuous.mjs
node --check qa/t07-automation-final-20261019/verify-evidence.mjs
git diff --check
```

Le runner refuse un HEAD différent et toute modification des sources réutilisées : pour reproduire, utiliser ab935 dans un worktree propre et y appliquer seulement ces fichiers QA sans commit préalable. Il refuse de remplacer un reçu existant ; choisir un nouveau préfixe. Les clusters ont été arrêtés, pas supprimés.

GitNexus : ancien index incohérent archivé, reconstruction locale effectuée, impact `startWire` LOW / trois appelants directs. `detect-changes --scope staged` : LOW, 69 fichiers préparés, 98 symboles documentaires/QA, aucun processus affecté. La comparaison obligatoire avec `main` porte sur toute l’intégration historique : CRITICAL, 5157 fichiers, 9356 symboles, 482 processus ; elle dépasse ce lot et ne vaut pas certification globale. Les reçus `gitnexus-staged.txt` et `gitnexus-main.txt` conservent ces résultats. Le graphe demeure tronqué ; la dernière indexation termine avec la recherche FTS/BM25 désactivée (échec UTF-8 sur Property). Aucune exhaustivité revendiquée. Les ajouts post-analyse sont uniquement ces reçus et leur documentation. POLICY_OK ; aucune lecture de secrets, aucun appel payant/IA/GPU, push, fusion, migration distante ou déploiement.

# ACK propriétaire T02 — clôture différentielle du 20 octobre 2026

**Candidat examiné : `79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a`. Verdict sécurité local borné : PASS.** Je suis T02 et atteste personnellement les contrôles ci-dessous sur ce SHA. Aucun nouveau défaut reproductible de mon périmètre n'a été trouvé dans le delta. Ce verdict remplace le NACK sur `ab935e59ca4e39776630f05b2ba6c0422c74ec62` pour les défauts corrigés et retestés ; il ne certifie ni la production, ni une architecture organisations absente, ni WanGP.

Branche de livraison : `codex/sutra-t02-closure-79cd95b-20261020`. Worktree unique : `/Users/matissdornier/purama-worktrees/sutra-t02-final-sha-security-20261015`. Réservation préalable dans les deux LOCKS et miroir T02, identifiant `SUTRA-T02-20261020:CLOTURE-79CD95B`. Produit, SQL, OAuth T06 et connecteur T09 en lecture seule. Livraison : tests, preuves et documentation T02 seulement. Aucun fichier d'un autre worktree modifié.

## Intégration et delta

Dernière livraison T02 : `fee35754890b442086e9dd4bbf069ca4c1e992b6`, après `2b69a8feabb0e82e34939d96cb5176116baa244d`. Les corrections setup/health/contact/QR sont intégrées à blobs identiques. La route scan a été remplacée par T01 avec une primitive SQL atomique : les anciens mocks SELECT/INSERT ne constituent plus son contrat. Les 9 tests route et les 10 tests PostgreSQL T01 sont rejoués ; 5 contrôles SQL négatifs supplémentaires ont été ajoutés par T02.

Le défaut de quota précédent est fermé localement : à 99 scans, 20 transactions concurrentes n'en ajoutent qu'un. Le quota d'un partenaire n'affecte pas l'autre, la répétition d'une IP reste bornée par partenaire, les rôles anon/authenticated ne peuvent ni lire/écrire les scans ni appeler la RPC privilégiée. Une chaîne ressemblant à une injection SQL est traitée comme un code inconnu sans insertion.

Autres deltas examinés : diagnostics admin, Coverr/stock, configuration env, CLI de migration et harnais CI ; composants sociaux réservés à T06/T01, avec régressions OAuth serveur. `invariants.json` documente les empreintes des fichiers, les quatre corrections identiques et les preuves réutilisées. `dependencies-config.json` complète les invariants SQL/deploy/config/dépendances. Aucun patch produit supplémentaire nécessaire dans ce lot.

## Tests exécutés sur le candidat

| Groupe | Résultat | Exécutions PASS | Risque couvert |
|---|---|---:|---|
| partner-route | PASS | 9 | RPC, quotas, refus DB, erreurs publiques |
| partner-postgres | PASS | 10 | concurrence réelle, privilèges, rejeu/rollback SQL local |
| partner-isolation | PASS | 5 | deux partenaires, accès directs SQL interdits, injection littérale |
| coverr | PASS | 4 | contrat stock et absence de repli payant implicite |
| diagnostics-contact-csrf | PASS | 19 | setup/admin, erreurs, injection HTML, CSRF, rejeu callback |
| admin-webhook | PASS | 38 | permissions admin, appels non authentifiés, signature/rejeu |
| production | PASS | 19 | fuite diagnostic RPC, session invalide, identité serveur, quota |
| oauth | PASS | 76 | state/session/usage unique/expiration, révocation, erreurs fournisseur |
| boundaries | PASS | 76 | sessions, deux utilisateurs, tenants fournisseur, propriété et fichiers privés |
| ssrf | PASS | 61 | DNS épinglé, rebinding, IP réservées, redirects, MIME/taille/timeout, worker personnel |
| cli | PASS | 3 | configuration absente/incomplète : refus avant SQL/scp et sans fuite |

**320 exécutions PASS, 0 FAIL, 0 SKIP**. Certains groupes se recouvrent : ce total n'est pas un décompte de propriétés uniques ni une couverture exhaustive. Les deux nouveaux fichiers contiennent 8 cas de régression. TypeScript et lint ciblés : PASS. PostgreSQL 18 jetable, exclusivement loopback, démarré et arrêté par le harnais ; reçu `postgres.json`. Aucun fournisseur contacté, aucune DB distante, génération, publication ni consentement réel.

Commande exécutée une fois sur HEAD candidat, sans modification produit :

```sh
python3 qa/t02-closure-79cd95b-20261020/run.py partner-route coverr diagnostics-contact-csrf admin-webhook production oauth boundaries ssrf cli postgres
```

Chaque reçu `<groupe>.json` contient le SHA, la commande Node exacte, le résultat, le hash SHA256 du `.log` et les noms des variables synthétiques. Node utilisé : 24.22.0. Les commandes ciblées TypeScript et lint sont dans `typecheck.json` et `lint.json`. `run.py` refuse un autre HEAD ; pour reproduire, utiliser un checkout isolé du candidat avec les seuls fichiers QA de cette livraison. Le preload `qa/t08/offline.cjs` bloque les appels fournisseurs et la lecture `.env*`.

## Preuves fraîches réutilisées, sans relance inutile

Après contrôle des sources, dépendances, configuration, scripts et empreintes des logs du commit T02 précédent : cron 21 PASS, RLS PostgreSQL 261 assertions PASS, permissions d'écriture 30 assertions PASS, routes 10 PASS, publication simulée 92 PASS, autopilot 23 PASS, contrôle de création 10 PASS. Reçus et logs originaux dans `fee35754890b442086e9dd4bbf069ca4c1e992b6:qa/t02-final-ab935e5-20261019/` ; ils ne sont pas tous copiés dans le candidat T01. `invariants.json` conserve les commandes et vérifie les hashes depuis les objets Git originaux.

Cron : mécanisme existant `assertCronAuth`, secret absent/invalide refusé ; inventaire précédent 20 entrées, 19 gardes directes et un réexport, fichiers inchangés. La disponibilité du rattrapage cron R107 est une réserve T03 distincte de l'autorisation cron.

Preuve T01 sur le SHA exact, non réexécutée par T02 : [CI 39328438907 SUCCESS](https://github.com/puramapro-oss/sutra/actions/runs/39328438907). TypeScript/lint/build, 1261 contrats PASS/7 SKIP historiques, 1022 E2E historiques PASS/25 SKIP, PostgreSQL et médias PASS selon `T01-FINAL-VERDICT-20261019.md`. Le log contrats T01 inclut les modes personnels T08 : identité forgée refusée et client restant sur l'API même lorsque le moteur personnel est activé. Aucun nouveau build global T02.

## Secrets, dépendances et configuration

`python3 qa/t02-closure-79cd95b-20261020/scan.py` : scan courant expurgé avec règles par défaut, sans suppression. Une détection conservée, fixture synthétique déjà connue `scripts/test-release-regressions.mts:41`, hash `385fd6ac175ecbd854bf0a04cdf38febd70c58e75826c4cffd398619253ecf5a`. Le scanner sort 1 pour cette détection ; ne pas annoncer un exit 0. Aucune fuite réelle démontrée dans les fichiers scannés. Historique complet, logs/artefacts distants et validité/rotation d'anciens credentials : NON TESTÉS ici. Le retrait du credential historique du CLI ne prouve pas sa révocation ; suivi T01.

Aucun master ni `.env*` lu/copier/modifié. Les variables de test sont toutes synthétiques et injectées explicitement ; aucun secret nécessaire à ces vérifications. Le CLI n'est exécuté que sans configuration complète et avec PATH empêchant scp. Aucun SSH ni action distante.

Package/lock inchangés, 32 versions installées contrôlées égales au lock et à la preuve précédente. Audit récent réutilisé : production 7 alertes (2 low, 5 moderate, 0 high/critical), total 30 (4 low, 8 moderate, 17 high, 1 critical). **Alertes conservées, aucune affirmation de zéro dépendance vulnérable.** Tripwires OTS rejoués : aucun appel du transport legacy request, signature elliptic ou Bitcoin RPC dans les flux exercés. Qualification précédente uuid/LHCI inchangée ; un futur chemin appelant les fonctions affectées ou un serveur LHCI exposé exige réévaluation. Aucune mise à jour massive ou nouvelle consultation npm nécessaire pour ce delta.

Configuration des headers et rate limits inchangée : absence d'en-têtes CSP/HSTS/X-Frame-Options/nosniff explicites dans les fichiers applicatifs examinés, état proxy distant NON TESTÉ. Limite contact en mémoire par processus ; distribution/multi-instance et confiance dans les en-têtes IP du proxy non certifiées par ce lot.

## Limites et blocages distincts

| État | Périmètre | Limite / propriétaire |
|---|---|---|
| PASS | Sécurité locale du candidat et refus ciblés | Portée des cas ci-dessus ; pas de garantie exhaustive |
| FAIL connu hors correctifs T02 | R107 : rattrapage après longue interruption | T03 corrige ; nouveau SHA requis après intégration T01 |
| FAIL signalé hors périmètre T02 | Trois contre-tests musique secondaire | NACK T04 dans les registres du20/10 ; livraison et intégration T01 attendues |
| BLOQUÉ externe | Validation production / catalogue RLS / headers / logs réels | OVH app et DB arrêtées, public404, sauvegarde périmée selon preuves T01 ; aucune remise en marche autorisée ici |
| BLOQUÉ intégration opérationnelle | RPC partenaire en production | Migration uniquement locale, à préparer par T01 avant handler ; absence RPC doit rester503 |
| NON TESTÉ / modèle absent | Deux organisations natives, projets et budgets organisationnels | Pas de modèle organization_id/org_id/tenant_id dans les sources examinées ; deux users/tenants fournisseur ne valent pas deux organisations |
| NON TESTÉ | Consentement OAuth et révocation réellement appliquée par les fournisseurs | T06/utilisateur ; seuls contrats/échecs simulés contrôlés |
| BLOQUÉ T09 | Connecteur personnel WanGP, réseau et stockage réels | `availableForWanGP=false` ; exigences dans `WANGP-ISOLATION.md` |

Les URLs signées émises peuvent rester valides jusqu'au TTL prévu (300s). Les tâches asynchrones existantes contrôlent l'identité enregistrée, le job et la lease ; la révocation en vol d'un futur connecteur WanGP nécessite les tests supplémentaires indiqués. Toute modification de SHA, migration, authentification, transport, worker ou dépendance invalide l'ACK pour le delta concerné.

## GitNexus et livraison

Skill GitNexus guide/CLI utilisé. Index local seul actualisé avec `analyze --index-only`, sans embeddings ni modèle. Graphe partiel : 1369 entrées, 871 branches et 41 parcours tronqués ; query/context personnels incomplets/incohérents, donc pas de certification exhaustive. Aucun symbole produit modifié. `detect-changes --scope compare --base-ref main --limit 40` : **CRITICAL**, 5501 fichiers historiques, 3378 symboles, 494 flux ; avertissement transmis. Le fichier `gitnexus-compare-main.json` conserve la sortie texte brute, malgré son extension. L'analyse staged et le contrôle direct du périmètre précèdent le commit local `[CODEX]`.

Analyse staged : LOW, quatre sections documentaires reconnues, zéro flux affecté ; les nouveaux tests ne sont pas tous indexés. La revue Git directe confirme uniquement les chemins QA/docs réservés. Le collecteur initial d'empreintes par appels Git individuels a été arrêté dans le seul processus T02, puis remplacé par `python3 qa/t02-closure-79cd95b-20261020/invariants.py` : 869 fichiers, 16 chemins de delta, sept anciens logs vérifiés. Aucun test interrompu ou invalidé. `verification.json` vérifie aussi 17 hashes de reçus frais et l'arrêt de PostgreSQL.

T01/T08 : ACK personnel attaché uniquement au SHA exact ci-dessus, commit de preuves annoncé dans les miroirs existants après création. Ne pas transférer automatiquement cet ACK au prochain candidat T03/T04. Aucun merge, push ou déploiement demandé/exécuté.

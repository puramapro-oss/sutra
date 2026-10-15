# T08 — recette indépendante exacte72f, verdict NON PRÊT

Candidat testé : **72f406b940b7e3cdfb27873751a4059375646f25**. Branche des preuves : `codex/sutra-t08-acceptance-72f406b-20261015`. Aucun fichier produit modifié, aucun push/fusion/déploiement/SQL distant/provider payant ; secrets non lus.

**Matrice74 exigences :57PASS,2FAIL,2BLOQUÉS,13NONTESTÉS.** [Matrice et preuves](qa/t08-acceptance-72f406b-20261015/MATRIX.md). Les deux FAIL désignent une seule cause : garde runtime WebKit/social (R47/R69). Les quatre causes antérieures T02-RPC-02, T06-INTEGRATED-01/02 et T08-HARNESS-01 sont corrigées et retestées. Parmi les12anciennes lignes FAIL,11PASS ; R69 est rouvert pour ce nouvel échec de garde, ses9assertions fonctionnelles passent. Aucun rouge passé en ignore.

## Exécutions et provenance

`python3 qa/t08-acceptance-72f406b-20261015/run.py harness rpc history-routes history-sql cancellation capabilities social-authority journey` : **112PASS/0FAIL/0SKIP**. Harnais6, RPC19, routes/PostgreSQL9, SQL apply/replay/rollback27, annulation4, capacités19, autorité sociale15, parcours13. La chaîne routes→file→worker→pipeline→export→journal social utilise des fournisseurs/session/DB/stockage simulés ; PG privé est testé séparément. Concurrence12, doubles clics, reprises/ACK perdu/erreurs partielles et isolation couverts. Clusters privés arrêtés.

CI exacte [38745298450](https://github.com/puramapro-oss/sutra/actions/runs/38745298450) : contrats **990PASS/0FAIL/7SKIP historiques**, PostgreSQL PASS ; TS/lint/build PASS ; parcours navigateur **283PASS/1FAIL** sur20familles.17exports CPU synthétiques réels vérifiés SHA256/octets/décodage complet. Les étapes legacy/livraison après navigateur n'ont pas tourné dans cette CI ; elles ne sont pas comptées PASS ici. Tests recouvrants non additionnés.

`verify_sources.py` :1188contrôles PASS (1061sources/blobs exacts, patches auteurs, invariance sources T03/T05/T07 et3MP4 4K conservés). `verify_receipts.py` :15contrôles de reçus T01 PASS (copies SQL,141tables restaurées, image OVH exacte sans réseau/5smokes). `verify_ci.py` :70PASS/3FAIL de contrôle de preuves, exit1 attendu et conservé : job global et deux contrôles du même garde. Ces contrôles de provenance ne sont pas des tests fonctionnels supplémentaires.

T03 29scénarios PG, T05 5tests/3exports4K CPU et T07 142assertions/39axe sont réutilisés à sources/dépendances vérifiées, sans les recopier ni les relancer. Les captures WebKit375 social/planning actuelles ont été affichées ; pas de validation manuelle complète ou appareil physique.

## Défaut restant et reprise

**T08-CI-WEBKIT-01**, propriétaire **T01 harnais**, transmis immédiatement par miroir de coordination ; T01 ACK14:13UTC. Reproduction minimale et attendu/observé dans [DEFECTS.md](qa/t08-acceptance-72f406b-20261015/DEFECTS.md). Un pageerror CORS GET user_notifications sur fixture HTTPS loopback pendant navigation6 reste inexpliqué par la garde actuelle. Aucun défaut produit attribué sans preuve. T01 prépare une barrière de fin de lecture avant navigation, sans élargir le classificateur. Nouveau SHA intégré requis, puis retest du delta harnais et parcours final ; **ne pas relancer112contrats inchangés**. Aucun ACK de promotion72f.

BLOQUÉS : R30 ordonnanceur autonome inactif (configuration T01) ; R74 commande UI d'annulation durable absente (liaison UI/job à arbitrer T01/T03/T07), distincte de l'API annulation PASS. Aucun bouton distant existant prétendu défectueux.

NONTESTÉS :13limites détaillées matrice, dont consentements/login réels, GPU/budget/coût/qualité IA, publication publique, chaîne distante complète, alertes/SLA/appareil/lecteur écran, nouveau GET fournisseur sur candidat, restauration complète auth/sessions/blobs et rollback production. Les copies PG/CPU/simulations ne ferment aucune de ces absences. Risques dépendances :7alertes npm production low/moderate,30totales dont17high/1critical développement selon reçu T02 ; aucun zéro-bug ni sécurité exhaustive promis.

## Qualité et livrables

QA seule dans `qa/t08-acceptance-72f406b-20261015/**`, ce handoff et append BATON/task_plan. Syntaxe/ESLint/diff/scan secrets dans `quality.json`. GitNexus delta QA LOW/0processus produit ; comparaison historique main CRITICAL/tronquée signalée, aucune certification exhaustive. Les logs bruts ne sont pas normalisés pour dissimuler un échec.

Actions personnelles minimales ultérieures : saisir clé Salad valide et identifiants techniques par outil masqué T04 depuis https://portal.salad.com/ ; effectuer les consentements personnels des réseaux réellement voulus quand T01 les proposera. Aucun secret dans le chat. Activation, budget et essais réels restent distincts de cette recette gratuite. [Plan smoke T01](qa/t08-acceptance-72f406b-20261015/SMOKE-T01.md).

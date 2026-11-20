# Exigences T08 — base intégrée 589732c

PASS désigne uniquement le périmètre de preuve cité. Les mocks, les preuves SQL héritées et les contrôles de production sont séparés. Les reprises propriétaires postérieures à cette base ne sont pas incluses.

| Exigence | Statut | Preuve / limite |
| --- | --- | --- |
| Connexion invalide/valide et session | PASS | 203 contrôles Chromium T01/T07 exécutés intégralement ; GoTrue local simulé |
| Création authentifiée, absence de session refusée | PASS | Contrats create/pipeline-submit, vraies routes et dépendances simulées |
| Quota/réservation/refus et remboursement | PASS | Contrats pipeline-submit/queue ; modèle de RPC, SQL T01 séparé |
| Budget et approbation hybride complets | FAIL | Fonction S5 non intégrée dans PR3, absence confirmée dans la matrice T01 ; aucune équivalence inventée avec le quota |
| Génération simulée et résultat asynchrone 202 | PASS | Contrats pipeline/interruption/fournisseurs ; aucune génération payante |
| Checkpoints et reprise sans nouvelle dépense | PASS | Contrats + charge T08 : 288 opérations uniques, replay et restart en mémoire |
| Montage local et validation du média | PASS | 33 tests FFmpeg/probe/décodage sur médias synthétiques locaux |
| Export durable et persistance fail-closed | PASS | Contrats export/intégration/queue ; DB simulée |
| Édition/export UI, erreurs et reprise | PASS | Chromium : source/payload conservés, 503, retry 202 annoncé pending, timeout et contrôles rétablis |
| Versions/restauration d'export | FAIL | Fonction S5 absente, restauration indisponible annoncée par UI |
| Validation manuelle et transitions concurrentes | PASS | Contrats T06 CAS, états ready/publishing et refus concurrents |
| Planification, fuseaux, DST, une occurrence | PASS | Contrats calendrier/schedule/T06 ; aucun cron déployé déclenché |
| Publication simulée et erreurs partielles | PASS | Contrats T06/social ; journal par destination et retry ciblé |
| Parcours continu DB réelle connexion → publication simulée | BLOQUE | Harnais UI et contrats backend segmentés ; budget absent, pas de DB de recette intégrée autorisée |
| Pannes DB et acquittements non durables | PASS | Injection contrats : lecture/écriture/finalisation refusées sans faux succès |
| Timeouts/abort fournisseurs et download | PASS | Contrats provider-safety/LTX/downloader ; réseau simulé |
| Doubles requêtes backend | PASS | Claims/checkpoints/journaux sous concurrence dans les doubles ; SQL T01 hérité séparé |
| Doubles clics export UI dans la même frame | FAIL | T08-I01 : deux POST au lieu d'un ; useEditorHandlers.ts:115, propriétaire T07 ; aucune double dépense backend démontrée |
| Concurrence/reprise/charge raisonnable | PASS | 8 workers, 32 checkpoints×9 étapes, 32 journaux×2 destinations ; aucune répétition, in-memory uniquement |
| IDOR routes et statuts privés | PASS | Contrats sécurité/auth/account/stockage/export, identités distinctes injectées |
| Isolation RLS/organisations SQL locale | PASS | Preuve T01 réutilisée : 49 assertions ; fichiers/migrations/tests hashés inchangés, aucune migration rejouée T08 |
| Isolation RLS et schéma distants | BLOQUE | Aucun accès DB distante ni migration autorisé ; compatibilité des données inconnue |
| SSRF URL/DNS/redirections/limites | PASS | Contrats downloader/media/provider-safety, résolutions et transports simulés |
| SSRF DNS rebinding réel et configuration réseau déployée | NON TESTE | Aucun réseau externe testé ; simulation non promue en preuve d'infrastructure |
| CSRF Origin/content-type au middleware | PASS | Contrats test-integration : refus requêtes étrangères/simples |
| CSRF navigateur hostile/cookies/domaine réel | NON TESTE | SameSite/CORS du déploiement non qualifiés |
| XSS stockée et erreurs de fournisseur dans l'éditeur | PASS | Payload img/onerror rendu comme texte en bibliothèque/éditeur/toast ; canari jamais exécuté |
| Auth cron fail-closed, OAuth/revocation | PASS | Contrats T02/T06 et cron sans secret ; uniquement jetons synthétiques |
| Exécution/récurrence cron déployée | NON TESTE | Aucun déclenchement distant |
| Secret synthétique expurgé des réponses testées | PASS | Contrats sécurité/regression ; aucune inspection de secret réel |
| Garde QA fichiers et réseau | PASS | 12 tests VM, 2 régressions URL encodée rouges avant correction puis vertes ; pas une sandbox OS |
| Inventaire/rotation/absence globale de secrets réels | NON TESTE | Valeurs et fichiers secrets non lus |
| Observabilité durable des états/jobs/journaux | PASS | Contrats pipeline/publication : états ambigus en réconciliation et persistance vérifiée |
| Corrélation globale, logger/cron-runs S5, alertes/SLA | FAIL | Logger S5 absent de PR3 ; aucun raccord équivalent démontré |
| Accessibilité automatisée et responsive | PASS | 156 audits axe sans violation ; viewports 320/375/768/1280/1440, absence de débordement selon harnais ; 2 captures T08 affichées |
| Clavier complet, lecteur d'écran, WCAG exhaustive | NON TESTE | Les contrôles axe/focus ciblés ne prouvent pas une certification complète |
| Performance locale bornée | PASS | Charge mémoire : p95 séquence 13,41 ms, total 49,38 ms ; 64 destinations en 37,62 ms ; navigateur : 10 observations DCL 21–59 ms, aucune long task relevée ; aucune valeur de SLA |
| Performance production/CWV/charge DB | NON TESTE | Pas de charge réelle ni de mesure appareil/réseau de production |
| CI distante intégration T01 | BLOQUE | Run38289517548 : setup SMARANA_READ_TOKEN manquant ; PostgreSQL initialisé, aucun test distant exécuté |
| Build reproductible sans cache de police | FAIL | Garde réseau refuse le téléchargement Google Fonts ; défaut environnement/tooling T01, build local avec cache traité séparément |
| Image Linux/OVH, santé et rollback réels | BLOQUE | Docker/runtime distant non qualifiés ; les 9 tests Python sont des mocks |
| Appels GPU/payants, publication et déploiement réels | NON TESTE | Exclus par mandat ; aucun appel exécuté |
| Certification de release | BLOQUE | Budget/versions/observabilité incomplets et preuves intégrées/externes absentes ; aucune certification globale |

# Matrice finale SUTRA T01 — intégration des sept reprises du 2026-10-12

PASS désigne uniquement le périmètre de preuve cité. Sources et résultats frais : `verification.json` et le handoff T01. Les rapports T02–T08 sont conservés comme preuves propriétaires, séparément de cette recette intégrée. Aucun appel fournisseur payant. Le déploiement est conditionné aux contrôles critiques ; cette condition échoue.

| Exigence | Statut | Preuve / limite |
| --- | --- | --- |
| Connexion invalide/valide et session | PASS | 210 contrôles Chromium T01/T07 et 7 scénarios T08/T01 exécutés intégralement ; GoTrue local simulé |
| Création authentifiée, absence de session refusée | PASS | Contrats create/pipeline-submit, vraies routes et dépendances simulées |
| Quota/réservation/refus et remboursement | PASS | Contrats pipeline-submit/queue ; modèle de RPC, SQL T01 séparé |
| Budget et approbation hybride complets | FAIL | Fonction S5 non intégrée dans PR3, absence confirmée dans la matrice T01 ; aucune équivalence inventée avec le quota |
| Génération simulée et résultat asynchrone 202 | PASS | Contrats pipeline/interruption/fournisseurs ; aucune génération payante |
| Checkpoints et reprise sans nouvelle dépense | PASS | Contrats + charge T08 : 288 opérations uniques, replay et restart en mémoire |
| Montage local et validation du média | PASS | 34 tests FFmpeg/probe/décodage frais sur médias synthétiques locaux ; toutes les pistes applicables mesurées, hash des octets contrôlé avant stockage. |
| Export durable et persistance fail-closed | PASS | Contrats export/intégration/queue ; DB simulée |
| Édition/export UI, erreurs et reprise | PASS | Chromium : source/payload conservés, 503, retry 202 annoncé pending, timeout et contrôles rétablis |
| Versions/restauration d'export | FAIL | Fonction S5 absente, restauration indisponible annoncée par UI |
| Validation manuelle et transitions concurrentes | PASS | Contrats T06 CAS, états ready/publishing et refus concurrents |
| Planification, fuseaux, DST, une occurrence | PASS | Contrats calendrier/schedule/T06 ; aucun cron déployé déclenché |
| Publication simulée et erreurs partielles | PASS | Contrats T06/social ; journal par destination et retry ciblé |
| Parcours continu DB réelle connexion → publication simulée | BLOQUE | Harnais UI et contrats backend segmentés. PostgreSQL privé : 13 migration + 12 pipeline + 147 permissions ; pas un parcours complet navigateur sur DB réelle. |
| Pannes DB et acquittements non durables | PASS | Injection contrats : lecture/écriture/finalisation refusées sans faux succès |
| Timeouts/abort fournisseurs et download | PASS | Contrats provider-safety/LTX/downloader ; réseau simulé |
| Doubles requêtes backend | PASS | Claims/checkpoints/journaux sous concurrence dans les doubles ; SQL T01 frais séparé |
| Doubles clics export UI dans la même frame | PASS | T07 intégré et scénario T08 exécuté : une requête, retry possible ; aucune double dépense réelle simulée comme preuve fournisseur. |
| Concurrence/reprise/charge raisonnable | PASS | 8 workers, 32 checkpoints×9 étapes, 32 journaux×2 destinations ; aucune répétition, in-memory uniquement |
| IDOR routes et statuts privés | PASS | Contrats sécurité/auth/account/stockage/export, identités distinctes injectées |
| Isolation RLS/organisations SQL locale | PASS | 147 assertions SQL fraîches, double application migrations, droits effectifs et profils actifs ; isolation par utilisateur seulement, aucun modèle canonique organisation inventé. |
| Isolation RLS et schéma distants | BLOQUE | Lecture seule OVH : trois tables et quinze fonctions requises absentes. Migration de production non effectuée. `ovh-schema.json`. |
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
| Accessibilité automatisée et responsive | PASS | 165 audits axe sans violation ; viewports 320/375/768/1280/1440, absence de débordement selon harnais ; captures respiration terminée et landing affichées par T01 |
| Clavier complet, lecteur d'écran, WCAG exhaustive | NON TESTE | Les contrôles axe/focus ciblés ne prouvent pas une certification complète |
| Performance locale bornée | PASS | Charge mémoire : p95 séquence 12,79 ms, total 48,65 ms ; 64 destinations en 35,42 ms ; navigateur : 10 observations DCL 19–43 ms, aucune long task relevée ; aucune valeur de SLA |
| Performance production/CWV/charge DB | NON TESTE | Pas de charge réelle ni de mesure appareil/réseau de production |
| CI distante intégration T01 | BLOQUE | Credential privé SMARANA_READ_TOKEN absent au précédent run 38289517548. Résultat du nouveau push à vérifier ; preuves locales distinctes. |
| Build reproductible sans cache de police | PASS | Police Space Grotesk embarquée avec licence et hash ; build canonique sans réseau ni cache Google Fonts, 197 pages. |
| Image Linux/OVH, santé et rollback réels | BLOQUE | Ancien conteneur healthy, GET internes / et /login 200, /api/points 401. Nouvelle image et rollback non exécutés : précontrôle critique refusé. |
| Appels GPU/payants, publication et déploiement réels | NON TESTE | Aucun appel payant ni publication. Déploiement conditionnel autorisé mais non exécuté, car contrôles critiques refusés. |
| Certification de release | BLOQUE | Stockage privé et schéma incompatibles, domaine public HTTP402, CI privée bloquée ; fonctions S5 absentes. Aucun déploiement. |
| Stockage média privé durable | FAIL | Bucket OVH sutra-assets public ; uploadToStorage persiste getPublicUrl. Référence bucket/chemin/propriétaire et renouvellement autorisé à concilier avec le payload immuable de publication. |
| Domaine public et chemin Cloudflare | FAIL | 4 GET HTTP402 depuis Vercel ; NS Cloudflare, DNS A 216.150.16.129/216.150.1.65 ; TLS direct OVH non vérifiable (émetteur). Aucun DNS modifié. |
| Respiration sans récompense non autorisée | PASS | Session complète simulée dans Chromium : aucune mutation de points, aucun XP annoncé, suspension affichée. Horloge isolée du harnais principal. |

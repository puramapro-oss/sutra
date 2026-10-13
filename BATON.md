# SUTRA — reprise apres verification finale, 2026-10-13

**OVH OPERATIONNEL / RECETTE CONNECTEE EN ATTENTE.** Commit applicatif `f770e272d2d8e3bb3dde5b523fe7aa37f122399d` deploye sur https://sutra.purama.dev ; CI38330861913 : trois jobs SUCCESS. Deux defauts origine Auth/CSRF corriges, sept regressions. Public desktop/mobile affiche et verifie ; 28 controles origine, 10 GET,120 SQL PASS ; logs/base healthy, sauvegarde restauree precedemment et empreintes revalidees, snapshot rollback du precedent3e conserve. Aucun appel payant ni nouvelle migration.

Prochaine tache non verifiee : recette connectee avec un compte SUTRA QA existant dont l'utilisateur fournit uniquement l'adresse. Ne pas creer Authuser (57 triggers hors SUTRA), ne pas utiliser de compte utilisateur reel. Creation de projet, pipeline gratuit authentifie, media prive et SRT live restent non verifies. Ne pas rejouer les gates vertes sans delta. Preuves exactes, commandes et rollback : HANDOFF-SUTRA-T01-20261012.md et qa/postdeploy-20261013/README.md.

Les états plus anciens ci-dessous restent historiques.

# BATON — SUTRA T01, OVH en production

2026-10-13 : **DEPLOYE / CI ET SMOKES GRATUITS PASS**. Commit applicatif `3e5596ea287f36427f687d3f3882d35c3f7c407b`, poussé et déployé sur https://sutra.purama.dev. CI finale : https://github.com/puramapro-oss/sutra/actions/runs/38322846966 . Les derniers commits documentaires ne changent ni l’application ni l’image déployée.

Huit migrations SUTRA appliquées après sauvegardes/restaurations ; dernière restauration : 140 tables aux comptages identiques, huit migrations rejouées deux fois. 254 assertions RLS en CI, 120 contrôles SQL live, 35 GET Supabase sans lignes, 5 GET internes et 5 HTTPS publics PASS. DNS Cloudflare A 144.217.14.210 DNS-only ; TLS Let’s Encrypt valide. Aucun appel fournisseur payant.

Le premier déploiement 3591818 a été annulé automatiquement après un 403 Supabase ; les droits service_role manquants ont été corrigés et testés sans droits par défaut artificiels. L’image finale passe ce smoke. Sauvegardes, anciennes images et snapshot rollback `/opt/purama/apps/sutra/rollback-3e5596ea287f36427f687d3f3882d35c3f7c407b` conservés ; ne jamais rouvrir le bucket média privé pour rollback.

État détaillé, commandes exactes et limites : HANDOFF-SUTRA-T01-20261012.md, deploy/README.md, qa/deployment-20261013/. Les 53 worktrees étrangers et cinq ancêtres protégés sont conservés. Aucune action manuelle indispensable ; parcours authentifiés et fournisseurs payants non revendiqués. Les sections ci-dessous sont des archives historiques, sans autorité de déploiement actuelle.

## Archive antérieure au déploiement final

# BATON — SUTRA T01, production autorisée

2026-10-13 : **CORRECTION_PERMISSIONS_AVANT_REDEPLOIEMENT**. CI3591818 intégralement verte (run38320118213). Six migrations appliquées atomiquement après backup/restore136 tables. Candidat Linux exact promu ; cinq GET HTTPS PASS, DNS Cloudflare A144.217.14.210 DNS-only, TLS Let’s Encrypt valide.

Le smoke Supabase supplémentaire a détecté403 sur video_jobs : les migrations v10/v11 ne donnaient aucun droit SQL au service_role. Rollback applicatif effectué et healthy ; migrations additives, bucket privé et DNS OVH conservés. Migration20261013_job_service_permissions.sql ajoute uniquement SELECT/INSERT/UPDATE sur jobs/quota. Test corrigé pour ne plus injecter de droits par défaut ; régression reproduite. Le contrôle élargi a trouvé le même manque sur les tables v3 utilisées par les routes serveur : migration20261013_feature_service_permissions.sql, liste explicite25 tables, droits clients inchangés, DELETE uniquement pour le toggle love_reactions. Aucun appel payant.

Prochaine étape : CI du correctif verte, sauvegarde fraîche, migration corrective testée sur copie privée, promotion du candidat exact, smoke Supabase + HTTP + DNS/TLS. Preuves : qa/deployment-20261013/. Le rapport final remplacera les états historiques du handoff et du plan. Conserver les53 worktrees étrangers, les7 lots intégrés, les commits protégés et toutes les images/backups.


<!-- Livraison 8e62dde1b3f913bed9fd327ac721e7207f72d7ea -->

## 2026-10-13 — livraison T04 fournisseurs, sans déploiement

Branche `codex/sutra-t04-provider-audit-20261013`, base `48f2d5e`. Suno erreurs2xx/JSON expurgées et réponses bornées ; diagnostic Shotstack stage/v1 corrigé, à recevoir avec T05. Gate Node24 scripts/run-ci.mjs contracts : 483PASS/7SKIP/0FAIL ; quality TS/lint/build PASS (111 warnings,197pages) ; 37ciblés et 7Python PASS. Hashes du code/config/lockfile/commandes dans `qa/provider-final-audit-20261013/tested-source.json` ; résultats détaillés et SHA de livraison au pointeur coordinateur T04.

Prochaine tâche non vérifiée : résoudre RunPod401, Shotstack403, contrat Suno incompatible et quatre contre-tests OAuth Zernio rouges. Zernio GET200/0compte ; API musicale alternative maître GETcrédits200 par T01. Rapport complet/actions : `qa/provider-final-audit-20261013/README.md`. Aucun secret modifié, génération/connexion/publication/déploiement ; WIP étrangers préservés. Ne pas rejouer les PASS sans delta.

T04 contrôle précommit : Gitleaks zéro détection après vérification de trois SHA-256 faussement classés ; comparaison maître opaque sans fuite. Index GitNexus propre et tronqué : staged 45 fichiers/44 symboles/6 flux, HIGH ; impact CRITICAL initial conservé. Manifest final dans qa/provider-final-audit-20261013/manifest.json.


## Livraison 47e49ee
Document propriétaire complet : `qa/final-integration-20261013/47e49ee-BATON.md`.


## Livraison 312522a
Document propriétaire complet : `qa/final-integration-20261013/312522a-BATON.md`.


## Livraison 460acd3
Document propriétaire complet : `qa/final-integration-20261013/460acd3-BATON.md`.


## Livraison 0e38a92
Document propriétaire complet : `qa/final-integration-20261013/0e38a92-BATON.md`.


<!-- Livraison 5b374994378e3840c4b0dd9bea706b3aa7306f43 -->


## 2026-10-13 — T08 reprise fournisseurs (delta QA)

Base 48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4, branche codex/sutra-t08-provider-audit-20261013, worktree isole. Rapport : [qa/t08/providers-20261013/README.md](qa/t08/providers-20261013/README.md). Produit intact, verrous et WIP etrangers preserves.

- VERIFIED : 6 contre-tests hors reseau, 1 PASS et 5 FAIL conserves (quatre assertions de contrat Zernio, une erreur Suno 2xx reflechie au navigateur). Defauts remis aux proprietaires T04/T06/T02, aucune correction produit T08.
- VERIFIED : typegen, TypeScript et lint T08 exit 0, 111 avertissements herites. T01 480 contrats PASS/7 SKIP et schedule/composition/publication PASS reutilises, 752 fichiers sources/config identiques verifies par hash. Aucun build identique duplique.
- VERIFIED : preuves partagees T04 master normalise, Mac/OVH en lecture seule : RunPod 401, Shotstack 403 quatre combinaisons, Suno legacy public 503 sans auth, Zernio 200/zero compte. Aucun appel fournisseur ou SSH T08.
- BLOQUE : release, raccord OAuth/isolation profil, Suno erreur et contrat, acces fournisseurs. SSH T04 par alias existant reussi ; SSH avec seuls parametres master T01 refuse, distinction conservee. Aucun .env.local cree, aucun secret affiche, aucune generation/publication/deploy/migration/fusion.
- Livraison locale : nouvelles preuves/tests et append documentaire uniquement. Push en attente de garde anti-preview pour cette nouvelle branche : vercel.json reserve a T05 sur son propre delta ; aucune modification de ce fichier par T08. L'autorisation de push precedente ne permet pas de declencher un deploiement interdit.

Matrice du delta : 22 exigences, 8 PASS / 4 FAIL / 7 BLOQUE / 3 NON TESTE. Les preuves du 12 octobre restent historiques et ne sont pas rejouees. Prochaine action proprietaires : corriger les deux classes de defaut et rejouer uniquement redteam, qualifier les credentials et OAuth apres intervention humaine. SHA de livraison remis dans la coordination apres commit.


## 2026-10-13 — T01 reprise finale fournisseurs intégrée et testée

Mandat courant : corrections locales et intégration seulement, aucun push/deploy/migration distante/publication/génération payante/rotation/fermeture. Branche `codex/sutra-final-providers-20261013`, base `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`. Livraison = commit contenant ce jalon. Les décisions et compteurs antérieurs sont historiques.

- INTEGRE : deltas T04 8e62dde, T05 47e49ee, T02 312522a, T06 460acd3, T03 0e38a92, T08 5b37499 par chemins revus ; 187 entrées, aucun manque. T07 4993feb documentaire archivé, code déjà intégré. Commits protégés conservés.
- CORRIGE : quatre défauts OAuth Z01–Z04 par propriétaire unique (contrat Zernio, profil autorisé, state/session/compte, tokens gérés par Zernio), cinq connecteurs non qualifiés désactivés ; adaptateur SunoAPI tiers authentifié avec soumission unique et contrat vérifié.
- TESTE : contrats 537 PASS/7 SKIP ; médias 31 PASS + moteur ; PostgreSQL 12 + 254 assertions + 13 contrôles migration locale ; rollback unitaire 17 ; TypeScript/lint/build PASS (111 avertissements historiques) ; redteam 14 ; browser 210/164 audits axe et browser-redteam 210+7/165 audits axe ; legacy 1022/25 SKIP ; UI sociale 28 ; audit dépendances 0 haute/critique (5 modérées/2 faibles conservées). Aucun test requis rouge.
- BLOQUE EXTERNE : RunPod 401 après normalisation, Shotstack 403 sur les quatre couples clé/environnement ; `ZERNIO_PROFILE_BINDINGS` absent puis consentements utilisateurs requis. Ancienne configuration Suno applicative incompatible : activation distante future uniquement.
- NON TESTE : génération réelle, publication réelle, tokens sociaux/rotation/révocation réels, cinq connecteurs désactivés ; limites TikTok/Pinterest du rapport T06 non qualifiées pour activation. Aucune certification de release.
- WIP : 359 fichiers tiers sauvegardés privés et identiques ; T02–T08 propres aux SHAs vérifiés, handoffs conservés et FERMABLE. T01 fermable après commit de ce jalon. Aucun terminal/service existant fermé.

Preuves et commandes exactes : `qa/final-integration-20261013/README.md`, manifest source, matrice de clôture et reçus. Prochaine tâche : seules actions de compte documentées RunPod/Shotstack, attribution Zernio puis consentements ; aucune répétition des PASS inchangés.

Complément utilisateur 23h55 : mise en service OVH SUTRA autorisée après commit/manifeste/gates de ce jalon, sauvegarde/rollback vérifiés et smokes gratuits ; le plafond local précédent est remplacé pour cette étape suivante. Aucune dépense, génération, publication ni rotation. Le déploiement n’est pas encore une preuve de ce commit.


## 2026-10-14 — T01 mise en service OVH finale (autorisation 23h55)

VERIFIED : production `e3b17117256269e281304cd4ab83bc722a6f7894`, https://sutra.purama.dev ; CI 38475022601 trois jobs SUCCESS, artefacts finaux contrôlés. Candidat exact et ancien runtime isolés PASS, sauvegarde fraîche 140 tables restaurées et comparées. Table OAuth absente détectée puis migration existante additive testée deux fois sur copie, appliquée en production sans modification de données existantes. Seule SUNO_API_BASE_URL ajoutée depuis le maître, origines/clefs applicatives préservées.

VERIFIED : smokes publics/internes, 58 contrôles cron/OAuth/auth, 30 médias, 28 origines, 16 schéma, 120 droits SQL, 36 GET Supabase, navigateur 1440/375 et captures examinées, DNS Cloudflare direct OVH/TLSv1.3 valides, logs/santé DB PASS. Aucun rollback nécessaire, aucune génération/depense/publication/rotation. Aucun test requis rouge. WIP tiers 359 fichiers identiques, T02–T08 propres et fermables ; aucun terminal fermé.

BLOQUE EXTERNE : RunPod401, Shotstack403 ; attribution utilisateur/organisation Zernio absente puis consentements requis. NON TESTE : parcours connecté réel projet/pipeline/export (identité de recette requise), génération/publication et tokens sociaux réels. Ne pas qualifier ces fonctions en production sur la seule base des fixtures.

Rapport faisant foi pour ce jalon : `qa/ovh-final-providers-20261014/README.md`. Le commit documentaire de ce jalon ne change pas l'image déployée. Prochaine tâche : seulement les actions de compte et d'identité précisées dans ce rapport ; ne pas rejouer les PASS inchangés. Rollback disponible : `python3 deploy/ovh.py rollback --source-ref e3b17117256269e281304cd4ab83bc722a6f7894` (conserve SQL/données).


## 2026-10-14 — T01 activation fournisseurs après autorisation 01h25–01h26

VERIFIED : quatre variables RunPod/Shotstack synchronisées depuis le maître sans exposition, liaison Zernio univoque au profil existant possédé vérifiée avec identité serveur et organisation PURAMA autorisée. Backup privé exact, seul SUTRA recréé, image e3b1711 inchangée, dix smokes PASS. RunPod health et Shotstack templates stage/v1 HTTP200 + contrats conformes, Zernio propriété/liaison PASS et zéro compte social connecté. 17 tests activation/rollback et 50 contrats ciblés PASS, lint/syntaxe PASS. Les blocages de clés/identité précédents sont levés pour ces lectures ; génération réelle et consentements NON TESTÉS. Détail : qa/provider-activation-20261014/README.md.

IN_PROGRESS distinct : mandat utilisateur 01h42, sept terminaux T02–T08 réactivés avec scopes distincts pour Salad ; ne pas reprendre les statuts FERMABLE du jalon précédent pour leur nouveau WIP. T04 seul adaptateur/raccord backend, T07 seule UI, autres lots tests. T01 conserve intégration et OVH/Zernio. Aucun GPU/provisioning/dépense/publication activé.

Complément recette : six GET authentifiés publics PASS avec l’identité utilisateur autorisée ; session de test seule révoquée, aucun email ni génération. Preuve : qa/provider-activation-20261014/authenticated-smoke.json. Aucun projet créé ni rendu/export réel revendiqué.

- 2026-10-14 T01 : défaut T08-MODE-03 corrigé dans api/create seulement, messages publics sur liste fermée. Quatre tests T08 exécutés sur code T01 hors réseau PASS, TypeScript global et lint ciblé PASS. Preuve qa/salad-integration-20261014/mode-error-milestone.json. Intégration Salad toujours en cours ; T04 adaptateur, T07 UI/reconnexion, T05 média, T02/T03/T06/T08 tests, aucun doublon. Aucun GPU ni génération.

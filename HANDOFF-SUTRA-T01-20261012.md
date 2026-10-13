# SUTRA T01 — verification finale post-deploiement, 2026-10-13

**OVH OPERATIONNEL / RECETTE CONNECTEE NON VERIFIEE.** Application `f770e272d2d8e3bb3dde5b523fe7aa37f122399d`, URL https://sutra.purama.dev . CI exacte [38330861913](https://github.com/puramapro-oss/sutra/actions/runs/38330861913) : trois jobs SUCCESS. Image `sha256:956b477deb4b7049914db5f51d934cf15fb0c3ea5fe289d6029c23b4c599e417`, promue le 2026-10-13 a 01:29 UTC. Le commit documentaire de ce rapport ne change pas l'image applicative.

## Corrections minimales et preuves

Deux defauts publics reproduits puis corriges : callback Auth dirige vers l'origine interne `0.0.0.0:3000` ; POST avec Origin public legitime refuse par CSRF. L'origine canonique est maintenant validee depuis la configuration de confiance ; aucun en-tete forwarded n'est considere comme autorite. Cookies, chemins de retour locaux et gardes de droits sont conserves. Sept regressions ajoutees, revue securite PASS. Aucun autre code applicatif modifie pour cette verification.

Candidat exact sans reseau : 5 GET + FFmpeg + 14 controles origine PASS. Promotion uniquement apres CI verte, snapshot exclusif du Compose/runtime precedent, controle image ID/label, configuration opaque inchangee. Apres promotion : 28 controles origine/auth (14 internes + 14 publics), 10 smokes GET et 120 assertions SQL PASS. Aucune migration pour ce correctif. Aucun appel payant ; `/api/health` volontairement exclu car il contacte des fournisseurs.

Navigateur Chromium public reel : 1440x1000 et 375x812, redirection de page protegee vers login sur le domaine public, `next` conserve, email invalide bloque, callback sans code avec alerte visible. Captures affichees et inspectees : formulaire lisible, aucun debordement, aucune erreur JS. Toutes les mutations sont bloquees par la recette, y compris le POST d'enregistrement du refus des cookies. Accueil public deja affiche et inspecte au deploiement precedent, code inchange ; GET final 200.

Securite publique conservee : 42 assertions cron (absence/faux jeton), 9 callbacks sociaux negatifs, 30 assertions medias (references/grants invalides et en-tetes prives). Les fichiers concernes n'ont pas change ; voir `qa/postdeploy-20261013/root/evidence-reuse.json`. Les gardes origine modifies ont ete revalides sur la nouvelle image. Aucun cron authentifie ni consentement OAuth reel declenche.

## Tests exacts du commit applicatif

| Commande | Resultat |
| --- | --- |
| `npm run test:contracts` | 480 PASS, 7 SKIP ; schedule/composition/publication PASS |
| `npm run test:media` | 34 PASS, FFmpeg reel |
| `node qa/t08/run.mjs redteam` | 14 PASS |
| `npm run check` | typecheck/lint/build PASS ; 111 avertissements lint, 197 routes |
| `node qa/t08/run.mjs browser-redteam` | 217 PASS ; 165 audits axe, 0 violation, 0 erreur navigateur |
| `node scripts/run-ci.mjs legacy` | 1022 PASS, 25 SKIP, 0 FAIL, 0 flaky |
| `npm run test:migration-local` | 13 PASS, PostgreSQL 16 jetable |
| `node --import tsx --test scripts/test-pipeline-postgres.mts` | 12 PASS, concurrence PostgreSQL |
| `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" node scripts/test-security-rls.mjs` | 254 assertions PASS |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` | 17 PASS |
| `npm audit --omit=dev --audit-level=high` | PASS ; 0 high/critical, 2 low et 5 moderate |
| `node qa/postdeploy-20261013/root/public-browser-final.cjs.txt` | Desktop/mobile publics PASS |

Les decompteurs contrats/medias/qualite sont issus du meme code local ou de suites inchangees ; la CI exacte confirme chaque commande PASS. Les nombres navigateur, E2E, RLS et rollback proviennent directement des artefacts/logs de ce run. Les SKIP restent des SKIP : INSEE live, DB distante, OTS reseau et scenarios E2E exclus. Les empreintes des artefacts et la matrice complete sont dans `qa/postdeploy-20261013/root/test-matrix-final.json`.

Les echecs historiques sont conserves : deux defauts produit ; puis deux erreurs du harnais (callback social attendu a tort 307 au lieu de 302, POST de consentement volontairement bloque compte comme regression). Harnais corriges et controles rejoues ; aucun echec de code restant observe dans le perimetre execute.

## Operations, sauvegarde et rollback

Conteneur healthy, 0 restart ; logs apres promotion : 0 erreur fatale, applicative, permission ou connexion DB. PostgreSQL 15.8 : 46/100 connexions, 0 verrou en attente, 0 transaction longue, 137 tables SUTRA. Details horodates : `qa/postdeploy-20261013/root/operations-final.json` ; aucun contenu brut de log ni secret exporte.

Sauvegarde conservee `/opt/purama/apps/sutra/backup-t01-coherent-qdule8xx` : six empreintes revalidees, repertoire 0700/fichiers 0600. Preuve de restauration deja acquise et conservee : 140 tables aux comptages identiques, huit migrations rejouees deux fois sur copie privee. Pas de nouvelle restauration inutile pour ce delta sans SQL. Limites de sauvegarde : Auth limite aux ID references, pas de backup complet Auth ; blobs non geles transactionnellement. Les fichiers source et donnees historiques restent preserves.

Snapshot exclusif du deploiement precedent 3e5596e : `/opt/purama/apps/sutra/rollback-f770e272d2d8e3bb3dde5b523fe7aa37f122399d`. Mecanisme rollback reel deja exerce lors du deploiement precedent, 17 tests frais PASS ; aucun echec critique de la promotion actuelle, donc aucun rollback volontaire effectue. Commande exacte depuis le worktree T01 :

```sh
python3 deploy/ovh.py rollback --source-ref f770e272d2d8e3bb3dde5b523fe7aa37f122399d
```

Restaure image/Compose/runtime precedents ; SQL et DNS inchanges. Ne pas restaurer une ancienne base par-dessus les ecritures courantes, ni rouvrir le bucket media prive. Anciennes images et Vercel conserves. Procedure executee, gates et rollback automatique : `qa/postdeploy-20261013/root/promote-origin-fix.py.txt`, revue independante `qa/postdeploy-20261013/security/PROMOTION-REVIEW.md`.

Cloudflare : A `sutra.purama.dev` -> `144.217.14.210`, DNS-only, TTL Auto conserve. Reponses coherentes des deux autoritaires et de 1.1.1.1/8.8.8.8 ; aucun AAAA. TLS verifie normalement, TLSv1.3, Let's Encrypt, SAN exact, expiration 2027-01-10. Meta Cloudflare reprise du controle API du deploiement precedent ; DNS/TLS relus en direct, aucune modification pour ce correctif.

## Unique action manuelle restante

Fournir **uniquement l'adresse d'un compte SUTRA existant dedie a la recette**, jamais son mot de passe. Aucun compte QA configure ou identifie ; creer un utilisateur Auth declencherait des ecritures dans 57 autres schemas et sortirait du mandat SUTRA. Ne pas creer de compte global, desactiver de trigger ou emprunter un compte utilisateur reel.

Connexion complete, creation de projet, pipeline gratuit authentifie, lecture media prive et export SRT **NON VERIFIES EN PRODUCTION** faute de cette session. Les preuves CI avec fixtures/PostgreSQL restent valides, sans etre presentees comme recette live. Sondes gratuites preparees dans `qa/postdeploy-20261013/media/free-runtime-probes.mjs`. Generation, export video fournisseur et publication payants exclus par instruction ; aucun besoin de les appeler pour terminer la recette gratuite.

LOCKS/handoffs et branches inspectes avant ecriture ; lots auxiliaires bornes securite/medias seulement, livres et revus. 53 worktrees etrangers et cinq SHA proteges conserves. GitNexus impact avant code, detect-changes avant commits ; index historique en retard/tronque, aucune exhaustivite revendiquee. Aucun reset, stash, clean, secret expose ou processus etranger arrete.

---

## Archive du deploiement precedent — remplacee par le verdict ci-dessus

# SUTRA T01 — production OVH, 2026-10-13

**DEPLOYE / CI ET SMOKES GRATUITS PASS.** Commit applicatif `3e5596ea287f36427f687d3f3882d35c3f7c407b`, branche `codex/sutra-t01-integration-20261012`, URL https://sutra.purama.dev . CI exacte : https://github.com/puramapro-oss/sutra/actions/runs/38322846966 . L’image déployée est `sha256:4c773d0275baf2260b341901775c7b0f47a64bea5c4c711a686ed4643393e6b3`. Les commits de preuves ultérieurs ne changent pas cette image.

## Intégration et corrections

Les sept livraisons T02–T08 restent intégrées : 1105 empreintes vérifiées, 329 chemins acceptés sans fusion globale ; références propriétaires dans `qa/release-20261012/deliveries.json` et `accepted-content-audit.json`. Les cinq ancêtres protégés 35c137f/a322e53/e1bdd1b/05d164d/7088a0a restent présents. Main, branches propriétaires et 53 worktrees étrangers conservés ; contrôle `qa/deployment-20261013/preservation-release.json`.

La CI 9b0c2c9 a été relancée après l’ajout du secret SMARANA. Le setup fonctionne ; trois courses de navigation E2E ont été corrigées dans 3591818 par des attentes sur les liens visibles et l’URL finale, sans désactiver de test. CI 3591818 verte.

Un premier déploiement 3591818 a passé HTTP/HTTPS, puis le smoke Supabase a révélé 403 sur video_jobs. Rollback applicatif réel exécuté, ancienne image healthy. Les migrations v10/v11 avaient une politique RLS service mais aucun privilège SQL correspondant. Le test injectait des ACL par défaut qui masquaient ce défaut. aaa94f2 supprime cette hypothèse et ajoute SELECT/INSERT/UPDATE sur jobs/quota. 3e5596e corrige le même défaut sur une liste explicite de 25 tables v3 utilisées par les routes serveur. Aucun droit client ou barème modifié ; DELETE réservé au toggle love_reactions. Les 254 assertions de sécurité passent sous PostgreSQL 15 isolé et dans la CI finale. Les 120 contrôles SQL et 35 GET Supabase live passent après correction.

Une première tentative de promotion de 3e5596e a également échoué sur une erreur de syntaxe du script opératoire, après les migrations mais avant le remplacement de l’image. Le rollback a confirmé l’ancienne image saine. Le script corrigé a été compilé avant exécution ; la reprise a réutilisé le snapshot intact et les migrations validées, sans les rejouer. Voir `release-failure-rollback.json` et `release-procedure.py.txt`.

## Tests exacts du commit déployé

| Commande CI | Résultat |
| --- | --- |
| `npm run test:contracts` | 473 PASS, 7 SKIP ; schedule/composition/publication PASS |
| `npm run test:media` | 34 PASS, FFmpeg réel |
| `node qa/t08/run.mjs redteam` | 14 PASS |
| `npm run check` | typecheck/lint/build PASS ; 111 avertissements lint, 197 pages |
| `node qa/t08/run.mjs browser-redteam` | 210+7 contrôles PASS ; 165 audits axe, 0 violation, 0 erreur navigateur |
| `node scripts/run-ci.mjs legacy` | 1022 PASS, 25 SKIP, 0 échec, 0 flaky |
| `npm run test:migration-local` | 13 contrôles PASS, PostgreSQL 16 jetable |
| `node --import tsx --test scripts/test-pipeline-postgres.mts` | 12 PASS, concurrence PostgreSQL |
| `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" node scripts/test-security-rls.mjs` | 254 assertions PASS |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` | 17 PASS |
| `npm audit --omit=dev --audit-level=high` | PASS ; 0 high/critical, 2 low/5 moderate |

Les décomptes contrats/médias et lint/build proviennent des logs locaux du même périmètre inchangé ; la CI finale confirme les commandes PASS et fournit les décomptes E2E/PostgreSQL ci-dessus. Les 7 SKIP contrats sont 4 INSEE live, 2 DB distante et 1 OTS réseau. Les 25 SKIP E2E ne deviennent pas des PASS. La CI complète est la gate finale ; aucun appel fournisseur payant. L’essai local PostgreSQL Mac a aussi rencontré une saturation des segments mémoire système : aucun processus étranger arrêté, validation remplacée par un cluster PostgreSQL 15 isolé Docker sans réseau, 254 assertions PASS. Les échecs historiques et le rollback sont conservés dans les preuves.

## Sauvegardes, migrations et déploiement

Sauvegarde fraîche : `/opt/purama/apps/sutra/backup-t01-coherent-qdule8xx` ; restauration privée `sutra_restore_t01_qdule8xx`. 140 tables restaurées avec comptages identiques. SUTRA et trois tables publiques sociales partagent un snapshot read-only ; dépendance trigger, métadonnées Storage et archive des blobs incluses. Huit migrations appliquées deux fois sur la copie PostgreSQL 15.8. Auth est une fixture limitée aux ID référencés, pas une sauvegarde complète Supabase/Auth ; blobs non gelés transactionnellement. Données, secrets et diagnostics restent dans le répertoire OVH 0700. Empreintes : `backup-release.json`.

Ordre : v10_durable_jobs_quota, v11_pipeline_checkpoints, 20261012_social_publication_journals, 20261012_private_media, 20261012_t02_account_permissions, 20261012_t02_final_permissions, 20261013_job_service_permissions, 20261013_feature_service_permissions. Les six premières migrations ont été appliquées dans une transaction avant 3591818 ; les deux correctives dans une transaction avec 120 assertions avant COMMIT. Verrou 5 s et timeout 90 s ; pas de migration d’une autre app.

Le candidat Linux est construit depuis l’archive Git exacte, SMARANA verrouillé bc3469eb595485714b2044790105acfc5e3b0f31, ESLint du même commit. Conteneur candidat sans réseau externe : cinq GET et FFmpeg subtitles/drawtext/ffprobe PASS. Promotion de cette image exacte avec runtime conservé opaquément. Le helper partagé de déploiement générique a un faux écart : son filtre remote-only exclut deux variables Upstash également présentes côté source ; comparaison opaque confirme les 77 clés identiques. Le helper partagé n’a pas été modifié. La promotion contrôlée contourne ce faux écart en gardant Compose/runtime, en remplaçant seulement l’image et en ajoutant le resolver TLS du routeur SUTRA.

Snapshot applicatif `/opt/purama/apps/sutra/rollback-3e5596ea287f36427f687d3f3882d35c3f7c407b` conservé. Toute erreur de santé, de Supabase ou des smokes déclenche le rollback. Exemple réel 3591818 documenté dans `db-smoke-rollback.json`. Commande exacte depuis ce worktree :

```sh
python3 deploy/ovh.py rollback --source-ref 3e5596ea287f36427f687d3f3882d35c3f7c407b
```

Ce rollback restaure Compose/runtime et l’ancienne image ; il ne restaure pas SQL ni DNS. Les changements SQL additifs et les permissions fermées restent en place. Ne jamais restaurer une ancienne base par-dessus de nouvelles écritures sans analyse. Ne jamais rouvrir le bucket média privé pour rollback. Anciennes images, dumps et Vercel conservés.

## Smokes et Cloudflare

- Interne + HTTPS public : `/`200, `/login`200, `/api/points`401, `/api/video/status/00000000-0000-0000-0000-000000000000`401, `/api/media/b3duZXJzL3UvdGVzdC5tcDQ`401.
- `permissions-live-check.sql` : 120 assertions, y compris protection des colonnes admin/crédits, refus des clients sur les tables privées et bucket non public.
- `supabase-readonly-smoke.mjs` : 35 GET REST avec `limit=0`, 200 attendus ; aucune donnée retournée, écriture ou publication.
- Navigateur public réel Chromium : accueil hydraté puis formulaire de connexion visible, animation terminée, 1440×1000 et 375×812 ; captures affichées et inspectées. Requêtes mutantes bloquées, y compris enregistrement serveur du choix cookies ; aucun formulaire de connexion envoyé.
- Cloudflare : A`sutra`→144.217.14.210, DNS only, TTL Auto ; deux serveurs autoritaires et résolveurs 1.1.1.1/8.8.8.8 cohérents, aucun AAAA.
- TLS Let’s Encrypt, SAN sutra.purama.dev, validation normale sans désactiver la vérification. Resolver renouvelable ajouté uniquement au routeur SUTRA ; proxy partagé intact.

Preuves finales : `qa/deployment-20261013/deployment-release.json`, `ci-release-run.json`, `backup-release.json`, `permissions-production-release.json`, `supabase-release-smoke.json`, `dns-tls-release.json`, `public-browser-release.json`, `test-matrix-release.json`. La route `/api/health` est exclue car elle contacte des fournisseurs payants.

## Limites et reprise

Aucune action manuelle indispensable pour ce déploiement ; secret SMARANA résolu. Les parcours utilisateur authentifiés live, génération et publication payantes ne sont pas revendiqués. Les médias utilisent des références durables autorisées, signatures temporaires renouvelables et registres service-only ; un objet historique sans propriétaire reste conservé et non attribué.

La branche S5 historique non validée n’est pas fusionnée : budget hybride, restauration de versions et journal cron-runs non livrés ; édition du script sans régénération de voix. Ces limites ne constituent pas des preuves de fonctionnalités livrées.

POLICY_OK au démarrage. GitNexus impact service client CRITICAL signalé avant correction ; nouveau SQL non indexé. Graphe TRUNCATED et en retard : les diffs directs, tests et contrôles live constituent des preuves bornées ; aucune prétention d’exhaustivité. Detect-changes exécuté avant chaque commit, puis avant le commit documentaire final. Aucun reset/stash/clean, secret exposé, WIP étranger écrasé, processus étranger arrêté ou worktree supprimé.

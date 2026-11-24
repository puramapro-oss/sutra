# SUTRA T01 — état courant : candidat testé3855665, production86d04c8

**INTEGRE / TESTE CI ; promotion BLOQUEE par la validation indépendante finale T08 absente.** Dossier courant : [qa/t01-consolidation-20261014/README.md](qa/t01-consolidation-20261014/README.md), matrice53 exigences41PASS/0FAIL/2BLOQUE/10NONTESTE. CI38598361267 trois jobs SUCCESS sur `3855665fa79e3cc2171124d864a834214d6ac617` ; aucun déploiement ni migration de ce candidat. Production saine `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164` sur https://sutra.purama.dev, dernière preuve16:41UTC. Sept livraisons/WIP préservés, aucun terminal fermé.

Prochaine action : avis du T08 original sur ce SHA exact, puis préconditions/backup frais/rollback et promotion autorisée par T01. La CI verte ne remplace pas cet avis. Aucun nouvel audit général ; consentements personnels et génération/publication réelles restent non testés. Les sections suivantes sont historiques et ne remplacent pas ce statut.

---

# SUTRA — jalon intégration Salad désactivée, 2026-10-14

Candidat intégré et gates locales PASS : `qa/salad-integration-20261014/README.md`. Sept lots T02–T08 vérifiés ; défauts modes, reprise durable production, média et reconnexion corrigés. Contrats666/7skip, médias59, PostgreSQL7, promotion24, TS/lint/build verts. Aucun GPU activé ni migration distante. Configuration RunPod/Shotstack et binding Zernio déjà vérifiés ; consentements sociaux et qualification GPU restent externes. Prochaine étape autorisée : commit exact, CI complète, candidat OVH isolé, sauvegarde/restauration puis promotion SUTRA seule. Aucun déploiement de ce candidat encore attesté. Les sections suivantes sont historiques.

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


## 2026-10-14 — T01 intégration Salad, candidat d8691d8

INTEGRE : T02 b7b60be, T03 1b45f71, T04 fd28318, T05 cca76a2, T06 48c3191, T07 ace3e0d et T08 8926699 vérifiés et réconciliés dans 111c134 puis correctif CI d8691d8ac6cf885f8e5522f361f45ebe229ec20d. Aucun doublon, terminal fermé, WIP écrasé ni GPU démarré. Adaptateur/host distant exécutables désactivés ; PostgreSQL externe durable, checkpoints UNKNOWN permanents, owner-only, budgets et UI explicites. Corrigés : faux export transformé, reconnexion sociale, preflight avant fournisseur et message incertain sûr.

TESTE : 666 contrats PASS/7 exclusions réseau explicites ;59 médias ;7 tests PostgreSQL réel de journal/concurrence/reprise ;24 tests déploiement/rollback ;TypeScript/lint/build PASS. Browser-redteam local210 contrôles +165 audits accessibilité +7 contrôles supplémentaires PASS. CI38494320084 : contrats et PostgreSQL SUCCESS ; première tentative quality arrêtée sur attente networkidle bibliothèque15s, zéro erreur JavaScript,178 contrôles terminés. Une seule reprise du job quality en cours au même SHA, aucun changement produit pour ce timeout isolé. Le premier échec CI111c134 reste archivé et non promu.

PREPARE : candidat OVH d8691d8 isolé sans réseau PASS ;backup cohérent141 tables restauré et comparé ;rollback prêt. Production reste e3b1711 tant que trois jobs CI ne sont pas verts. Aucune migration distante nécessaire pour Salad désactivé. Preuves : qa/salad-integration-20261014/README.md et reçus associés.

BLOQUE EXTERNE : activation Salad nécessite autorisation ressource/budget et qualification GPU/modèle24Go ;configuration Salad absente du maître, aucune valeur inventée. RunPod/Shotstack authentifiés depuis activation précédente ;Zernio liaison unique existante vérifiée, consentements utilisateur seuls manquants. NON TESTE : génération/rendu/export réels et publication. Ne pas assimiler HTTP200 ou fixtures à une preuve GPU.


## 2026-10-14 — T01 clôture intégration et OVH, d8691d8

INTEGRE / TESTE / DEPLOYE : `d8691d8ac6cf885f8e5522f361f45ebe229ec20d` actif sur https://sutra.purama.dev. Trois jobs CI38494320084 SUCCESS ; deuxième tentative quality PASS au même SHA après timeout réseau navigateur isolé, première preuve conservée. Contrats666 PASS/7 SKIP, médias59, redteam14, navigateur210+7 contrôles/165axe, legacy1022 PASS/25 SKIP/0 flaky, TypeScript/lint/build, PostgreSQL et24 tests déploiement verts. npm audit production :0 high/critical,2 low/5 moderate conservés ;111 warnings lint hérités.

VERIFIED OVH :873 empreintes du manifeste identiques, candidat sans réseau, sauvegarde141 tables restaurée/comparée, ancienne image de rollback testée. Promotion SUTRA seule ;0 migration/activation GPU/dépense/publication/rotation.8 GET public/interne +7 authentifiés +3 bibliothèque/sous-titres CPU/export SRT PASS ;58 refus sécurité +30 médias PASS ;desktop/mobile1440/375 inspectés. Runtime sain0 restart/0 erreur, base saine,71 autres conteneurs inchangés. Config fournisseur/origine conservée. RunPod health200+contrat (0 worker prêt), Shotstack stage/v1 templates200+contrats, Zernio liaison/propriété unique vérifiée et0 compte connecté.

BLOQUE EXTERNE : Salad reste désactivé, ressource/budget/qualification container amd64-CUDA/modèle24Go non autorisés/prouvés ;sept variables de préparation absentes du maître. Aucun mode local Mac disponible. NON TESTE : GPU réel, génération/rendu vidéo/export vidéo/pipeline complet/publication et consentements sociaux. Export SRT déterministe réel seul validé. Mode API client conservé/testé en simulation, pas de fallback payant propriétaire. Actions utilisateur : consentir aux réseaux souhaités depuis /settings/social ;autoriser ressource/budget Salad et renseigner clé sécurisée si activation voulue ;autoriser tout test fournisseur payant après devis exact.

PRESERVATION : T02–T08 SHA/handoffs propres inchangés et FERMABLE_PRESERVED_NOT_CLOSED ;359 fichiers WIP étrangers et7 fichiers GitNexus générés identiques aux sauvegardes privées. Aucun terminal/service fermé hors sondes temporaires propres. Dossier faisant foi : qa/salad-integration-20261014/README.md et FINAL-MATRIX.md. Prochaine reprise : seulement ces actions externes, ne pas rejouer les gates inchangées. Rollback disponible : `python3 deploy/ovh.py rollback --source-ref d8691d8ac6cf885f8e5522f361f45ebe229ec20d`. Les preuves documentaires ultérieures ne modifient pas le code déployé.


## T01 — clôture finale OVH, 14 octobre 2026 04:41 UTC

DÉPLOYÉ / TESTÉ : code86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164, CI38508390596 trois jobs verts. Sept deltas exacts baseb7cf848 intégrés, aucun fichier disputé restant ; SHA et préservation dans qa/final-delta-20261014/terminal-preservation-final.json. Contrats805PASS/7SKIP, médias CPU, PostgreSQL/RLS/concurrence, TypeScript/lint/build, navigateurs, sécurité et24 tests déploiement PASS. Commandes exactes FINAL-TESTS.json ; ne pas additionner aux lots.

OVH : sauvegarde141 tables restaurée/comparée, candidat exact et rollback image isolés PASS, promotion SUTRA seule. Smokes gratuits, média privé (hash/Range/owner), sous-titres et SRT CPU réels PASS. 10 rendus connectés1440/375 PASS ; consentement légal utilisateur en attente, aucune acceptation automatique. RunPod endpoint/Shotstack stage-v1/Zernio owner+PURAMA vérifiés sans génération ; zéro worker RunPod prêt et zéro compte social connecté. DNS/TLS PASS, Cloudflare DNS-only inféré ; API NON TESTÉE.

CORRECTION LIVE : affirmations403 reproduit, privilège SELECT authenticated absent. Migration6800a8de49080157b487eec1119d2fb49c194afe testée8 contrôles sur copie, backup ACL/table et rollback protégés, appliquée04:31UTC sans données/politiques/droits anonymes ou écritures modifiés. Deux vues navigateur corrigées. Image applicative reste86d04c8. Logs : détecteur brut FAIL conservé, trois warnings malformation Server Action puis une sonde dédiée404 ; quatre warnings classés et zéro erreur non classée, origine initiale inconnue. Healthy0restart, base saine, runtime0600inchangé,71 autres conteneurs identiques.

BLOQUÉ/NON TESTÉ : consentement légal puis social utilisateur ; Salad désactivé sans ressource/budget/qualification GPU ; cron/worker OVH autonome absent ; génération/rendu/export vidéo/publication réels non exécutés. Aucun achat/GPU Mac/rotation/publication. Les HTTP200 ne prouvent aucune génération. Actions et matrice bornée dans qa/final-delta-20261014/README.md et FINAL-MATRIX.md. Aucun test applicatif requis encore rouge ; échecs historiques et limites conservés.

PRÉSERVATION : T02–T08 chacun livré/propre/FERMABLE_LOT_SUTRA, aucun terminal fermé ; autres missions exclues. WIP AGENTS/skills étrangers conservés hors commit, cinq références historiques présentes. T01 clôture par commit documentaire séparé ; seuls blocages externes ci-dessus restent. Ne pas rejouer les PASS sans delta. Rollback : python3 deploy/ovh.py rollback --source-ref 86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164 ; rollback SQL privé séparé, jamais restaurer une vieille base au-dessus de nouvelles écritures.


## T01 — gate navigateur production, 2026-10-14T16:25:10.951798+00:00
CIa10 reste FAIL légal en dev (cause exacte non prouvée) ; repro CPU4/délai6s15PASS. Les mêmes assertions sur un seul build production isolé : légal15PASS, parcours34PASS, privé9PASS,0FAIL,0erreur/externe/mutation imprévue. Trois sessions/états séparés ; aucun consentement personnel ni fournisseur. CI utilise ce mode et collecte un dossier neuf pour éviter preuves historiques prises pour résultats frais. Produit/SQL inchangés. Nouveau SHA/CI et ACK T08 toujours requis ; production86d inchangée. Preuve qa/t01-consolidation-20261014/production-browser-correction.json.


## T01 — campagne finale exacte et promotion conditionnée, 2026-10-14T16:55:48.931637+00:00

INTEGRE/TESTE : candidat3855665fa79e3cc2171124d864a834214d6ac617 ; CI38598361267 SUCCESS trois jobs. Contrats870PASS/7SKIP, médias120PASS ; PostgreSQL16/7/26 et259assertionsRLS ; TS/lint/buildPASS ; navigateur210+7,165axe0violation, bibliothèque25, légal15/parcours34/privé9 ; legacy1022PASS/25SKIP/0flaky. Simulations déploiement34/migration16/promotion7PASS, sans additionner les recouvrements. Audit0high/critical,2low/5moderate. Commandes et preuves qa/t01-consolidation-20261014/README.md et ci-3855665-tests.json.

Sept lots propres/préservés,66fichiers manifeste identiques,7WIP étrangers inchangés. Matrice T01 provisoire41PASS/0FAIL/2BLOQUE/10NONTESTE ; avis indépendant final T08 absent. Blocage exact : utilisateur exige cette recette avant promotion ; T08 original non joignable via MacDevBridge -32603, aucun remplaçant/ACK présumé. Prochaine tâche unique : recevoir ACK T08 sur3855665, puis préconditions/backup frais et promotion autorisée, sans rejouer toute la CI.

Production86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164 saine/inchangée au16:41UTC. Candidat exact image4d8f5358 construit/testé sans réseau et arrêté ; backup141tables restauré/comparé, migration3fonctions testée/copierollback, non appliquée. Cron infrastructure absente et exécuteurs maintenus inactifs, observateur lecture seule testé seulement. Aucun GPU/paid/publication/consentement personnel. Documentation ultérieure ne remplace pas le SHA testé. Tous terminaux préservés/non fermés.


## T01 R74/R94 — 2026-10-15T23:49:19.184945+00:00
Annulation create durable livree via queue/control existants; aucun second moteur. 11 navigateur+PG et10 contrats PASS, TS/lint PASS; pertes ACK,404 initial,reload/restart,late worker,quota/audit unique. R94 en-tete WebKit facultatif sans retirer les assertions stream/abort. Details qa/t01-create-cancel-20261016/README.md. CI exacte/T08 encore requis; runtime86d04c85 inchange, aucun apply/deploy.


## T01 R99 readiness navigateur — 2026-10-16
CI38825902111 rouge networkidle/create; document20072ms, prefetchs sidebar suspendus, aucune erreur navigateur. Harnais seul corrige: DOM+controle pret, assertions/deadlines intactes; lint/syntaxe PASS, E2E exact prochainSHA requis. qa/t01-browser-readiness-20261016/README.md. Produit7d96 identique, runtime86d04c85 inchange, aucun apply/deploy.

# SUTRA — verdict post-deploiement, 2026-10-13

**OVH OPERATIONNEL / RECETTE CONNECTEE NON VERIFIEE.** Application `f770e272d2d8e3bb3dde5b523fe7aa37f122399d`, URL https://sutra.purama.dev . CI exacte [38330861913](https://github.com/puramapro-oss/sutra/actions/runs/38330861913) : trois jobs SUCCESS. Image `sha256:956b477deb4b7049914db5f51d934cf15fb0c3ea5fe289d6029c23b4c599e417`, promue le 2026-10-13 a 01:29 UTC. Le commit documentaire de ce rapport ne change pas l'image applicative.

## Corrections minimales et preuves

Deux defauts publics reproduits puis corriges : callback Auth dirige vers l'origine interne `0.0.0.0:3000` ; POST avec Origin public legitime refuse par CSRF. L'origine canonique est maintenant validee depuis la configuration de confiance ; aucun en-tete forwarded n'est considere comme autorite. Cookies, chemins de retour locaux et gardes de droits sont conserves. Sept regressions ajoutees, revue securite PASS. Aucun autre code applicatif modifie pour cette verification.

Candidat exact sans reseau : 5 GET + FFmpeg + 14 controles origine PASS. Promotion uniquement apres CI verte, snapshot exclusif du Compose/runtime precedent, controle image ID/label, configuration opaque inchangee. Apres promotion : 28 controles origine/auth (14 internes + 14 publics), 10 smokes GET et 120 assertions SQL PASS. Aucune migration pour ce correctif. Aucun appel payant ; `/api/health` volontairement exclu car il contacte des fournisseurs.

Navigateur Chromium public reel : 1440x1000 et 375x812, redirection de page protegee vers login sur le domaine public, `next` conserve, email invalide bloque, callback sans code avec alerte visible. Captures affichees et inspectees : formulaire lisible, aucun debordement, aucune erreur JS. Toutes les mutations sont bloquees par la recette, y compris le POST d'enregistrement du refus des cookies. Accueil public deja affiche et inspecte au deploiement precedent, code inchange ; GET final 200.

Securite publique conservee : 42 assertions cron (absence/faux jeton), 9 callbacks sociaux negatifs, 30 assertions medias (references/grants invalides et en-tetes prives). Les fichiers concernes n'ont pas change ; voir `root/evidence-reuse.json`. Les gardes origine modifies ont ete revalides sur la nouvelle image. Aucun cron authentifie ni consentement OAuth reel declenche.

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

Les decompteurs contrats/medias/qualite sont issus du meme code local ou de suites inchangees ; la CI exacte confirme chaque commande PASS. Les nombres navigateur, E2E, RLS et rollback proviennent directement des artefacts/logs de ce run. Les SKIP restent des SKIP : INSEE live, DB distante, OTS reseau et scenarios E2E exclus. Les empreintes des artefacts et la matrice complete sont dans `root/test-matrix-final.json`.

Les echecs historiques sont conserves : deux defauts produit ; puis deux erreurs du harnais (callback social attendu a tort 307 au lieu de 302, POST de consentement volontairement bloque compte comme regression). Harnais corriges et controles rejoues ; aucun echec de code restant observe dans le perimetre execute.

## Operations, sauvegarde et rollback

Conteneur healthy, 0 restart ; logs apres promotion : 0 erreur fatale, applicative, permission ou connexion DB. PostgreSQL 15.8 : 46/100 connexions, 0 verrou en attente, 0 transaction longue, 137 tables SUTRA. Details horodates : `root/operations-final.json` ; aucun contenu brut de log ni secret exporte.

Sauvegarde conservee `/opt/purama/apps/sutra/backup-t01-coherent-qdule8xx` : six empreintes revalidees, repertoire 0700/fichiers 0600. Preuve de restauration deja acquise et conservee : 140 tables aux comptages identiques, huit migrations rejouees deux fois sur copie privee. Pas de nouvelle restauration inutile pour ce delta sans SQL. Limites de sauvegarde : Auth limite aux ID references, pas de backup complet Auth ; blobs non geles transactionnellement. Les fichiers source et donnees historiques restent preserves.

Snapshot exclusif du deploiement precedent 3e5596e : `/opt/purama/apps/sutra/rollback-f770e272d2d8e3bb3dde5b523fe7aa37f122399d`. Mecanisme rollback reel deja exerce lors du deploiement precedent, 17 tests frais PASS ; aucun echec critique de la promotion actuelle, donc aucun rollback volontaire effectue. Commande exacte depuis le worktree T01 :

```sh
python3 deploy/ovh.py rollback --source-ref f770e272d2d8e3bb3dde5b523fe7aa37f122399d
```

Restaure image/Compose/runtime precedents ; SQL et DNS inchanges. Ne pas restaurer une ancienne base par-dessus les ecritures courantes, ni rouvrir le bucket media prive. Anciennes images et Vercel conserves. Procedure executee, gates et rollback automatique : `root/promote-origin-fix.py.txt`, revue independante `security/PROMOTION-REVIEW.md`.

Cloudflare : A `sutra.purama.dev` -> `144.217.14.210`, DNS-only, TTL Auto conserve. Reponses coherentes des deux autoritaires et de 1.1.1.1/8.8.8.8 ; aucun AAAA. TLS verifie normalement, TLSv1.3, Let's Encrypt, SAN exact, expiration 2027-01-10. Meta Cloudflare reprise du controle API du deploiement precedent ; DNS/TLS relus en direct, aucune modification pour ce correctif.

## Unique action manuelle restante

Fournir **uniquement l'adresse d'un compte SUTRA existant dedie a la recette**, jamais son mot de passe. Aucun compte QA configure ou identifie ; creer un utilisateur Auth declencherait des ecritures dans 57 autres schemas et sortirait du mandat SUTRA. Ne pas creer de compte global, desactiver de trigger ou emprunter un compte utilisateur reel.

Connexion complete, creation de projet, pipeline gratuit authentifie, lecture media prive et export SRT **NON VERIFIES EN PRODUCTION** faute de cette session. Les preuves CI avec fixtures/PostgreSQL restent valides, sans etre presentees comme recette live. Sondes gratuites preparees dans `media/free-runtime-probes.mjs`. Generation, export video fournisseur et publication payants exclus par instruction ; aucun besoin de les appeler pour terminer la recette gratuite.

LOCKS/handoffs et branches inspectes avant ecriture ; lots auxiliaires bornes securite/medias seulement, livres et revus. 53 worktrees etrangers et cinq SHA proteges conserves. GitNexus impact avant code, detect-changes avant commits ; index historique en retard/tronque, aucune exhaustivite revendiquee. Aucun reset, stash, clean, secret expose ou processus etranger arrete.

# SUTRA — mise en service OVH, 14 octobre 2026

**DÉPLOYÉ / TESTÉ : `e3b17117256269e281304cd4ab83bc722a6f7894`**, https://sutra.purama.dev . Branche `codex/sutra-final-providers-20261013`. La CI exacte [38475022601](https://github.com/puramapro-oss/sutra/actions/runs/38475022601) est verte : contrats, quality, PostgreSQL. Aucun test requis rouge. Les fonctions dépendant des comptes RunPod/Shotstack/Zernio restent bloquées ; le parcours connecté réel n'est pas certifié.

## Autorité et périmètre

Le complément utilisateur 23h55 autorise cette mise en service après le jalon local ; il remplace son plafond précédent. Règles de déploiement lues, cible active contrôlée en lecture seule, promotion relue indépendamment. Seul le conteneur SUTRA a été remplacé. Aucun autre service, terminal, branche main ou WIP tiers modifié ; aucune génération payante, publication ou rotation. Le commit documentaire contenant ce rapport n'est pas une nouvelle version applicative déployée.

Les six deltas livrés sont intégrés par chemins revus ; leurs SHA, dépendances, corrections OAuth Z01–Z04, SunoAPI et tous les tests locaux figurent dans [le rapport d'intégration](../final-integration-20261013/README.md). Les 838 entrées du manifeste testé correspondent aux octets du commit déployé. Les cinq commits protégés sont préservés. T02–T08 sont propres et leurs handoffs conservés ; 359 fichiers WIP tiers restent identiques à leurs sauvegardes privées. Aucun terminal fermé.

## Promotion et données

- Ancienne production : `f770e272d2d8e3bb3dde5b523fe7aa37f122399d`.
- Image active : `sha256:b0750d6f7552940017a0fcd06422304cafdde0d49aead7bc6e11af98b7d65a16`, healthy, zéro redémarrage après création.
- Sauvegarde fraîche : `/opt/purama/apps/sutra/backup-t01-coherent-ci1vi7kq`, répertoire 0700, archives 0600. Snapshot partagé en lecture seule, 140 tables restaurées dans une base privée, comptes de lignes identiques et empreintes vérifiées.
- Le preflight a découvert `sutra.social_oauth_states` absente malgré sa migration déjà versionnée. `20261011_social_oauth_state.sql` a été appliquée deux fois sur la restauration privée, puis une fois en production après CI verte : additive, 16 assertions de schéma/RLS/droits PASS, zéro ligne existante modifiée. Pas de nouveau delta de migration source.
- Snapshot de retour : `/opt/purama/apps/sutra/rollback-e3b17117256269e281304cd4ab83bc722a6f7894`. Ancienne image + runtime et nouveau candidat + runtime démarrés isolément avec réseau désactivé ; cinq GET PASS chacun. Les tests unitaires de rollback sont verts ; aucun rollback de production n'a été nécessaire lors de cette promotion.
- Source unique des valeurs synchronisées : `~/.env.purama.master`. Seule `SUNO_API_BASE_URL` manquante a été ajoutée. Tous les octets précédents du runtime, origines SUTRA et secrets applicatifs prioritaires ont été conservés. Aucun `.env.local` créé, aucune valeur affichée ou committée, aucune clé remplacée. Runtime/snapshots de configuration 0600.
- Limites de sauvegarde : Auth est une fixture des ID référencés, pas une sauvegarde globale Supabase/Auth ; les blobs ne sont pas gelés transactionnellement. Le rollback applicatif conserve la table additive et ne restaure jamais un ancien dump au-dessus d'écritures courantes.

## Commandes et résultats

Les commandes de préparation/promotion archivées sont liées à ce SHA et à un snapshot exclusif. **Ne pas rejouer `promote.py`** : ce n'est pas une procédure générique. La gate complète locale est conservée sans répétition dans le rapport d'intégration.

| Commande / contrôle | Résultat |
| --- | --- |
| `gh workflow run web-ci.yml --ref codex/sutra-final-providers-20261013` ; `gh run watch 38475022601 --exit-status --interval 30` | Trois jobs SUCCESS au SHA exact. Artefacts finaux téléchargés et contrôlés : typecheck/lint/build, contrats, médias, redteam, E2E et legacy PASS. Détail étapes/log API resté partiellement périmé : artefacts finaux distinctement vérifiés, sans assimiler ce détail périmé à une preuve. |
| `python3 deploy/candidate.py --source-ref e3b17117256269e281304cd4ab83bc722a6f7894` | Build exact, FFmpeg drawtext/subtitles/ffprobe, cinq GET PASS ; conteneur réseau désactivé arrêté ensuite. |
| `backup-restore-executed.py.txt` via SSH stdin | 140 tables restaurées, données comparées ; migration additive rejouée deux fois sur copie. |
| `python3 qa/ovh-final-providers-20261014/promote.py` | PASS, snapshot exclusif, vérification manifeste/CI/image, migration additive, promotion du seul service SUTRA, rollback automatique armé. |
| `ovh.smoke(helper)` puis `ovh.smoke(helper, public=True)` dans la promotion | Cinq GET internes + cinq HTTPS publics PASS. |
| `origin-runtime-probe.cjs.txt` exécuté dans le conteneur, bases interne/publique | 14 + 14 assertions d'origine et d'accès PASS. |
| `oauth-schema-check.sql` ; `permissions-live-check.sql` ; `supabase-readonly-smoke.mjs` étendu à la table OAuth | 16 assertions de schéma + 120 droits SQL + 36 GET Supabase `limit=0` PASS. |
| `python3 qa/ovh-final-providers-20261014/security-probe.py` | 58 PASS, 0 FAIL : cron sans token/avec token synthétique invalide, callback OAuth invalide/sans session, origines et callback auth. Aucun token valide fourni. |
| `node qa/ovh-final-providers-20261014/media-smoke.mjs` | 30 assertions PASS : authentification, chemins non canoniques, cache privé, referrer et headers. Aucun média privé téléchargé. |
| `node qa/ovh-final-providers-20261014/public-browser.cjs` | Desktop 1440×1000 et mobile 375×812 PASS : protection dashboard, next, validation formulaire, message callback, origine canonique, zéro overflow/erreur JS. Mutations réseau bloquées. Les deux captures ont été affichées et examinées. |
| `python3 qa/ovh-final-providers-20261014/dns-tls.py` | DNS autoritaires et 1.1.1.1/8.8.8.8 concordants, TLSv1.3 vérifié. |
| `operations-final.py.txt` via SSH stdin | Zéro erreur fatale/app/DB/permissions détectée dans les logs depuis le démarrage, zéro verrou en attente/transaction longue, 42/100 connexions ; empreintes backup et runtime exact PASS. Aucun log brut exporté. |

Les suites locales/CI se recouvrent et ne doivent pas être additionnées : contrats 537 PASS/7 SKIP, médias 31 + moteur, PostgreSQL 12 + 254 assertions + 13 contrôles migration, rollback 17, redteam 14, navigateur 210 + 7 adversariaux/165 contrôles axe sans violation, legacy 1022 PASS/25 SKIP, UI sociale 28. Lint zéro erreur/111 avertissements historiques ; dépendances zéro vulnérabilité haute/critique, cinq modérées/deux faibles préexistantes. Les SKIP ne sont pas des PASS.

## Fonctions réellement prouvées et limites

| Fonction | Verdict |
| --- | --- |
| Accueil, page de connexion responsive, validation des entrées, redirections sûres, protection des routes privées | TESTÉ sur l'URL publique. Captures de l'erreur de lien volontairement invalide, pas d'une erreur de connexion normale. |
| Supabase serveur, schéma, RLS/droits, stockage privé et refus média non autorisé | TESTÉ en production par lectures bornées/contrôles négatifs. |
| Création de projet, pipeline, reprise, composition locale et export | TESTÉ avec fixtures/cluster jetable dans les gates ; parcours connecté de bout en bout en production NON TESTÉ faute d'identité de recette autorisée. Aucun compte global Auth créé et aucun compte utilisateur emprunté. |
| SunoAPI tiers `api.sunoapi.org` | Authentification gratuite déjà VALIDÉE ; adaptateur et configuration déployés. Génération réelle NON TESTÉE, aucun achat/appel musical. Ce service est un fournisseur tiers indépendant de Suno. |
| RunPod | BLOQUÉ compte : 401 `INVALID_API_KEY` Mac/OVH après normalisation. Aucun test GPU. |
| Shotstack | BLOQUÉ compte : 403 sur stage et v1 pour les deux clés Mac/OVH. Mauvais environnement seul exclu ; activation/révocation/restriction de compte non départageables sans son propriétaire. Aucun rendu. |
| Zernio | API lecture VALIDÉE, un profil/zéro compte. OAuth sécurisé déployé et testé avec contrats ; `ZERNIO_PROFILE_BINDINGS` absent. Identité/profil/organisation non devinés. Consentements et publication réels NON TESTÉS. Cinq connecteurs historiques non qualifiés restent désactivés ; TikTok/Pinterest non certifiés pour publication. |

Cloudflare assure les DNS autoritaires ; A direct OVH `144.217.14.210`, aucun AAAA, comportement DNS-only observé. Aucune modification DNS/TLS. Certificat Let's Encrypt vérifié, SAN correct, expire le 10 janvier 2027 à 22:26:54 UTC. API Cloudflare non interrogée : aucun credential Cloudflare dans la source maître autorisée ; aucune prétention de vérification des réglages WAF/API.

## Actions utilisateur indispensables

1. **RunPod** : vérifier une clé active du bon compte et ses droits sur l'endpoint, puis corriger la source sécurisée si nécessaire. [Clés officielles](https://console.runpod.io/user/credentials), [droits](https://docs.runpod.io/get-started/credentials).
2. **Shotstack** : vérifier les clés stage/production et l'activation du compte ; si les clés actives restent refusées, faire lever la restriction par Shotstack. [Console des clés](https://app.shotstack.io/keys), [guide officiel](https://shotstack.io/docs/guide/getting-started/request-api-keys/).
3. **Identité SUTRA/Zernio** : indiquer l'adresse du compte SUTRA existant dédié à la recette et confirmer s'il peut gérer l'unique profil Zernio, pour quelle organisation. Aucun mot de passe demandé. Lier seulement après cette attribution prouvée ; l'utilisateur effectue ensuite les consentements des réseaux et choisit ses destinations. [Profils](https://docs.zernio.com/multi-tenant), [connexion des réseaux](https://docs.zernio.com/guides/connecting-accounts).

Aucune action Cloudflare n'est nécessaire pour servir l'URL actuelle. Aucun achat ni autorisation payante n'est demandé pour terminer les contrôles gratuits.

Rollback exact depuis ce worktree, seulement si nécessaire :

```sh
python3 deploy/ovh.py rollback --source-ref e3b17117256269e281304cd4ab83bc722a6f7894
```

Il restaure Compose/runtime de `f770e272…`, attend healthy, conserve la table additive et les données courantes. Ne pas utiliser le helper générique de déploiement : le faux écart Upstash connu est documenté dans le runbook et la promotion a préservé les octets applicatifs.

Contrôle de clôture documentaire : `detect_changes(scope=staged)` exécuté avant commit, risque LOW, une section documentaire indexée touchée et aucun processus applicatif affecté. Le graphe partiel n'est pas une certification exhaustive ; revue Git directe : seuls documents et preuves opératoires changent après le commit déployé. Comparaison opaque aux secrets du maître : aucun match. Trois alertes Gitleaks sont des empreintes SHA-256 de sources vérifiées contre le commit déployé, sans exclusion globale ajoutée.

Lint des deux nouveaux scripts de recette : quatre erreurs initiales limitées aux imports/sorties, corrigées sans changement applicatif. Sources initialement exécutées conservées dans `*.executed.txt` ; ESLint, syntaxe Node et six sources Python PASS. Seuls les deux probes modifiés ont été rejoués : médias 30 PASS, navigateur deux formats PASS ; nouvelles captures affichées et examinées. Preuves : `proof-lint-delta.json`, `proof-checks.json`, `visual-review.json`.


## Mise à jour 14 octobre, autorisation 01h25–01h26

Les blocages de clés RunPod/Shotstack et d’attribution Zernio ci-dessus sont historiques et levés pour les lectures authentifiées. Voir [le reçu d’activation](../provider-activation-20261014/README.md) : sauvegarde privée, configuration ciblée, même image, contrats GET et dix smokes PASS. Aucun rendu/génération/publication réalisé ; consentements toujours utilisateur. Les nouvelles missions Salad T02–T08 sont actives et ne sont pas couvertes par les anciens statuts de fermeture.

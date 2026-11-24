# SUTRA — intégration finale fournisseurs, 13 octobre 2026

Branche `codex/sutra-final-providers-20261013`, base `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`. Le commit contenant ce rapport est la livraison locale. Aucun push, déploiement, migration distante, publication, génération payante, rotation de secret ou fermeture de service/terminal pendant ce jalon local.

## Intégration et préservation

Les SHAs T04 `8e62dde`, T05 `47e49ee`, T02 `312522a`, T06 `460acd3`, T03 `0e38a92` et QA T08 `5b37499` ont été résolus en SHAs complets, comparés à leur base commune puis appliqués par chemins contrôlés. Aucun merge aveugle. `deliveries.json` conserve les SHAs et empreintes des patches ; `delivery-content-review.json` compare les 187 entrées livrées, sans fichier manquant.

- T04 : diagnostics expurgés et contrôle des contrats ; adaptation Suno finale par T01 après vérification du fournisseur.
- T05 : séparation explicite des environnements Shotstack et corrections d'erreurs sûres, conservées à l'identique.
- T02 : protection des comptes sociaux et tests de limites, adaptés au nouveau contrat OAuth sans retirer les assertions de sécurité.
- T03/T06 : reprise musicale, audit de publication/consentements et preuves reçues ; aucun nouvel appel fournisseur dupliqué.
- T08 : contre-tests rouges historiques conservés comme preuves de base. Les six contre-tests fournisseurs du résultat corrigé passent ; Z01–Z04 sont corrigés par un propriétaire OAuth unique.
- Fichiers communs : union des guards de branches Vercel, composition de la liste CI, conservation des BATON/plans propriétaires. Les variantes documentaires non fusionnables sont archivées ici. T07 `4993feb` est un commit documentaire, non ancêtre de la base : son handoff est déjà identique dans la base ; BATON/plan exacts sont archivés sous `4993feb-*`, sans réappliquer le code UI déjà intégré.

Les cinq commits protégés `35c137f`, `a322e53`, `e1bdd1b`, `05d164d`, `7088a0a` sont tous ancêtres de la base. Aucun reset, stash, clean, fermeture de terminal ou modification de WIP tiers. Les 359 fichiers WIP de cinq worktrees ont une sauvegarde privée mode 0700/0600 et des empreintes originales/archives identiques (`wip-backup-verification.json`). Aucun fichier d'environnement n'a été copié. Les worktrees T02–T08 sont propres à leurs SHAs de livraison (`owner-snapshot.json`).

## Contrats corrigés

**SunoAPI (tiers distinct de Suno)** : `SUNO_API_BASE_URL` explicite prioritaire sur `SUNO_BASE_URL`, hôte authentifié `api.sunoapi.org` uniquement, aucun transfert automatique de clé vers l'hôte d'exemple documentaire. Contrat V6 `POST /api/v1/generate`, puis lecture `GET /api/v1/generate/record-info?taskId=…`. Validation des entrées, bornes JSON, tâches concordantes et URL audio HTTPS ; délais bornés et erreurs expurgées. Un POST unique, aucune reprise générative implicite ; la barrière persistante du pipeline est conservée. Le callback ne stocke rien et n'autorise aucune transition métier. [Contrat de génération](https://docs.sunoapi.org/suno-api/generate-music), [suivi](https://docs.sunoapi.org/suno-api/get-music-generation-details).

**OAuth Zernio** : `GET /connect/{platform}`, `profileId`, `redirect_url`, `scopes=posting`, lecture `authUrl`, `x` → `twitter`. Mapping serveur explicite `ZERNIO_PROFILE_BINDINGS`, sans sélection du premier profil ; state aléatoire à usage unique, TTL 600 s, lié au navigateur, à l'utilisateur, au profil et à la session Supabase vérifiée. Callback hébergé relu côté Zernio, correspondance exacte du compte/profil/plateforme avant enregistrement. Aucun token fournisseur enregistré par ce nouveau flux ; renouvellement confié à Zernio. Suppression des échanges/refresh fictifs. Voir `oauth-handoff.md`. Les cinq anciens connecteurs non qualifiés sont désactivés ; neuf plateformes documentées restent disponibles. [Contrat connect](https://docs.zernio.com/connect/get-connect-url), [profils multi-tenant](https://docs.zernio.com/multi-tenant).

## Preuves gratuites sur le résultat intégré

Les commandes tournent avec une liste blanche de variables synthétiques et le garde réseau `qa/t08/offline.cjs`. Les bases PostgreSQL sont locales et jetables. Les sorties exactes sont dans `gates/` et les reçus JSON de ce dossier ; les nombres ne s'additionnent pas lorsque les suites se recouvrent.

| Commande | Résultat |
| --- | --- |
| `node scripts/run-ci.mjs contracts` | 537 PASS, 0 FAIL, 7 SKIP ; 544 tests. Schedule/composition/publication PASS. |
| `PATH="$PWD/test-results/media-bin:$PATH" node scripts/run-ci.mjs media` | moteur local PASS ; 31 tests FFmpeg/média PASS. |
| `python3 qa/final-integration-20261013/free-gates.py postgres-pipeline` | 12 PASS, concurrence réelle PostgreSQL 18 loopback. |
| `python3 qa/final-integration-20261013/free-gates.py postgres-rls` | 254 assertions PASS, cluster privé temporaire. |
| `python3 qa/final-integration-20261013/free-gates.py postgres-migration` | 13 contrôles PASS : migration v10 et permissions/quotas/rejeu locaux. |
| `python3 qa/final-integration-20261013/free-gates.py deploy-unit` | 17 PASS, tests unitaires locaux sauvegarde/rollback, aucune opération distante. |
| `node scripts/run-ci.mjs quality` | TypeScript, lint (0 erreur, 111 avertissements existants), build PASS. |
| `node qa/t08/run.mjs redteam` | 14 PASS, isolation réseau et charge locale. |
| `node scripts/run-ci.mjs browser` | 210 PASS, cinq largeurs 320/375/768/1280/1440, 164 analyses axe sans violation, aucune erreur navigateur. |
| `node qa/t08/run.mjs browser-redteam` | PASS : 210 contrôles communs + 7 scénarios adversariaux ; 165 analyses axe sans violation, 0 erreur navigateur. |
| `node scripts/run-ci.mjs legacy` | 1 022 PASS, 25 SKIP, 0 FAIL. |
| `node qa/final-integration-20261013/social-ui-check.mjs` | 28 contrôles PASS sur serveur fixture déjà lancé ; aucun clic de connexion. Captures 375/1280 affichées et examinées après fin des animations. |
| `actionlint .github/workflows/web-ci.yml` ; `shellcheck tooling/git-askpass.sh` | PASS. |
| `npm audit --omit=dev --audit-level=high --ignore-scripts --json` | seuil CI PASS : 0 haute/critique ; 5 modérées, 2 faibles préexistantes dans OpenTimestamps. |

Le minuscule delta UI postérieur à la première gate qualité a sa vérification TypeScript complète et lint ciblé PASS, puis les builds navigateur complets PASS. Le script de recette UI ajouté a son lint ciblé PASS. Aucun changement de dépendance ni installation. Le FFmpeg Homebrew local ne fournit pas drawtext/subtitles : l'échec initial est conservé, la gate finale utilise le binaire compatible déjà installé dans le worktree T05 média. Les erreurs initiales de fixture Suno et de locale PostgreSQL ont été corrigées ; les logs initiaux sont conservés et ne sont pas qualifiés PASS.

## Fournisseurs et provenance

Source unique des valeurs : `~/.env.purama.master`, mode 0600, comparaison opaque uniquement. Valeurs non affichées, non journalisées, non copiées dans `.env.local`, non modifiées. Les preuves HTTP fraîches livrées par T01/T04 sont réutilisées, pas rejouées. `qa/provider-final-audit-20261013/normalized-live-audit.json` est la preuve normalisée ; `live-audit.json` initial souffrait d'un parsing incomplet et n'est pas une preuve valide. Six variables ont un suffixe newline littéral dans le maître ; la normalisation diagnostique en mémoire retrouve les valeurs applicatives Mac/OVH. Les origines applicatives prioritaires restent préservées.

| Fournisseur | Verdict réel et limite |
| --- | --- |
| RunPod | BLOQUÉ : GET liste endpoints et santé endpoint renvoient 401 `INVALID_API_KEY` sur Mac et OVH après normalisation. Formats plausibles ; permissions endpoint inconnues tant que l'authentification échoue. Aucune génération. |
| Shotstack | BLOQUÉ : les deux clés testées sur stage et v1 renvoient 403 aux GET templates, Mac et OVH. Pas de challenge Cloudflare ; pas expliqué par une simple permutation clé/URL. Révocation/désactivation de clé ou restriction de compte non départageables sans le propriétaire du compte. Aucun rendu. |
| SunoAPI tiers | Authentification gratuite VALIDÉE (GET crédit HTTP 200, code 200, solde positif sans journaliser le montant). Adaptateur intégré et contrat local TESTÉ. `SUNO_API_BASE_URL` existe dans le maître mais manque dans les environnements applicatifs contrôlés ; ancienne `SUNO_BASE_URL` incompatible, refus fermé. Génération réelle NON TESTÉE et activation distante non effectuée. |
| Zernio | API lecture VALIDÉE (HTTP 200, un profil, zéro compte connecté). OAuth corrigé et TESTÉ localement ; attribution autorisée utilisateur→profil et consentements réels restent requis. Ni token social réel ni publication testés. |

Les variables réellement utilisées par cette intégration : `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, `SHOTSTACK_API_KEY`, `SHOTSTACK_PRODUCTION_KEY`, `SHOTSTACK_ENV`, `SUNO_API_KEY`, `SUNO_API_BASE_URL`, `SUNO_BASE_URL`, `ZERNIO_API_KEY`, `ZERNIO_BASE_URL`, `ZERNIO_PROFILE_BINDINGS`, origines applicatives et configuration Supabase existantes. Leur présence/provenance individuelle est enregistrée sans valeur dans `variable-provenance.json` et les preuves propriétaires ; ce paragraphe ne prétend pas qu'elles sont toutes présentes. Les tests intégrés n'en utilisent aucune réelle. La connexion SSH maître T01 a été refusée ; la preuve OVH repose explicitement sur le contrôle T04 via l'accès déjà configuré, pas sur une nouvelle qualification SSH T01.

## Limites et actions restantes

1. **RunPod** : vérifier une clé active dans le bon compte et ses droits sur l'endpoint, puis mettre la valeur correcte dans la source sécurisée. [Gestion officielle des clés](https://console.runpod.io/user/credentials), [droits](https://docs.runpod.io/get-started/credentials).
2. **Shotstack** : vérifier les clés actives correspondant à stage et production ; si elles sont actives et restent refusées, faire lever la restriction de compte par Shotstack. [Clés](https://app.shotstack.io/keys), [guide officiel](https://shotstack.io/docs/guide/getting-started/request-api-keys/).
3. **Zernio** : attribuer explicitement le bon profil au bon utilisateur/organisation dans `ZERNIO_PROFILE_BINDINGS` (absent du maître), puis l'utilisateur accorde lui-même les consentements des réseaux souhaités et choisit ses destinations. [Profils](https://docs.zernio.com/multi-tenant), [connexion](https://docs.zernio.com/guides/connecting-accounts). Aucun besoin démontré de créer des applications OAuth natives supplémentaires.

Le déploiement/configuration distante Suno et la recette OAuth réelle attendent une reprise autorisant ces mutations. Les contrats de publication TikTok (consentements par contenu) et Pinterest (tableau explicite), les cinq connecteurs désactivés, la génération payante, la révocation distante et la santé des tokens réels restent NON TESTÉS / non qualifiés pour activation ; voir le rapport T06. La correction Z01–Z04 ne certifie pas ces capacités. Les 7 SKIP contrats et les SKIP legacy ne sont pas des PASS.

GitNexus : impacts exécutés avant édition ; `generateMusic` CRITICAL (5 appelants directs/6 flows) et poll CRITICAL signalés, UI LOW. Certains symboles/routes sans arête restent UNKNOWN. L'index présente une couverture tronquée (365 flows, 952 entrées omises) : revue de références et contrats directs en complément, aucune certification exhaustive du graphe. `detect_changes` exécuté avant commit : 103 symboles, 22 flows, risque CRITICAL. Les 22 flows et chemins ont été revus ; les fonctions de publication signalées par décalage de lignes sont inchangées. Aucun changement de migration, dépendance, déploiement ou autre application. Reçu structuré et revue conservés.

Clôture : `terminal-closure.json` vérifie à nouveau les SHAs/handoffs et worktrees T02–T08 propres ; FERMABLE. T01 est fermable après le commit contenant cette livraison et ses preuves. Les 359 fichiers WIP sont à nouveau identiques aux archives privées. Aucun terminal/service existant fermé.

Contrôle secrets final : zéro correspondance opaque du maître dans les 262 fichiers staged ; Gitleaks brut signale 15 faux positifs qualifiés (12 SHA-256 vérifiés contre T05 et 3 fixtures hors réseau), zéro secret réel. Aucune exclusion générale ajoutée. `POLICY_OK` final. Diff sans erreur hors cinq espaces/ligne vide de logs bruts conservés ; aucune erreur de whitespace dans le code.

## Complément utilisateur 23h55 — étape suivante autorisée

Après commit et vérification du présent manifeste/gates, préparation puis mise en service OVH SUTRA autorisées, avec cible active confirmée, sauvegarde et rollback vérifiés, synchronisation minimale du maître sans écraser les origines/secrets applicatifs prioritaires, puis smokes gratuits. Aucune génération/publication/dépense/rotation. Aucune attribution Zernio devinée ; identité utilisateur à demander uniquement si les sources existantes ne la prouvent pas. Cette autorisation remplace le plafond local précédent ; ce rapport reste la preuve du jalon local, pas une preuve de déploiement.

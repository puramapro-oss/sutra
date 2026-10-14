# SUTRA — intégration Salad désactivée, 14 octobre 2026

INTEGRE / TESTE / DEPLOYE OVH : `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`. CI complète verte, candidat isolé, sauvegarde restaurée et contrôles après déploiement PASS ; reçus ci-final.json et deployment.json. Le GPU reste désactivé, aucune dépense, génération, publication ou rotation. Aucun calcul IA sur Mac.

## Résultat livré

Sept lots vérifiés et conservés : T02 b7b60be, T03 1b45f71, T04 fd28318, T05 cca76a2, T06 48c3191, T07 ace3e0d, T08 8926699. Import par chemins après revue ; leurs états historiques rouges restent inchangés. Les modifications T01 ci-dessous les réconcilient.

- Host Salad exécutable avec auth serveur, Gateway limité, comptes client exclus, health/capabilities, inspection Linux/amd64/CUDA/poids/VRAM, bridge canonique privé. Aucun conteneur GPU qualifié/provisionné.
- Intention et checkpoints avant soumission ; une seule soumission, reprise GET, UNKNOWN conservé après interruption. Port PostgreSQL externe réel : CAS, slot global permanent, artefacts immuables SHA256. Migration locale dédiée jamais appliquée en production ; aucun besoin pour Salad désactivé.
- MODE-03 et MODE-05 : preflight propriétaire avant quota/soumission payante, messages sûrs. API client préservée. Namespace durable du pipeline production lié à sa requestKey, absent auparavant.
- T05-MEDIA-01 corrigé : mêmes octets source sous URL alias refusés comme export transformé. Reconnexion sociale corrigée : revoked/expired/error jamais affichés connectés.
- UI : GPU distant open source, ni Mac ni gratuit ; script/voix/musique/assemblage peuvent encore utiliser des API. Estimation de calcul uniquement, pas plafond garanti de facture. Budget, quote et qualification nécessaires, aucun prix inventé.
- Promotion OVH exacte avec CI/manifeste/candidat isolé/restauration exigés. Rollback automatique aussi sur interruption ; smoke authentifié refuse un code Node/SSH non nul même avec JSON positif. Tests hors réseau sur scripts réels.

## Preuves gratuites exactes

Voir `local-gates.json`, `gates/`, `postgres-result.json`, `terminal-final.json`, `wip-preservation-final.json` et `tested-source-manifest.json`.

- `node scripts/run-ci.mjs contracts` : 666 PASS, 0 FAIL, 7 SKIP (4 INSEE live, 2 DB métier live, 1 OpenTimestamps réseau volontairement exclus) ; schedule/composition/publication PASS.
- `node scripts/run-ci.mjs media` : 25 Salad média + 3 legacy CPU/routage + 31 FFmpeg = 59 PASS. macOS utilise `/opt/homebrew/opt/ffmpeg-full/bin` (subtitles/drawtext disponibles).
- `node scripts/run-ci.mjs quality` : TypeScript/lint/build PASS ; 111 avertissements hérités, zéro erreur.
- `node qa/salad-integration-20261014/run-postgres.mjs` : 7 PASS, vrai PostgreSQL18 isolé ; concurrence24, CAS12, permissions, artefact et redémarrage UNKNOWN du vrai worker. Cluster arrêté et conservé.
- `python3 -B -m unittest discover -s deploy -p 'test_*.py'` : 24 PASS (dont 7 nouveaux contrôles promotion/rollback).
- `node qa/t07-modes-20261014/browser.mjs --capabilities-only --visual-only` : 4 PASS, 3 axe sans violation, captures affichées ; 0 génération. Régression du texte T01, preuves T07 52 checks/51 axe sur cinq largeurs conservées.
- Tests ciblés après corrections fixtures/production : 56 PASS, 0 FAIL/skip. Leur couverture est ensuite reprise par contrats/médias.

Les gates n'ont aucun credential fournisseur : configuration locale déplacée temporairement vers sauvegarde0600 puis restaurée avec empreinte identique ; environnement fixtures et pare-feu réseau Node. Les échecs initiaux restent consignés, aucun test requis rouge accepté.

## Limites et actions utilisateur

- BLOQUE : activation Salad — absence vérifiée dans le maître de SALAD_API_KEY, SALAD_GATEWAY_URL, SALAD_WORKER_TOKEN, SALAD_WORKER_DATABASE_URL, SALAD_QUALIFICATION_JSON, SALAD_QUOTE_JSON, SALAD_MAX_ESTIMATED_COMPUTE_USD. Ce ne sont pas tous des secrets : endpoint, manifeste, devis et budget devront provenir de la ressource réellement qualifiée. Autorisation ressource/budget indispensable avant création. Ne pas inventer de SHA modèle ou de compatibilité24Go.
- NON TESTE : GPU réel, génération RunPod/Salad/Suno/Shotstack, pipeline complet réel, export généré réel, publication/consentement social réel. Aucun HTTP200 d'authentification ne couvre ces fonctions.
- RunPod endpoint health200 et Shotstack stage/v1 templates200 + structure validée depuis le runtime, preuves `../provider-activation-20261014`. Ancien REST global401 RunPod non probant avec la clé limitée ; aucun élargissement de droits.
- Zernio : identité serveur vérifiée et organisation PURAMA autorisée, profil existant possédé réutilisé (nom existant Default), aucune création/association ambiguë. Zéro compte connecté : utilisateur doit consentir depuis `/settings/social`. Ne pas connecter ni publier automatiquement.
- Mode personnel propriétaire utilise uniquement la vidéo Salad ; API client réservée aux sessions clientes selon le contrat existant, pas de fallback payant pour le propriétaire. `/create` et `/production` affichent l'indisponibilité tant que Salad n'est pas activé/qualifié ; `/library` et `/settings/social` restent accessibles après connexion.

[Prix Salad](https://salad.com/pricing/) : RTX3090 Lowest affiché0,090USD/h, soit64,80USD pour720h arithmétiques, sans forfait/abonnement garanti. Facturation du temps actif y compris attente ; stockage/réseau/autres API exclus. Aucun coût minimal réel de vidéo démontré. [Documentation Gateway](https://docs.salad.com/container-engine/how-to-guides/gateway/sending-requests), [connexion sociale Zernio](https://docs.zernio.com/guides/connecting-accounts).

## Préservation

Sept worktrees propres, SHA/handoffs vérifiés ; FERMABLE signifie préservé, aucun terminal fermé. 359 fichiers WIP de cinq worktrees identiques aux sauvegardes privées. Commits main/PR1/PR2/correctif/PR3 conservés. Le bloc AGENTS et les skills générés par l'index GitNexus restent WIP local hors livraison produit ; graphe d'impact utilisé avec limites de couverture explicites.

## GitNexus avant commit

`detect_changes(scope=staged)` complet : 203 fichiers, 702 symboles, 359 flux, CRITICAL. Tous les chemins modifiés correspondent à la livraison. Le graphe partagé associe aussi des flux étrangers via des propriétés génériques (`getAll`) : aucune certification exhaustive du graphe SUTRA revendiquée. Revue directe et gates ciblées complètes ci-dessus ; détail dans `detect-changes-review.json`.

## Correction après CI Linux111c134

CI initiale38492833709 : PostgreSQL PASS ; deux gates rouges conservées dans `ci-111c134-failed.json`, jamais promues. Validation vidéo corrigée : les diagnostics FFmpeg/ffprobe de niveau erreur invalident désormais le média même lorsque le binaire retourne zéro. Le contre-test T05 garde son vrai MP4 avec dernier paquet corrompu. L'assertion navigateur historique a été alignée sur le message sûr de résultat incertain, avec vérification d'une seule soumission et lien bibliothèque ; aucun assouplissement produit.

`media-fix-local-gates.json` : contrats,59médias,TypeScript/lint/build tous PASS après correction ; secret local restauré à l'identique. Le résultat navigateur ciblé et la nouvelle CI sont consignés séparément avant promotion. Analyse d'impact HIGH exécutée avant les deux éditions ; graphe partagé non exhaustif.

Navigateur complet corrigé : 210 contrôles, 165 audits accessibilité et 7 contrôles supplémentaires PASS ; aucune exception navigateur. Voir `browser-fix-local.json`, `browser-fix-results.json`, `browser-fix-extra.json`.

## Mise en service vérifiée — 14 octobre 2026, 01:47 UTC

Code déployé et poussé : `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`, branche `codex/sutra-final-providers-20261013`. URL : https://sutra.purama.dev. Le commit documentaire ultérieur ne change aucun des 873 fichiers du manifeste testé. [CI38494320084](https://github.com/puramapro-oss/sutra/actions/runs/38494320084) : trois jobs PASS. Premier essai quality interrompu par un timeout navigateur `networkidle` à15s ; un seul rejeu du job échoué, même SHA, PASS. Échec conservé dans ci-d8691d8-attempt1.json et ci-d8691d8-browser-timeout.json ; aucun test supprimé.

- Contrats :666 PASS /7 SKIP ; médias59 PASS ; redteam14 PASS.
- `node qa/t08/run.mjs browser-redteam` :210 contrôles,165 audits axe,7 contrôles supplémentaires PASS,0 exception navigateur.
- `node scripts/run-ci.mjs legacy` :1022 PASS /25 SKIP /0 échec /0 flaky. Suites ignorées documentées dans ci-legacy-skips.json ; aucune assimilée à un PASS.
- TypeScript, lint, build PASS. `python3 -m unittest discover -s deploy -p 'test_*.py'` :24 PASS. CI PostgreSQL jetable : migrations/permissions,12 tests concurrence pipeline et7 journal Salad PASS. Tests PostgreSQL18 locaux déjà verts réutilisés.
- `npm audit --omit=dev --audit-level=high` : gate PASS,0 high/critical ;7 vulnérabilités restantes (2 low,5 moderate). Lint :111 avertissements hérités. Ces avertissements ne sont pas déclarés corrigés.
- Promotion exacte : `python3 qa/salad-integration-20261014/promote.py --source-ref d8691d8ac6cf885f8e5522f361f45ebe229ec20d --ci-run 38494320084`. Candidat sans réseau, image précédente testée sans réseau, sauvegarde SUTRA141 tables restaurée avec comptes identiques. Sauvegarde applicative des blobs et trois tables sociales publiques ; auth de restauration limitée aux identités fixtures, pas sauvegarde intégrale de toute la plateforme. Répertoire privé et fichiers0600. Aucune migration distante.
- Après promotion :8 GET internes/publics,7 GET authentifiés,58 refus cron/OAuth,30 contrôles médias négatifs PASS ;3 contrôles authentifiés bibliothèque/sous-titres CPU/export SRT PASS. Sessions de recette révoquées sans toucher la session utilisateur. Voir commandes exactes ci-dessous et reçus homonymes.
- Navigateur public1440×1000 et375×812 : login/redirection/callback invalide, pas de débordement ni exception ; captures affichées et inspectées. Preuve publique uniquement, pas de preuve de consentement Google ou social réel.
- Runtime : image exacte saine,0 redémarrage,0 ligne erreur/fatal/panic ; schéma/jobs présents,0 index SUTRA invalide,0 transaction longue, base hors récupération.71 autres conteneurs inchangés. Variables runtime identiques au snapshot protégé ; origine SUTRA préservée.
- Depuis cette image : RunPod health endpoint200 + compteurs conformes (0 worker prêt au moment du contrôle), Shotstack stage/v1 templates200 + contrats conformes, Zernio profil unique possédé et binding vérifiés,0 compte connecté. Aucun appel de génération. Ne pas confondre accès authentifié et capacité à produire une vidéo.
- DNS : A vers OVH, serveurs autoritaires Cloudflare ; proxy DNS-only déduit de la résolution directe, paramétrage du compte non certifié par API. TLS1.3 valide pour le domaine, certificat expirant le10 janvier2027. Preuve dns-tls.json, aucune modification DNS.

Commandes gratuites après déploiement :

```sh
python3 qa/salad-integration-20261014/run-authenticated.py
node qa/salad-integration-20261014/public-browser.executed.cjs.txt
python3 qa/salad-integration-20261014/security-probe.executed.py.txt
node --input-type=module < qa/salad-integration-20261014/media-smoke.executed.mjs.txt
```

`authenticated-free-media.executed.mjs.txt` a été bundlé avec esbuild puis envoyé par stdin à Node dans le seul conteneur SUTRA ; aucun secret/cookie/lien affiché. `qa/provider-activation-20261014/runtime-probe.mjs` a été exécuté de même dans le runtime, GET seulement ; wrapper exige code0 et `pass:true`. Reçus authenticated-free-media.json et provider-runtime.json. Export SRT réel testé ; rendu vidéo, création de projet avec génération, pipeline fournisseur et publication réels NON TESTES.

Rollback disponible, non déclenché (contrôles verts) :

```sh
python3 deploy/ovh.py rollback --source-ref d8691d8ac6cf885f8e5522f361f45ebe229ec20d
```

## Parcours réellement disponibles et suites indispensables

1. Se connecter sur https://sutra.purama.dev/login avec l'identité de recette confirmée ; consulter `/dashboard`, `/library`, `/create`, `/production`. Les pages protégées répondent avec la session vérifiée. Les tests pipeline sont simulés ; ne pas lancer de génération API sans devis/accord de dépense.
2. Social : https://sutra.purama.dev/settings/social → choisir un réseau disponible → Se connecter → consentement externe → retour dans la même session sous10min. PURAMA réutilise le profil existant possédé, aucun doublon. Neuf connecteurs proposés : TikTok,YouTube,Instagram,Facebook,X,LinkedIn,Pinterest,Reddit,Threads ; Snapchat,Tumblr,Mastodon,Bluesky,Vimeo restent désactivés. [Guide officiel](https://docs.zernio.com/guides/connecting-accounts). Aucun compte connecté ni publication automatique.
3. Personnel : GPU distant open source, uniquement propriétaire. Il est actuellement désactivé ; aucune génération locale Mac disponible/prouvée. Pour activer Salad, autoriser explicitement une ressource et un budget, puis renseigner la clé compte dans le maître sécurisé. Endpoint, token worker dédié, rôle DB limité, qualification réelle et devis/budget sont ensuite à établir sans deviner modèle/VRAM. [Développeurs Salad](https://salad.com/developers/), [prix officiels](https://salad.com/pricing/). Le temps GPU actif est payant, même en attente ;0,090USD/h est le tarif Lowest RTX3090 observé, pas un forfait garanti, ni un coût vidéo garanti. Script/voix/musique/assemblage API éventuels restent payants.
4. Client : routage API conservé et testé en simulation. Utiliser une identité cliente autorisée pour ce parcours ; l'identité propriétaire personnelle ne bascule pas silencieusement vers l'API payante. Avant un test réel, chiffrer la requête exacte et obtenir l'accord de dépense. RunPod health ne valide ni modèle/WAN ni disponibilité GPU réelle ; Shotstack reste sélectionné stage.

Aucun blocage de code reproductible restant dans les gates requises. Blocages d'activation externes : ressource/budget/qualification Salad, consentements sociaux et autorisation de test fournisseur payant. Les fonctions GPU et la chaîne vidéo complète ne sont pas déclarées prêtes.

## Clôture documentaire

Les873 fichiers du manifeste testé sont inchangés. `detect_changes --scope staged` a analysé41 fichiers de preuves/docs, aucun symbole indexé recouvrant les hunks ; ce résultat ne certifie pas un graphe exhaustif. Le contrôle de secrets a initialement signalé trois empreintes SHA256 publiques associées aux noms de fichiers auth. Chaque empreinte a été vérifiée contre le fichier source puis le reçu représenté en lignes path/sha256 ; aucune exclusion du scanner ni secret ajouté. Les gates produit ne sont pas rejouées pour ces seules preuves.

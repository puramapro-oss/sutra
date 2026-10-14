# SUTRA — intégration Salad désactivée, 14 octobre 2026

INTEGRE / TESTE LOCAL. Ce commit est le candidat ; le déploiement ne sera attesté que par les reçus CI/candidate/backup/deployment ultérieurs. Le GPU reste désactivé, aucune dépense, génération, publication ou rotation. Aucun calcul IA sur Mac.

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

# Réconciliation T01 — 15 octobre 2026

La matrice T08 du 15 octobre remplace le compte historique «4 FAIL /3 BLOQUÉS /9 NON TESTÉS». Elle décrit72 exigences sur3855665 :45PASS,12FAIL,2BLOQUÉS,13NONTESTÉS. Son contenu et ses rouges sont conservés. Ce document relie les preuves aux corrections ; il ne constitue pas un ACK T08 du nouveau candidat.

## Douze défauts ouverts dans la référence T08

| Exigence | Propriétaire et livraison | Correction et preuve | État intégré |
|---|---|---|---|
| R54 / T08-CANCEL-01 | T03 ee3f701 ; test indépendant T08 3e49d03 | Diagnostic RPC expurgé, annulation/ACK bornés. Test indépendant conservé dans la CI. | Code reçu ; recette exacte attendue |
| R55 / T02-CAP-01 | T02 5822770 | Autorité de profil, révocation et provenance vérifiées avant signature privée.19nouveaux tests/22régressions auteur. | Code reçu ; recette exacte attendue |
| R56 | T06 10693a2 | Revalidation après attente fournisseur et avant DELETE/CAS. | Code reçu ; recette exacte attendue |
| R64 | T06 10693a2 | Révocation confirmée idempotente, aucun second DELETE. | Code reçu ; recette exacte attendue |
| R65 | T06 10693a2 | Anciens champs tokens purgés dans les deux issues de révocation. | Code reçu ; recette exacte attendue |
| R66 / T01-SQL-01 | T01, client_write_permissions | Révocation DML client/colonnes sensibles, politique insert concours bornée.30tests PostgreSQL ; copie OVH rejouable/rollback exact/données inchangées. | Migration préparée, production NON MODIFIÉE |
| R67 / T06-HISTORY-01 | T01 SQL, contrat T06 | Journal atomique append-only des changements SUTRA, RLS et révocation/reconnexion.23tests PostgreSQL,12simulations transition ; copie OVH/rollback conservant le journal. | Migration préparée, production NON MODIFIÉE |
| R68 | T05 44cbbab | Slots réservés synchroniquement, minimum1, attente/transport/encodeur bornés par le délai total.34tests auteur dont17exports CPU encodés. | Code reçu ; recette exacte attendue |
| R69 | T07 c72188a | Panne/timeout chargement social distincts de0compte, reprise explicite. | Code reçu ; Chromium ciblé PASS, erreurs de banc WebKit à qualifier dans campagne exacte |
| R70 | T07 c72188a | Nom accessible, focus initial et piège clavier du dialogue. | Code reçu ; Chromium ciblé PASS, erreurs de banc WebKit à qualifier dans campagne exacte |
| R71 | T07 c72188a | Garde synchrone double soumission login/signup, clavier mot de passe. | Code reçu ; Chromium ciblé PASS, erreurs de banc WebKit à qualifier dans campagne exacte |
| R72 | T03 ee3f701 + T01 SQL | Validation terminale stricte, promotion pending, checkpoints immuables et voix intègre, ACK avant mémoire. Migration cumulative6fonctions. | Code reçu ; PostgreSQL intégré PASS borné |

Preuve PostgreSQL intégrée : premier passage46tests44PASS2FAIL0SKIP. Deux assertions historiques devenues incompatibles avec le contrat renforcé : erreur RPC avant CHECK SQL, dix étapes avec storyboard au lieu de neuf. Rouge conservé dans integrated-postgres-before-fixture-correction.*. Correction des seules fixtures : erreur RPC vérifiée ET CHECK SQL exercé directement ; liste exacte des dix étapes et storyboard skipped vide. Rejeu du seul fichier affecté :13PASS0FAIL0SKIP, durable-regression-after.*. Ne pas additionner ce rejeu aux46tests.

Parcours intégré simulé :13PASS0FAIL0SKIP avec environnement canonique de scripts/run-ci.mjs. Le premier lancement avait un override HTTP NEXT_PUBLIC_APP_URL invalide ;6FAIL de banc conservés dans integrated-journey.*, puis corrigé dans la seule invocation (integrated-journey-canonical-env.*), sans modification produit.

## Bases, conflits et WIP

Les reçus integration-t02/t03/t04/t05/t06/t07/t08.json donnent chaque SHA complet, parent, fichiers intégrés et vérifications des preuves. Les lots produit partent de49c166d, équivalent produit3855665 ; T08 part directement de3855665. Application de deltas et comparaison des blobs, sans fusion aveugle. BATON/task_plan/ERRORS des auteurs exclus pour éviter les doublons. T01 est propriétaire unique du SQL canonique ; la proposition T03 reste QA et est portée dans une migration cumulative car la production86d04c8 ne possède pas le correctif SQL14oct.

AGENTS.md et six skills locaux préexistants préservés par empreintes. Les anciens artefacts non suivis restent à leur place. Aucun terminal fermé et aucun processus tiers arrêté. FIN_ECRITURE des auteurs ne vaut ni certification intégrée ni autorisation de supprimer un worktree.

## Infrastructure et limites réelles

- OVH : sutra.purama.dev, conteneur purama-sutra, source86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164. Précontrôle15oct01:44UTC healthy/0restart ; environnement0600/origine SUTRA conservés. Aucune promotion de cette livraison à ce stade.
- Backup15oct01:10UTC : six artefacts protégés,141tables restaurées et comptages égaux, quatre contrats de schéma. Trois migrations testées/rejouées/annulées sur copie privée seulement. Identités auth complètes et gel atomique des blobs ne sont pas prouvés ; aucune promesse de restauration globale Supabase. La fraîcheur est recontrôlée avant mutation.
- Cron exécutant : infrastructure SUTRA absente et désactivation volontaire des tâches susceptibles de générer/publier. Zéro tâche en attente/traitement/incertaine, zéro configuration auto active au contrôle01:05UTC. L'observateur existant est strictement en lecture seule, testé localement ; il ne transforme pas le produit en ordonnanceur autonome. Aucun exécuteur activé.
- RunPod : seul GET endpoint health est pertinent pour la clé restreinte ; ne pas élargir les droits sur la base du401 de listing REST. Shotstack : environnements stage etv1 distincts. Suno : contrat tiers sunoapi.org, pas API officielle Suno. Les anciens200 non génératifs ne prouvent ni crédits ni rendu.
- Salad : conteneur amd64/CUDA et adaptateur livrés par T04,30tests gratuits auteur. Image GPU non construite, modèle/VRAM/génération non testés. La variable SALAD_API_KEY du master était malformée au contrôle ; elle n'a pas été envoyée ni synchronisée. Organisation/projet/gateway/worker token non prouvés, mode désactivé. Ne jamais deviner leurs valeurs ni démarrer une ressource.
- Le mode propriétaire désigne un GPU distant open source ; il n'est ni local Mac ni gratuit. Le pipeline complet n'est pas démontré entièrement open source : les autres étapes peuvent utiliser des API. Aucun repli payant implicite admis.
- Annulation création : aucune commande UI serveur raccordée sur /create ; resetGeneration interrompt uniquement le fetch local. Ne pas présenter cela comme arrêt GPU/fournisseur. Le contrat production step=cancel existe et est testé séparément.
- OAuth : liaison serveur Matiss/PURAMA existante conservée ; aucun compte social personnel connecté ou publié. Les tests de consentement utilisent une identité synthétique, sans accepter au nom de Matiss.

## Conditions de promotion

SHA intégré immuable, manifeste de sources exact, campagne CI complète sans échec requis, revue indépendante T08 sur ce SHA, candidat OVH construit/testé sans réseau, sauvegarde fraîche vérifiée, migrations compatibles et reçus d'application exacts. Puis snapshot de l'image et du runtime, promotion SUTRA seule, contrôles public/interne/authentifiés et absence de redémarrage des autres conteneurs. Échec confirmé : rollback CAS ; résultat SSH incertain : réconciliation avant toute répétition.

Les NON TESTÉS R02/R07/R32/R34/R36/R38/R41/R43/R44/R45/R62/R63 et la qualification réelle IA restent distincts des simulations. Aucun total de suites recouvrantes n'est additionné. Les SKIP historiques externes restent affichés, jamais transformés en PASS.

## Actions personnelles, seulement si ces fonctions sont voulues

1. Renseigner une clé Salad valide dans le master sécurisé depuis https://portal.salad.com ; sélectionner une organisation/projet réellement détenus. Aucun montant ni abonnement présumé.
2. Se connecter à SUTRA et accomplir les consentements légaux/OAuth des réseaux souhaités : https://sutra.purama.dev/settings/social ; documentation https://docs.zernio.com/guides/connecting-accounts.
3. Autoriser explicitement un budget chiffré avant tout essai GPU/génération facturé. Aucune génération ou publication réelle n'a été effectuée ici.

## Verification runtime gratuite15oct01:58UTC

provider-runtime.json : RunPod health200/contrat valide/0worker; Shotstack stage etv1 templates200/contrats valides; Suno tiers sunoapi.org credit200/credit disponible sans montant expose; Zernio profil unique/ownership200/0compte connecte. Conteneur86d04c8 inchange avant/apres;0requete de generation. Ces preuves ne valident aucun rendu.

Harnais navigateur final libere :20scenarios Chromium/WebKit, une build, sorties neuves;13tests du classificateur/controles HTML natifs PASS. La campagne applicative reste a executer sur le commit exact.

## CI48eb91a : deux incompatibilités de tests corrigées

Contrats :961 tests,952PASS/2FAIL/7SKIP avant correction (rouge conservé ci-contract-red.txt et artefact GitHub38669067659). Les7SKIP préexistants concernent quatre tests INSEE live, deux écritures DB live de modules historiques et OpenTimestamps réseau ; aucun skip ajouté, aucune validation live revendiquée.

- Voix : la validation T03 détecte le checkpoint incomplet avant l’ancien diagnostic de morceau manquant. Assertion remplacée par le code exact SUTRA_RECONCILIATION_REQUIRED:SUTRA_VOICE_CHECKPOINT_CORRUPT ; une seule synthèse et zéro upload toujours exigés.
- Suno : le réveil du timer10ms peut permettre un deuxième GET du même job. La fixture réutilisait un corps Response déjà consommé et imposait un unique GET sans contrat fournisseur correspondant. Cas PENDING isolé avec une réponse fraîche par GET, même taskId, GET seulement, aucun onSubmitted, erreur de délai exacte, retrySubmission/fallbackAllowed false et terminaison avant l’intervalle normal3s (borne test1s). Les quatre réponses malformées/refus/flux bloqué restent à un seul GET ; checkpoint invalide et signal annulé restent à zéro I/O. Aucun code fournisseur modifié.

Vérification ciblée : `node --import tsx --test --test-concurrency=1 scripts/test-release-regressions.mts scripts/test-t04-provider-fixes.mts` avec environnement fixture canonique et garde réseau offline.cjs :58PASS/0FAIL/0SKIP. ESLint des deux fichiers et diff-check PASS. GitNexus impact fichiers UNKNOWN/index6commits ancien, usage direct runner CI vérifié. Rejeu CI du prochain SHA obligatoire, pas de promotion de48eb91a.

# SUTRA — clôture T01, 14 octobre 2026

Source candidate : `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164`, branche `codex/sutra-final-providers-20261013`. [CI exacte](https://github.com/puramapro-oss/sutra/actions/runs/38508390596). Les preuves historiques ne remplacent pas cette campagne. Le reçu `deployment.json`, lorsqu'il existe, désigne l'image effectivement promue ; le commit documentaire ultérieur ne change pas son code.

## Intégration et corrections

Les sept livraisons et leur base commune `b7cf848d07fca2734db36a2e30d045ca312a3162` sont vérifiées dans [REQUIREMENTS.md](REQUIREMENTS.md), `import-t02.json` à `import-t08.json`. Import par chemins et revue des dépendances, sans WIP étranger. Port Suno T04 et trois consommateurs T03 livrés ensemble. Aucun fichier produit disputé restant.

- T02 : accès stockage lié au propriétaire, diagnostics publics expurgés, transport OpenTimestamps sans redirection et réponse bornée, refus d'une attestation vide.
- T03/T04 : fin de job et accusé perdu réconciliés, checkpoints de résultats/voix/visuels, musique obligatoire, identifiant Suno durable avant polling et reprise GET seule ; drainage Salad et contrats/limites RunPod, ElevenLabs, Suno, Comfy et Pollinations.
- T05 : taille des sous-titres 4K, refus des cues sous une image et des propriétés héritées dans le contrat composition.
- T06 : refus OAuth consommant le state lié à la session, version/CAS du compte contre les courses de révocation, barrière maintenue après issue distante ambiguë, erreurs expurgées et alias X.
- T07 : pagination des favoris/dossiers, maintien des données/requêtes en cours, filtres sans requêtes identiques, remise à zéro après erreur, contraste du consentement.
- T08 : parcours transversaux simulés, concurrence, reprise et absence de soumission répétée.
- T01 : erreurs sociales 409/503 actionnables (reproduction 2 FAIL, puis 4 PASS) ; raccord CI et fixtures des nouveaux contrats ; harnais T07 exécuté contre son bundle de production isolé, avec assertions inchangées.

Les échecs CI initiaux restent conservés : `38505099582` (fixtures et anciens attendus Suno), `38506801929` (T07 redirection login en serveur dev). La cause de cette redirection dev n'est pas prouvée ; augmenter le délai n'a pas suffi. Le harnais production local donne 25 PASS. Aucun correctif applicatif destiné à masquer ces échecs.

## Campagne, promotion et correction SQL

**DÉPLOYÉ : `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164`**, le 14 octobre à 04:13 UTC sur https://sutra.purama.dev. Trois jobs de la CI exacte PASS. [Commandes et résultats CI](FINAL-TESTS.json), [recette après déploiement](POSTDEPLOY-TESTS.json), [matrice actualisée](FINAL-MATRIX.md). Les totaux de lots, CI et régressions se recouvrent et ne sont pas additionnés. Les 7 exclusions contrats restent explicites.

Manifeste de 895 empreintes vérifié ; candidat OVH isolé sans réseau, FFmpeg/ffprobe et routes PASS. Sauvegarde fraîche restaurée : 141 tables, comptes et schéma critique concordants. Limites Auth (IDs référencés seuls) et blobs non gelés transactionnellement : `backup-restore.json`. Ancienne image/configuration sauvegardées, démarrage isolé de rollback PASS. Promotion et smokes PASS ; aucun rollback de production nécessaire.

**SQL appliqué séparément : `6800a8de49080157b487eec1119d2fb49c194afe`**, à 04:31 UTC. Défaut réel : lecture des affirmations 403 malgré RLS/politiques existantes. Cause : privilège SELECT absent. Migration idempotente limitée à authenticated, avec préconditions et postcondition strictes, testée sur la copie restaurée (8 contrôles). Sauvegarde protégée table/ACL/politiques et rollback REVOKE testés ; 30 lignes et politiques inchangées, aucun droit anonyme/écriture ajouté. Les deux vues navigateur lisent maintenant 5 affirmations de leur catégorie, HTTP200 et contrat de contenu valide. Reçus : `affirmations-database.json`, `affirmations-applied.json`, `affirmations-browser.json`. Aucun nouveau bundle applicatif requis pour ce changement SQL.

État final 04:41 UTC : healthy, zéro redémarrage, base saine, runtime inchangé mode0600, 71 autres conteneurs identiques. Le détecteur brut « zéro ligne Error » a signalé 3 refus Next.js de références Server Action malformées ; ce FAIL reste archivé. Classification exacte et une sonde négative supplémentaire : 404 avant exécution, 4 avertissements classés, zéro erreur non classée. Origine des trois premières requêtes UNKNOWN. `runtime-final-classified.json` ne prétend pas des logs vides.

Rollback image : `python3 deploy/ovh.py rollback --source-ref 86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164`. Rollback SQL distinct : fichier privé `/opt/purama/apps/sutra/backup-affirmations-6800a8de4908/rollback.sql`, REVOKE SELECT uniquement ; jamais restaurer un vieux dump sur des données nouvelles.

Salad reste désactivé. Aucun GPU, achat, génération facturée, publication, rotation ou modification d'une autre application.

## Portée et limites

PASS de contrat/simulation, authentification fournisseur et génération réelle sont distincts. Création/pipeline/export vidéo/publication complets ne sont pas prouvés en production. Aucun compte social n'est connecté automatiquement. Les sessions de recette éphémères utilisent l'identité autorisée existante, sans email envoyé, puis sont révoquées individuellement ; ce n'est pas un test du mot de passe utilisateur.

Absences connues : ordonnanceur/worker autonome SUTRA OVH et journal Salad distant non activés. La reprise sans requête et la publication planifiée ne sont pas opérationnelles. Les handlers existent ; leur activation pourrait générer/publier et reste hors recette gratuite. Graphes GitNexus périmés/tronqués : impacts signalés et revues directes/testées, aucune garantie d'exhaustivité. Dépendances historiques à risque faible/modéré conservées ; la mitigation OTS ne supprime pas les avis npm.

## Actions utilisateur minimales

1. Ouvrir [SUTRA](https://sutra.purama.dev/login), puis lire et accepter personnellement les conditions affichées si vous souhaitez continuer. La recette a constaté ce consentement en attente et ne l’a pas donné à votre place. Les 10 rendus connectés desktop/mobile passent ; le parcours interactif complet reste bloqué par ce consentement.
2. Si connexion sociale souhaitée : ouvrir [les réseaux SUTRA](https://sutra.purama.dev/settings/social) et consentir aux seuls comptes voulus, dans la même session/navigateur. Profil PURAMA existant réutilisé. [Guide Zernio](https://docs.zernio.com/guides/connecting-accounts). Aucun consentement n'est effectué à votre place.
3. Si mode personnel souhaité : autoriser une ressource GPU distante et son budget, puis fournir la clé Salad dans le maître sécurisé. [Développeurs Salad](https://salad.com/developers/), [prix officiels](https://salad.com/pricing/). La qualification réelle du container amd64/CUDA, du modèle et de la VRAM reste nécessaire. Les sept variables préparatoires manquantes au dernier contrôle : `SALAD_API_KEY`, `SALAD_GATEWAY_URL`, `SALAD_WORKER_TOKEN`, `SALAD_WORKER_DATABASE_URL`, `SALAD_QUALIFICATION_JSON`, `SALAD_QUOTE_JSON`, `SALAD_MAX_ESTIMATED_COMPUTE_USD`. Ne pas inventer endpoint, devis ou qualification. Aucun mode IA local Mac disponible/prouvé ; le GPU distant et les API peuvent être payants.

Aucun test payant avant devis exact et accord explicite. Aucun coût minimal réel de vidéo démontré.

## Préservation

`terminal-preservation-final.json` (04:33 UTC) décrit chaque SHA/worktree et le WIP préservé. T02–T08 : lots SUTRA livrés, arbres propres ; fermables pour ce lot seulement, aucun terminal fermé. Les autres missions sont exclues. AGENTS.md et les skills GitNexus étrangers de l'intégration restent hors commit. Commits protégés conservés. Aucun reset/stash/clean, suppression de worktree ou arrêt de service existant.

DNS : quatre résolveurs concordants vers OVH, TLS1.3 valide jusqu’au 10 janvier 2027. Cloudflare DNS-only est une inférence des réponses DNS ; API Cloudflare NON TESTÉE, aucune modification DNS.

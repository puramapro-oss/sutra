# T04 → T01 — validation fournisseurs / GPU distant

Base confirmée `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`. Branche `codex/sutra-t04-provider-validation-20261014`. Commit local porteur de ce fichier ; SHA exact transmis dans `.coord/handoffs/SUTRA-20261012/T04-PROVIDER-VALIDATION-20261014.md` du dépôt coordinateur.

- **PASS nouveaux** :14 contrats hors ligne,0FAIL/0SKIP, lint ; quatre GET authentifiés HTTP200 à13:58:12UTC : RunPod endpoint health, Shotstack templates stage/v1, SunoAPI crédits. RunPod0worker prêt ; SunoAPI crédits disponibles. Provenance master, valeurs/corps expurgés.
- **PASS réutilisés** :36 empreintes T04 identiques ; zéro delta applicatif/deps/config depuis CI86d04c85 ;91 tests T04 précédents et CI805PASS/7SKIP, TS/lint/build verts, non additionnés/non rejoués.
- **FAIL corrigés dans le seul harnais neuf** : normalisation dotenv de bord et code applicatif Suno429 (crédits, distinct du rate limit). Reproductions RED puis GREEN conservées. Aucun nouveau défaut produit démontré, aucun adaptateur recréé/modifié.
- **BLOQUÉ pour activation Salad** :14 variables absentes (noms dans README/live.json), image Linux/amd64 épinglée et qualification réelle modèle/GPU/VRAM manquantes. Worker/bridge/port durable existants réutilisés, restent désactivés. Aucun prix ni compatibilité GPU présumé.
- **NON TESTÉ** : auth/crédits LTX ; droits de génération/crédits RunPod et Shotstack ; toute génération/rendu/cancel/artefact/facture réelle ; runtime Salad. Aucun appel admin RunPod. Pas de fallback payant implicite ni POST après incertitude.

Fichiers livrés exactement : `HANDOFF-SUTRA-T04-PROVIDER-VALIDATION-20261014.md`, append `BATON.md`/`task_plan.md`, nouveaux fichiers sous `qa/t04-provider-validation-20261014/` (inventaire `proof.json` et `git show --name-only` du commit). Aucun changement src/scripts/deps/config, pipeline/Shotstack/UI/OAuth/OVH préservés.

Commandes, preuves, contrats/capacités/annulation, limites et sources officielles : [dossier](qa/t04-provider-validation-20261014/README.md). Entrée QA14 tests : `node --require ./qa/t08/offline.cjs --test qa/t04-provider-validation-20261014/probe.test.mjs`, Node24.21.0. Contrôle GitNexus avant commit ; graphes tronqués, exhaustivité UNKNOWN.

Action minimale : choisir fournisseur/budget pour un essai réel séparément autorisé. Pour Salad, préparer et qualifier l’image/poids/VRAM puis seulement remplir le manifeste réel et activer par T01. Pour RunPod, confirmer schéma worker et limite d’exécution serveur avant un seul job. Le health200 ne prouve pas ces étapes. Protocole exact et14 noms dans le dossier ; aucune clé existante à remplacer sur la base de ces preuves.

Aucun push/fusion/déploiement/migration/provisioning/publication/GPU Mac/modèle téléchargé. OVH seulement preuve read-only T01 réutilisée ; pas de SSH T04. Aucune garantie « zéro bug » ni qualification live déduite de mocks.

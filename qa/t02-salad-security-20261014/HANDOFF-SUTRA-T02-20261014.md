# T02 → T04/T01 — livraison locale sécurité Salad

- Branche : `codex/sutra-t02-salad-security-20261014`, depuis `14617333bfb21efe1f2a1c91888d3322dde20f5b` (application `e3b17117256269e281304cd4ab83bc722a6f7894`). SHA final dans le handoff de coordination après commit.
- Fichiers : nouveau `scripts/test-t02-salad-security.mts` et dossier `qa/t02-salad-security-20261014/**` seulement. Zéro modification produit/configuration/secrets, aucune fusion/push/production.
- Base : 23 tests, **14 PASS / 9 FAIL** explicitement conservés. Cinq protections absentes pour un accès distant du bridge historique ; il reste limité à 127.0.0.1, donc pas de preuve d'exposition publique. Voir S01–S05 du README.
- Contrat T04 réel : **31 PASS / 31**, imports directs en lecture seule dans son worktree, empreintes avant/après stables. Scope URL/SSRF, auth serveur, tokens, accès résultats, erreur expurgée. Faux transports et stockage ; aucun GPU ni moteur lancé. Le WIP T04 n'est pas présenté comme un commit intégré.
- Lint ciblé, TypeScript ciblé et Gitleaks : **PASS**. Aucun build/global gate rejoué. GitNexus impact HIGH signalé ; index tronqué, `detect_changes` sans correspondance des fichiers nouveaux et diff vérifié séparément.
- Blocages réels de qualification distante : branchement owner-only final T04 non encore publié à l'heure du contrôle ; réseau/stockage durable/RLS/runtime distant non testés sous le mandat sans activation. Le traitement des défauts historiques passe par le wrapper privé T04, pas par une exposition directe ou une correction concurrente T02.
- Reprise minimale T01 : comparer les empreintes `contract-manifest.json` au delta T04 retenu ; rejouer seulement les assertions touchées si elles changent ; vérifier le raccord session propriétaire avant activation éventuelle, ainsi que la fermeture réseau du bridge. Aucune action utilisateur nécessaire pour cette livraison locale.

Commandes exactes, preuves expurgées, limites et matrice : [README.md](README.md). Coordination : `/Users/matissdornier/purama/.coord/handoffs/SUTRA-20261012/T02-SALAD-SECURITY-20261014.md`.

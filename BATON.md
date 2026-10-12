# BATON — SUTRA T01 CHEF — 2026-10-12

Branche `codex/sutra-t01-integration-20261012`, worktree isolé du même nom sous `purama-worktrees`.
Code : `19ea35fbbfe99a978f119f3939ff9935362191dc`, base PR3 `7088a0a` ; cinq références protégées conservées.

**T01_SCOPE_PASS / INTEGRATION_BLOCKED_OWNER_DELIVERIES / GLOBAL_GATE_FAIL.**

Livré : CI web, dépendances autonomes et verrouillées, trois transitives corrigées, runner de gates sans environnement fournisseur, garde SQL local jetable, port média IPC isolé. Aucun fichier produit modifié.

Preuves Node24.21.0 : contrats243 PASS+1 SKIP réseau, schedule/composition/publication PASS, média synthétique3/3, typecheck/build197pages PASS, SQL local13/13, lint T01 PASS. Lint global FAIL3 max-lines dans ltx(T04), production-pipeline(T03), sutra-auto(T06). Audit0critique/0haute/5modérées/2faibles. Workflow distant NON EXÉCUTÉ ; SMARANA_READ_TOKEN lecture seule requis côté CI.

Source de reprise : [HANDOFF-SUTRA-T01-20261012.md](HANDOFF-SUTRA-T01-20261012.md), `qa/t01/verification.json`, snapshot des huit lots et messages sous `/Users/matissdornier/purama/.coord/handoffs/SUTRA-20261012/`.

Prochaine tâche non vérifiée : recevoir commits/handoffs T02–T08, ownership T03 et ACK des conflits export/test partagé ; réconcilier les branches S5 T04/T05/T08 contre PR3. Aucun WIP à copier ou fusionner. Garder PR3 LTX durable/probe/provenance et PR2 calendrier. Le brouillon T08 est une preuve S5 distincte à adapter, pas un verdict sur PR3.

Ne pas refaire les preuves inchangées ; ne pas déployer, pousser ou appliquer une migration de production. Cluster PostgreSQL de test arrêté, sources/worktrees/principal préservés.

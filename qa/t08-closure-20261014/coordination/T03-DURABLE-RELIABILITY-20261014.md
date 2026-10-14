# T03 → T01 — fiabilite durable

| SUTRA-T03-20261014:DURABLE-RELIABILITY | 2026-10-14T13:47:46.955786+00:00 — Reprise utilisateur T03 orchestration/etats/checkpoints/quotas. Base T01 e09fdaeafbf1ec8554a7b689fe3c44dd696d0140 confirmee HEAD/LOCKS/handoff ; six fichiers fe99ebe et contrat Suno0e20845 identiques integres. Worktree sutra-t03-durable-reliability-20261014, branche codex/sutra-t03-durable-reliability-20261014. Reserve exclusivement nouveaux qa/t03-durable-reliability-20261014/**, scripts/test-t03-durable-reliability.mts, HANDOFF-SUTRA-T03-DURABLE-RELIABILITY-20261014.md, append BATON/task_plan/ERRORS propres et miroir .coord/handoffs/SUTRA-20261012/T03-DURABLE-RELIABILITY-20261014.md. Produit lecture seule avant defaut reproduit/extension exacte. SQL eventuel propose a T01 seulement ; aucun adaptateur T04/media T05/social T06/CI/config/OVH modifie. Tests synthetiques hors reseau, aucun secret/GPU/IA/paid/publication/push/merge/deploy/migration distante. | ACTIF T03 |

Integration precedente verifiee, aucun delta produit manque. Tests nouveaux sur risques SQL/etats/reprise seulement.

## Delta reproduit pour T01
Base e09fdae ; nouveau test worker/finish : 10 FAIL, 1 PASS. Resultat null invalide accepte en reprise, et skip musique contradictoire accepte apres ACK perdu. Correction locale bornee aux deux fichiers reserves video-worker.ts / video-queue.ts. SQL checkpoint/claim/finish en investigation, proposition locale a suivre, aucune migration appliquee hors fixture.

| SUTRA-T03-20261014:DURABLE-RELIABILITY:SUBMISSION-REDACTION | 2026-10-14T14:03:20.303766+00:00 — ACK attribution T01 ACK-T03-SUBMISSION-REDACTION : reserve exactement src/lib/pipeline-submit.ts, tests nouveaux et copie inchangee du test auteur T02 dans QA T03 pour reproduction. Aucun fichier route ni test auteur T02 modifie. Diagnostic RPC public constant/codes metier autorises ; statuts, idempotence et quotas preserves. Impact et reproduction avant correction. | ACTIF T03 |

## Point T01 — correctifs et proposition SQL (avant gel)
T02-FINAL-01 reproduit avec copie byte-identique de son test : 3 PASS /1 FAIL ; apres correction pipeline-submit.ts : test auteur4 PASS, nouveaux codes/transport6 PASS et regressions submission3 PASS. Aucun fichier route ou T02 modifie.
Proposition SQL QA uniquement : finish refuse null hors musique explicitement desactivee, checkpoint refuse remplacement de resultat final/stage termine/scenes, claim par cle met les reprises epuisees en reconciliation_required. Base SQL canonique 7 PASS/5 FAIL ; proposition 12 PASS dont processus fixture termine brutalement/repris, concurrence12 clients, et vrais CHECK auto ready/pending_approval. Aucun distant.
Attention integration migration : scripts/test-pipeline-postgres.mts lignes77-81,200-209,230 construisent les fixtures invalides en remplaçant des checkpoints deja completes ; adapter chaque scenario a un job independant avant campagne avec proposition, sans supprimer les assertions media. Aucun edit de ce test par T03 dans ce lot.
Gel/commit local suivent ; ne pas importer WIP.

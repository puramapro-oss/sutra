# T03 reprise Salad — en cours, 2026-10-14

Mission distincte Matiss01h40, scope exclusif LOCKS reserve. Branche `codex/sutra-t03-salad-recovery-20261014`, base `14617333bfb21efe1f2a1c91888d3322dde20f5b`.

T01/T04 : tests nouveaux `scripts/test-t03-salad-recovery.mts`, preuves `qa/t03-salad-recovery-20261014/**`. Produit/file/pipeline lecture seule. Aucun reseau, secret, GPU, paid call, push/merge/deploy. T01 seul config/OVH/Zernio/integration.

Base inspectee : worker personnel synchrone `local-engine.ts` ; pas encore de `src/lib/salad/**`. Tests en preparation sur la vraie file/pipeline pour timeout apres soumission, perte de recu, expiration/reprise du bail et absence de second POST/fallback. Reconciliation d un job Salad identifiable restera non certifiee sans adaptateur T04 livre. Ne pas reprendre les anciens blocages OAuth/Suno/RunPod/Shotstack : preuves1461733 et validation01h26 font foi.

Livraison finale remplacera ce statut avec SHA local et resultats exacts.

## Point de coordination T01/T04/T08
16 simulations sur le vrai runVideoJob + transport RPC factice passent sur la base1461733 : timeout/deconnexion/202 apres soumission, 12 reprises par cas sans second POST, 24 claimants, bail expire, ancien worker refuse, pertes d accusés intention/etapes/resultat/evenement. Aucun socket, media/GPU ou appel fournisseur. Ces doubles ne certifient pas PostgreSQL. Produit inchange.

Cas limite confirme sur base1461733 : reponse202 avec job_id au POST synchrone => SUTRA_LOCAL_FAILED puis SUTRA_RECONCILIATION_REQUIRED, ID non conserve. Pas de seconde generation, mais pas de reprise GET possible. Ce n est pas un defaut attribue au nouvel adaptateur T04 : il est en cours. T03 prepare le complement sur le vrai createSaladClient/journal T04 et attend son contrat stabilise/commit pour qualifier les preuves. Ne pas copier/reimplementer l adaptateur dans les tests.

Complement maintenant execute : 9/9 PASS provisoires sur vrais createSaladClient + createSaladWorker T04 charges en lecture seule (journaux et bridge doubles, aucune copie du produit). Timeout apres acceptation, 12 GET de reprise meme ID, reserve/ACK ambigus client et worker, CAS ancien owner refuse, slot UNKNOWN conserve apres deadline/reconstruction, 24 clients concurrents => 1 soumission/1 calcul simule ; conflit entree => aucun nouvel appel. Empreintes exactes dans `qa/t03-salad-recovery-20261014/adapter-result.json` du worktree T03. T04 encore non committe : preuve WIP uniquement, aucun PASS integre/runtime/SQL. Typecheck cible et lint zero avertissement PASS. T01/T04 : merci de conserver le raccord durable dans votre scope ; T03 ne l implemente pas.

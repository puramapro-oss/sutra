# T01 — base commune de consolidation — 2026-10-14T13:48:19.043970+00:00

Destinataires explicites T02 T03 T04 T05 T06 T07 T08.

- Integration locale : e09fdaeafbf1ec8554a7b689fe3c44dd696d0140, worktree sutra-final-providers-20261013.
- Production OVH reverifiee maintenant en lecture seule : source86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164 ; image sha256:d1c8e9ee93fd7c647a92461acb192f934e6ddac6e9976459457e0fef693541fc ; healthy,0restart. Migration distincte6800a8de4908 deja appliquee et prouvee.
- Les sept livraisons finales precedentes sont deja integrees. Les4FAIL/3BLOQUE/9NONTESTE T08 concernent b7cf848 : T01 prepare leur reconciliation exacte, aucune reexecution globale.
- T03/T04/T07 : reservations reprises13:45–13:47 reconnues, conservez vos seuls scopes. Pas de build complet concurrent. Transmettez uniquement nouveaux defauts/SHA/preuves via handoff. T01 ne refait pas vos controles.
- T05 : 2da10b34a1715a6f33b1087f8c53480353727f56 recu, verification/import des preuves CPU en cours.
- T02/T06 : deltas precedents conserves ; signaler seulement nouveau delta livre, sans audit general.
- T08 : recette independante demandee du candidat final a venir, cible16 points originaux + preuve T05 + preparation cron securisee. Ne pas refaire les suites inchangees. Aucun ACK presume.
- T01 seul : configuration, migration, OVH, ordonnancement. Routes generatives/publication restent inactives jusqu'a preuve de garde-fous ; zero appel payant/publication.

Ce bulletin communique la meme base aux sept responsables via canal canonique ; lecture/ACK non encore confirmes. Aucun terminal interrompu.

## Coordination 2026-10-14T13:57:52.823326+00:00
- T03 : prendre en charge T02-FINAL-01 (diagnostic RPC expose HTTP503) selon reservation ACK-T03-SUBMISSION-REDACTION ; test auteur deja present dans worktree T02. Produire test RED/GREEN, erreurs publiques bornees et statuts/reprise conserves. T01 ne modifie pas ces symboles en parallele.
- T07 LEGAL-UI et T03 DURABLE-RELIABILITY: extensions reconnues, candidat final differe jusqua livraison.
- T04 : ACK recu. Pas de sondes live dupliquees par T01.
- T08 : besoin validation independante du candidat apres ces nouveaux correctifs ; aucune generation/publication ni build concurrent. Confirmer disponibilite via handoff.

## Coordination 2026-10-14T14:10:10.747632+00:00
- T08 ACK14:07 recu. Merci de conserver recette finale bornee ; candidat exact transmis apres T03/T07/T06 geles. Matrice provisoire et revue complementaire disponibles chez T01 qa/t01-consolidation-20261014 : R18 sous-critere CPU PASS mais exigence Reel continu NON TESTE ; R41 FAIL modal actuel ; R47 BLOQUE candidat, historique86d PASS. Ne pas reprendre les builds/CI.
- T02 56c0ca82 importe33fichiers exacts + appenddocs ; rouge historique conserve, correctif T03 attendu. T05 2da10b34 importe82fichiers,37MP4/11producteurs verifies.
- T03 : point14:08 recu, SQL proposition sera revue/testee/integree par T01 seul. Ne pas adapter scripts/test-pipeline-postgres.mts en parallele ; T01 en prend la reservation pour fixtures independantes conservant les assertions. Aucun import WIP.
- T07 extension PLAYER-UI reconnue ; T06 SOCIAL-VALIDATION actif reconnu. Merci de geler apres defauts demontres et fournir SHA/commandes exactes, sans nouvel audit general.

## Coordination 2026-10-14T14:15:21.422769+00:00
- T04 64d2cf8 importe23 fichiers exacts apres controle base e09/arbre propre ; sondes gratuites non rejouees.
- T06 extension publication-journal et ACK T08 load.fixture reconnus. Garder le correctif borne puis livrer SHA ; aucun concurrent T01.
- T03 revue complementaire proposition SQL detecte exception LTX trop large : scene:N:ltx / asset:video:ltx permet identites id/fingerprint/journalv2/Salad deja acquises remplacees. provider_job_ids egalement mutable. T01 renforcera ces invariants dans sa migration sans bloquer revisions/statuts legitimes, avec tests propres ; ne pas modifier la proposition en parallele pour ce point. Merci de geler/livrer vos trois fichiers produit et preuves ; SQL final T01 seul.
- T08 candidat differe jusqua T03/T06/T07 geles + migration T01 validee. ACK de disponibilite recu, pas de nouveau retest historique demande.

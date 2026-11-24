# T03 → T1/T8 — clôture pipeline du20octobre

NACK propriétaire sur79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a : R107 confirmé. Ancien ACKab935 vérifié par empreintes, non transféré. Correction locale sur codex/sutra-t03-closure-20261020 ; commit contenant ce handoff, SHA transmis dans le miroir partagé T03-FINAL-DURABLE-20261015.md.

Livraison produit limitée : src/app/api/cron/sutra-auto/route.ts, src/lib/auto-scheduler.ts, migrations/20261020_t03_auto_scheduler.sql et .rollback.sql. Curseur transactionnel, réutilisation des RPC/jobs/quotas existants, rattrapage borné, CAS concurrent, reçus contrôlés et erreurs expurgées. Aucun adaptateur/montage/publication/worker remplacé.

134tests distincts PASS,0FAIL restant dans les sélections,0SKIP ; TypeScript/lint/calendrier PASS.19tests de reprise après dernière correction INSERT ;114autres invariants validés. PostgreSQL18 privé, reboot réel, dump/restore, rejouabilité/rollback, états/checkpoints/quota/annulation T7, musique désactivée/échouée, invalidation, leases, pertes ACK et port futur WanGP simulés. Toutes réservations synthétiques libérées ; clusters arrêtés. Reproductions rouges et empreintes conservées.

Preuves, commandes exactes, transitions, migration/rollback, limites : qa/t03-closure-20261020/README.md ; archive précédente qa/t03-final-ack-20261019 préservée explicitement ab935. T1 doit intégrer les4fichiers ensemble, ajouter la migration au processus autorisé et fournir le nouveau SHA ; T3/T7/T8 retestent le delta. Pas de migration réelle ni réactivation de cron autorisée ici. Installation ne rattrape pas implicitement l'historique antérieur.

PASS local ; FAIL79cd/R107 ; BLOQUÉ ACK final nouveau candidat non reçu ; NON TESTÉ production/fournisseurs/facturation/GPU/médias/publication et contrat réel WanGP. Aucun push, fusion, déploiement, secret ou autre worktree modifié. Aucune garantie générale de zéro bug.

# BATON — SUTRA T01, autorisation production 2026-10-12

**RELEASE_BLOCKED_CI — reprise 2026-10-13.** Secret SMARANA_READ_TOKEN ajouté, setup CI résolu. Run38313595126 tentative2 : contrats/médias/PostgreSQL/typecheck/lint/build/redteam/navigateur PASS ; legacy1019 PASS,25 SKIP,3 échecs de synchronisation navigation. Correction e2e/navigation.spec.ts : legacy complet1022 PASS,25 SKIP,0 FAIL,0 flaky ; lint ciblé PASS. Aucun changement applicatif ni production. Prochaine étape : push du correctif et CI complète verte avant migration/déploiement.

État précédent : **CODE_LOCAL_PASS / RELEASE_BLOCKED_CI.** Branche unique codex/sutra-t01-integration-20261012, base89250c7 ; T02–T08 intégrés,53 worktrees étrangers préservés.

Médias privés durables et signatures renouvelables livrés ; permissions Storage restrictives testées164 assertions. Contrats473/7SKIP, médias34, PostgreSQL13+12, typecheck/lint111warnings/build197 PASS ; redteam14, navigateur217/axe165, legacy1022/25SKIP PASS.

Sauvegarde cohérente OVH restaurée :136 tables et6 migrations deux fois PASS sur PostgreSQL15.8 ; seule la copie privée a été migrée. Image Linux44cdcd5 construite sur OVH ; cinq GET et FFmpeg PASS sans réseau sortant, candidat arrêté. Wrapper rollback17 tests et6 cas smoke isolés PASS. Détails exacts et preuves : HANDOFF-SUTRA-T01-20261012.md, qa/production-20261012/.

Prochaine tâche : secret GitHub SMARANA_READ_TOKEN readonly absent à fournir, puis CI verte avant migration/cutover/déploiement. Accès Cloudflare disponible ; DNS wildcard vers Vercel402 inchangé, TLS origine à qualifier. Aucun appel payant, aucun déploiement. Ne pas rejouer les PASS inchangés. Logger déjà présent ; limites S5 hybride/versions/cron-runs non validées conservées.

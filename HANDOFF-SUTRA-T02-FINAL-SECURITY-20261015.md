# T02 → T01 — sécurité finale, 15 octobre 2026

Branche : `codex/sutra-t02-final-security-20261015`.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t02-final-security-20261015`.
Base : `49c166d4c15412d2a3c1246c216cf0df319f2df0`, code candidat testé `3855665fa79e3cc2171124d864a834214d6ac617`.
SHA final : HEAD du commit portant ce handoff ; valeur complète transmise après commit dans `.coord/handoffs/SUTRA-20261012/T02-FINAL-SECURITY-20261015.md`.

## Correction livrée

**T02-CAP-01 CORRIGÉ LOCAL** : une capability de publication existante obtenait encore une nouvelle URL signée après révocation pending, perte/réaffectation du binding Zernio ou provenance du compte invalide. Neuf reproductions rouges conservées. `authorizePublicationMedia` réutilise maintenant `getAuthorizedProfileId` et vérifie les métadonnées d'autorité/révocation avant signature. Aucun système concurrent ni fichier T06 modifié.

Fichiers : `src/lib/private-media.ts` ; `scripts/test-private-media.mts` (fixture UUID/binding/provenance seulement, assertions conservées) ; nouveau `scripts/test-t02-final-security-grants.mts` ; `qa/t02-final-security-20261015/**` ; ce handoff et append propres `BATON.md`, `task_plan.md`, `ERRORS.md`. Réservations et avis T01/T06 antérieurs à l'édition. OAuth T06, médias T05, worker T04, orchestration T03 et SQL/config T01 préservés.

## Preuves

- **PASS** :19 nouveaux tests,22 régressions,0 FAIL/0 SKIP finaux. Route/HMAC/résolveur réels ; DB/session/Storage simulés et réseau fermé. Deux utilisateurs et deux profils Zernio distincts ; refus utilisateur/projet/journal/compte étrangers, révocation, expiration, secret absent, diagnostic DB et anonyme. TypeScript/ESLint ciblés codes0.
- **FAIL historiques clos** :9 cas sur la base ; premier rejeu legacy1FAIL dû à sa fixture sans autorité valide, corrigée sans changer les assertions. Journaux conservés.
- **PASS réutilisés** :9 fichiers du lot T02 a01c7a2 identiques et correctifs RPC T03/journal T06 présents ; CI38598361267 sur produit3855665 identique à la base.40 empreintes/objets vérifiés. Pas de nouveau build/gate globale identique.
- **GitNexus** : impact avant helper LOW (un appelant route média, quatre flows), fixture UNKNOWN ; index tronqué, pas de certification exhaustive. Analyse avant commit et scan expurgé dans QA.

Commandes exactes :

```sh
python3 qa/t02-final-security-20261015/run.py --phase green
python3 qa/t02-final-security-20261015/run.py --phase regression
python3 qa/t02-final-security-20261015/run.py --phase quality
```

Argv, codes, logs, matrice de couverture, limites et hashes : `qa/t02-final-security-20261015/README.md` et manifestes. Aucun secret réel lu ni `.env.local` créé ; fixtures synthétiques uniquement.

## Réception et risques restants

1. T01 intègre uniquement ce commit et ajoute le nouveau test `scripts/test-t02-final-security-grants.mts` à son runner CI. Le candidat combiné avec les deltas T03/T05/T06/T07 reste à qualifier avec T08 ; ce commit n'annonce ni intégration ni déploiement.
2. **BLOQUÉ pour certification RLS exhaustive, transmis T01** : l'inventaire statique signalait six tables sans ENABLE RLS littéral. Réponse metadata T01 du15oct01:14UTC : RLS activée6/6 ; aucun privilège client sur activity/api/error_logs. contest_submissions/referral_commissions/referrals ont des droits DML et politiques own_* ; T01 qualifie précisément leurs écritures sur copie privée. Preuves readonly reçues et empreintes dans `rls-t01-readonly-evidence.json` ; pas de vulnérabilité live affirmée par les seules ACL, aucune requête distante T02.
3. **NON TESTÉ** : deux organisations applicatives (modèle absent), tests DML RLS distants par T02, bucket/headers reverse proxy distants, consentement OAuth et révocation provider réels, génération/publication/paid/GPU. T06 conserve ses défauts callback/revoke du15oct ; aucun doublon T02.
4. Une URL Storage déjà signée peut rester utilisable jusqu'à300s ; le correctif ferme les émissions suivantes. Audit de dépendances de la candidate :2 low/5 moderate,0 high/critical ; alertes conservées, transport OTS mitigé antérieurement, aucune mise à jour majeure non justifiée.

Commit local seulement. Aucun push, fusion, déploiement, migration distante, connexion de compte, publication ou appel fournisseur. Travail tiers et worktrees conservés. Aucune garantie de sécurité exhaustive.

Mise à jour T01 reçue15oct01:15UTC : **FAIL EXTERNE REPRODUIT / CORRECTION T01 EN COURS**. Sur copie privée restaurée, trois écritures injustifiées sont confirmées : commission amount/status, referral level/processed et concours score/votes/status sous authenticated. Transactions synthétiques annulées ; aucune production modifiée. RLS activée ne protégeait pas ces colonnes du propriétaire. T01 réserve `migrations/20261015_client_write_permissions.sql` et ses tests ; T02 ne duplique pas. Preuve et empreinte référencées dans `qa/t02-final-security-20261015/rls-t01-owner-followup.json`. Ce constat remplace le statut antérieur de simple qualification en attente ; intégration finale BLOQUÉE à la correction et au retest T01/T08.

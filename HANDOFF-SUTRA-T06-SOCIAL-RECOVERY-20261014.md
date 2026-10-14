# T06 — OAuth social, planification et publication

Livraison locale pour T01, 14 octobre 2026. Branche `codex/sutra-t06-social-recovery-20261014`, worktree `/Users/matissdornier/purama-worktrees/sutra-t06-social-recovery-20261014`. Base `b7cf848d07fca2734db36a2e30d045ca312a3162`, version produit intégrée T01 `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`. SHA de livraison : commit porteur de ce document ; SHA complet également dans le miroir coordinateur `.coord/handoffs/SUTRA-20261012/T06-SOCIAL-RECOVERY-20261014.md` après commit.

## Résultat

**PASS local : 162 tests distincts**, TypeScript ciblé, lint des fichiers modifiés sans erreur ni avertissement. Aucun push, fusion, déploiement, publication, achat, génération, appel fournisseur ou calcul IA Mac. Aucun secret réel lu/copié/modifié. Corrections bornées aux fichiers réservés, fixtures sécurité avec ACK T01 ; WIP de T01/T02–T08 préservés.

Défauts démontrés corrigés :

- Refus OAuth sans consommation du state et erreur non liée à la session.
- Ancien consentement ou callback en vol réactivant un compte révoqué.
- Alias `twitter` des refus X et classification trop large des erreurs comme refus utilisateur.
- Déconnexions concurrentes / consentement pendant DELETE, avec réponse API 409 explicite.
- Revue T01 : timeout ou 503 levant trop tôt la barrière malgré une DELETE distante potentiellement tardive. Barrière désormais durable tant que le résultat reste non confirmé.

Les states sont liés à la version du compte en plus de l'utilisateur, la plateforme, la session, le profil et le navigateur. Écriture conditionnelle SQL pour un compte existant ; INSERT protégé par unicité pour un premier compte. Aucun écrasement d'une nouvelle autorisation. Révision par nonce, sans dépendre de l'horloge. Historique et identités de publication conservés ; aucune modification de l'adaptateur Zernio ou de ses bindings.

## Fichiers

Produit :

- `src/app/api/social/callback/route.ts`
- `src/app/api/social/connect/route.ts`
- `src/lib/social-oauth-account.ts` (nouveau helper commun)
- `src/lib/social-oauth-state.ts`
- `src/lib/social-account-revocation.ts`

Tests/fixtures : `scripts/helpers/social-database.mts`, `scripts/test-release-oauth.mts`, `scripts/test-security-routes.mts`, `scripts/test-t02-oauth-boundaries.mts`, `scripts/test-t06-social-autonomy.mts`, `scripts/test-t06-social-final.mts`.

Preuves et runners : `qa/t06-social-recovery-20261014/**`. Documentation : ce handoff, ajouts `BATON.md`, `task_plan.md`, `ERRORS.md`. Aucun fichier d'ordonnancement, journal de publication, config, migration, UI, package/lock ou fournisseur modifié.

## Tests exacts et régressions

- `node qa/t06-social-recovery-20261014/run.mjs` : contrats ciblés, six consommateurs de publication, TypeScript ciblé et lint. Commandes internes intégrales dans les reçus JSON ; preload hors réseau et environnement synthétique. Première exécution : 147/149 PASS, deux fixtures OAuth anciennes FAIL. Après ACK T01 : `node qa/t06-social-recovery-20261014/run.mjs security-fixture lint-security typecheck`, 10/10 PASS. Les 139 autres tests inchangés ne sont pas rejoués : total résolu 149/149.
- `node qa/t06-social-recovery-20261014/run.mjs lint-qa typecheck` : PASS après ajout de la preuve PostgreSQL ; types Next globaux explicites dans la config QA (aucun build nécessaire).
- `node qa/t06-social-recovery-20261014/run-postgres.mjs` : 7/7 PASS sur PostgreSQL18 réel isolé. Le vrai helper émet ses filtres en SQL paramétré : concurrence 24, CAS, NULL, égalité JSONB, nonce même horloge, révocation, unicité et propriété utilisateur. Cluster propre arrêté/conservé. Le transport HTTP PostgREST n'est pas exercé.
- Planification IANA/DST/récurrences : PASS intégré réutilisé, sources/dépendances/runner identiques au manifeste T01 (`reused-proof.json`). Aucune suite globale ou build identique relancé.
- Refus, tokens expirés, comptes déconnectés, timeout, succès partiel, reprise après réponse perdue, conservation des résultats par destination et refus de média non vérifié : régressions ciblées PASS. Tous les fournisseurs et publications sont simulés.

Reproductions avant/après, détails GitNexus, commandes, limites et parcours utilisateur : [README des preuves](qa/t06-social-recovery-20261014/README.md). Les FAIL de reproduction et premières erreurs de fixtures/config QA sont conservés, sans les assimiler à des résultats finaux verts.

## Intégration et limites

- `boundDigest` HIGH (deux appels directs/deux routes) annoncé avant modification ; impacts autres symboles et `detect-changes` archivés. Graphe tronqué : aucune certification exhaustive. Revue directe du delta social et preuves ciblées complètent le graphe.
- Aucun prérequis de migration. Les states OAuth émis par l'ancienne version seront invalidés : recommencer un consentement depuis les réglages après intégration.
- **BLOQUÉ réel : planification automatique OVH NON ACTIVE/NON PROUVÉE**, constat T01 02h25 UTC (aucun cron/worker autonome). Aucune activation ni invocation réelle par T06.
- **ACTION T01 si révocation ambiguë :** conserver `revoked` et la barrière ; confirmer fin/résultat de l'opération distante avant toute levée conditionnelle sur la même révision. Un GET instantané « connecté » n'exclut pas une DELETE tardive. Pas de retry distant ou de reconnexion automatique. Cette situation est testée en simulation, pas observée sur un compte réel dans ce lot.
- **NON TESTÉ :** PostgREST réel, navigateur avec consentement externe, renouvellement/révocation réels des tokens, permissions du compte fournisseur, publication/planification réelles. Build global et campagne intégrée de ce delta réservés à T01 ; les preuves anciennes ne certifient pas ce commit.

## Défaut UI transmis à T07, non modifié en parallèle

`src/app/(dashboard)/settings/social/page.tsx:121` jette `connect_failed` avant de lire le corps JSON, puis affiche seulement « Connexion [réseau] indisponible ». Reproduction déterministe proposée à T07 : intercepter POST `/api/social/connect` avec 409 et `{error:"Déconnexion en cours de vérification…"}` ; la page perd le diagnostic alors que l'API le conserve. Même perte pour le 503 de binding. Constat de code direct ; **reproduction navigateur de ce delta NON TESTÉE** par T06. T07/T01 gardent la correction UI et sa recette ; aucune modification de page par T06.

## Action minimale de Matiss

Après intégration T01, se connecter sur [SUTRA](https://sutra.purama.dev/login), ouvrir [Réglages sociaux](https://sutra.purama.dev/settings/social), puis **Se connecter** sur chaque réseau souhaité. Choisir le compte et la destination exacts dans le consentement hébergé, contrôler les autorisations de publication, revenir dans le même navigateur/session en moins de dix minutes, vérifier l'identité affichée. Après refus/expiration : nouveau consentement, ancien lien inutilisable.

Réseaux disponibles : TikTok, YouTube, Instagram, Facebook, X, LinkedIn, Pinterest, Reddit, Threads. Si binding absent ou déconnexion non confirmée : T01. Si une offre, un moyen de paiement ou un supplément est demandé : arrêter, sans achat. [Guide officiel Zernio](https://docs.zernio.com/guides/connecting-accounts). Aucun compte ni consentement utilisateur effectué par T06.

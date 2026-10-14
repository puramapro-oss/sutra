# T06 — SOCIAL FINAL, reprise 14 octobre 01h40

Reservation active dans les deux LOCKS : tests/proofs/handoff seuls, base1461733 (applicatif e3b1711). Aucun changement OAuth, binding Zernio/config/OVH reserves a T01. Identite utilisateur confirmee et organisation PURAMA prises comme contexte, aucun identifiant serveur ou profil devine. Tests hors reseau, compte synthetique exclusivement ; aucun secret ni live. Livraison locale a venir.

## Signalement T01 — regression reconnexion confirmee, correction hors scope T06

Test nouveau `scripts/test-t06-social-final.mts`, cas `T06-FINAL UI regression`: vrai connect/callback/adaptateur Zernio + DELETE comptes + GET comptes + SSR PlatformGrid, stockage et transport simules. Apres revoke, GET renvoie la ligne `status=revoked` conservee pour l'historique. `src/components/settings/social/PlatformGrid.tsx:64` calcule `isConnected = !!account` ; absence de `data-testid="connect-youtube"`, badge Connecte et bouton Deconnecter persistent. L'ecran `settings/social/page.tsx` conserve aussi toutes les lignes dans accountsByPlatform et connectedCount. Reconsentement par l'UI bloque, sans effet sur la protection serveur (replay POST refuse apres revoke).

Test rouge laisse explicite, aucun skip/todo ni correction produit dans ce lot. T01 peut router le correctif vers le proprietaire UI, sans duplication. Derniere branche T01 observee `57e4042` : binding/config proprietaire T01, aucun rerun live T06. Livraison tests/proof/SHA en cours.

## Livraison locale a T01 — terminee

- Branche : `codex/sutra-t06-social-final-20261014`.
- SHA : `48c3191aa76b7ce7a42aa008250d7fc829fffc15` ; base `14617333bfb21efe1f2a1c91888d3322dde20f5b`, application `e3b17117256269e281304cd4ab83bc722a6f7894`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t06-social-final-20261014`, propre apres commit. Aucun push/fusion/deploiement.
- Fichiers livres :
- `HANDOFF-SUTRA-T06-SOCIAL-FINAL-20261014.md`
- `qa/t06-social-final-20261014/README.md`
- `qa/t06-social-final-20261014/contracts.tap`
- `qa/t06-social-final-20261014/gitnexus-changes.json`
- `qa/t06-social-final-20261014/gitnexus-impact.json`
- `qa/t06-social-final-20261014/lint.txt`
- `qa/t06-social-final-20261014/manifest.json`
- `qa/t06-social-final-20261014/security-findings.json`
- `qa/t06-social-final-20261014/security-triage.json`
- `qa/t06-social-final-20261014/security.txt`
- `qa/t06-social-final-20261014/tsconfig.json`
- `qa/t06-social-final-20261014/typecheck.txt`
- `scripts/test-t06-social-final.mts`

### Commandes / resultats

- Node24 `--require ./qa/t08/offline.cjs --experimental-test-module-mocks --import tsx --test --test-reporter=tap scripts/test-t06-social-final.mts` : **24 PASS / 1 FAIL / 0 SKIP**, exit1. Le FAIL est le contre-test de reconnexion UI apres revocation, aucune des protections serveur testees en echec.
- `./node_modules/.bin/tsc --noEmit -p qa/t06-social-final-20261014/tsconfig.json` : exit0.
- `./node_modules/.bin/eslint scripts/test-t06-social-final.mts` : exit0.
- `gitleaks git --pre-commit --staged --redact=100 --no-banner --no-color` : exit0 final. Deux faux positifs initiaux SHA256 source verifies, format de manifeste clarifie sans exclusion.
- GitNexus impact execute (journal HIGH annonce, OAuth/revoke LOW) puis detect_changes staged sur worktree explicite : 13 fichiers, LOW, aucun symbole/processus existant touche. Index ancien : limite explicite, aucune certification exhaustive. Revue Git et empreintes de sources produit egales e3b1711.

### Reception / blocages

Tests et preuve remis, **audit non vert**. Router le correctif UI au proprietaire competent : `PlatformGrid` + projection/comptage de `settings/social/page.tsx` doivent traiter status revoked/disconnected/expired ; conserver la ligne historique. Le toast de deconnexion traite aussi API202 unconfirmed comme succes simple (constat source, pas seconde preuve navigateur). Ne pas corriger OAuth ni supprimer l'historique pour rendre le test vert. Le mandat T06 se limite explicitement aux nouveaux tests/handoff ; aucune edition produit realisee.

Votre binding Zernio est confirme par votre preuve57e4042, sans re-sonde ni inspection de secrets T06. Parcours utilisateur exact et neuf consentements possibles dans README : `/login` → `/settings/social` → Se connecter → autorisation hebergee personnelle → callback automatique sous dix minutes dans la meme session. Premiere connexion possible ; reconsentement apres revoke bloque jusqu'au correctif UI. Aucun compte reel connecte. Aucune nouvelle action de cle fournisseur demandee. Rafraichissement/rotation de jetons natifs delegues a Zernio, non qualifies en live dans ce lot.

Scope T06 clos pour ce jalon tests/preuves ; worktree conserve et disponible pour reception par T01. Les autres owners restent inchanges.

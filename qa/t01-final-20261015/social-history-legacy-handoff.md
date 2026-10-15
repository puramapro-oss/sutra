# T01 auxiliaire — T06-INTEGRATED-02 — 2026-10-15

Base : `56754679abed9aa1e51323c29aed5bef38bc17d0`, branche `codex/sutra-final-providers-20261013`. Propriétaire SQL : auxiliaire `oauth_owner`, délégation T01. Fichiers T06 et WIP étrangers préservés. Aucun commit, SSH, secret, appel fournisseur, déploiement ou migration distante.

**CORRIGÉ / TESTÉ LOCAL.** Le premier nouveau test reproduit `SUTRA_SOCIAL_HISTORY_REVOCATION_INVALID` sur un compte Zernio avec profil valide mais sans `sutra_oauth_revision` : cinq contrôles PASS puis un FAIL, trace [avant](social-history-legacy-before.log). Ce refus annulait atomiquement la révocation locale demandée par la route.

Le déclencheur accepte désormais cette entrée en révocation uniquement depuis une ligne dont `credential_owner=zernio`, le profil historique est valide et inchangé, la clé de révision est réellement absente, et aucun pending vrai ou mal formé n'existe. Les contrôles de writer serveur, propriétaire, plateforme, compte externe, nouvelle révision et provenance restent communs. Une révision présente mais null/invalide est toujours refusée. Les lignes étrangères non marquées restent hors journal.

Seul le fait nouveau `revocation_requested` est ajouté pour ce cas legacy : portée demandée/grant inconnus, issue distante inconnue, horodatage serveur et révision de l'opération. Aucun ancien consentement, ancienne révision ou `authorization_observed` n'est inventé. Confirmation, reprise idempotente et reconnexion conservent ensuite les faits normalement. L'échec d'insertion du journal annule aussi la première révocation legacy et le nettoyage de ses credentials.

Commandes exécutées depuis le worktree T01 :

```sh
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node scripts/test-final-social-history.mjs
/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node node_modules/eslint/bin/eslint.js --max-warnings=0 scripts/test-final-social-history.mjs
python3 qa/t01-final-20261015/social-history-transition-test.py
node .gitnexus/run.cjs detect-changes --scope all --repo .
git diff --check
```

- PostgreSQL 18 privé, socket local : **27 PASS / 0 FAIL / 0 SKIP**, cluster propre à ce test arrêté. [Trace](social-history-legacy-after.log), [résultat structuré](social-history-result.json).
- Quatre nouvelles familles : cycle legacy request/confirmation/reconnect sans consentement fabriqué ; neuf provenances invalides ; refus de mutation d'identité/profil/compte et de requête fabriquée par INSERT ; huit écrivains CAS concurrents pour un seul fait. Le contrôle de panne d'audit existant couvre désormais également la première révocation legacy.
- Lint ciblé : **PASS / 0 avertissement**. [Trace](social-history-legacy-lint.log).
- Simulations locales de transition : **12 PASS** avec les métadonnées régénérées du SQL corrigé. [Trace](social-history-legacy-transition-tests.log).
- `git diff --check` : **PASS**.

Empreintes finales :

```text
d2f6a9cb380a15285759085cdf602701f0d9d785d4a7f76f2061438d38ab9ddc  migrations/20261015_social_authorization_history.sql
3919c69b6c4f92f45475dda7a85bc2a69aecbd6a9d88c72be190154752c40627  scripts/test-final-social-history.mjs
```

GitNexus avant édition : dépôt/worktree T01 exact, index `e09fdae` en retard de onze commits ; SQL et runner non indexés (`UNKNOWN`), CAS `updateSocialOAuthAccount` : LOW, quatre dépendants incluant callback et révocation. Recherche directe complémentaire : déclencheur partagé, migration/rollback, attestation de métadonnées, runner et CI. Risque de table partagée signalé avant correction. `detect-changes` effectué : treize fichiers, six symboles du WIP AGENTS, aucun flux identifié ; cela **ne certifie pas le SQL**, couvert ici par les vrais tests PostgreSQL et le diff limité. [Trace](social-history-legacy-gitnexus-detect.log).

**À transmettre à T06 via son miroir par T01 :** retester sa fixture `qa/t06-integrated-retest-20261015/run.mjs history` avec cette migration et son correctif CAS `updated_at`. Aucun fichier de son lot n'a été modifié. T01 doit recalculer candidat/CI et les reçus de restauration/apply dont l'empreinte dépend du SQL précédent. Le rollback SQL et le helper de transition sont inchangés ; aucune preuve distante antérieure n'est rebaptisée preuve de ce nouveau SQL. Production et OAuth réel **NON TESTÉS par cet auxiliaire**.

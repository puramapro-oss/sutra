# Post-deploiement SUTRA — securite cron/OAuth, 2026-10-13

Application deployee : `3e5596ea287f36427f687d3f3882d35c3f7c407b`. HEAD du worktree de preuves : `27a08a1330fd3ecc8b831ffd8ec41ccf9dc7c2da`. Les fichiers applicatifs sondes sont identiques au commit deploye (`git diff --exit-code 3e5596ea287f36427f687d3f3882d35c3f7c407b -- src/app/api/cron src/app/api/social/connect src/app/api/social/callback src/app/auth/callback src/lib/cron-auth.ts src/lib/social-oauth-state.ts src/lib/auth-navigation.ts src/lib/supabase-server.ts src/middleware.ts`, exit 0 avant toute correction).

## Resultat public

`python3 qa/postdeploy-20261013/security/probe.py` : **55 PASS / 3 FAIL**, 58 requetes HTTPS sans suivi de redirection.

- 42 PASS : les 21 methodes de 20 routes cron refusent absence et faux jeton par 401. `CRON_SECRET` est present et utilisable pour la verification du garde, sans lire sa valeur ni soumettre le bon jeton.
- 9 PASS : callbacks sociaux incomplets, plateforme invalide, session absente, ancien state user-id, state URL, repetition invalide et forwarded-host forgé. Redirections fixes sur `https://sutra.purama.dev/settings/social`, erreurs attendues.
- 4 PASS : connexion sociale sans session (body valide/invalide) 401 ; origine etrangere 403 ; GET non supporte 405.
- 3 FAIL : `/auth/callback`, avec `next` externe ou forwarded-host forgé, retourne 307 vers **`https://0.0.0.0:3000/login?error=missing_code`** au lieu de l'origine publique. Reproductible sans code OAuth ; source `src/app/auth/callback/route.ts` derive tous ses redirects de `new URL(request.url).origin`.

Sonde supplementaire (meme code inline conserve sous `origin-probe.py`) : **1 PASS / 1 FAIL**. `POST /api/social/connect` avec `Origin: https://sutra.purama.dev` et JSON retourne **403 Origine refusee**, alors que sans session il doit atteindre le garde auth et retourner 401. Avec origine etrangere, 403 attendu. Source `src/middleware.ts` compare l'Origin navigateur a `request.nextUrl.origin`, visiblement interne sous self-host OVH. Defaut de production reproductible, signale au chef avant toute correction.

Reexecution ciblee apres correction :

```sh
python3 qa/postdeploy-20261013/security/origin-probe.py
python3 qa/postdeploy-20261013/security/probe.py
```

Conserver les JSON initiaux comme preuve d'echec avant reexecution. Les chemins proteges modifies doivent etre revalides ; les PASS cron inchanges ne necessitent pas de repetition obligatoire.

## Frontiere et limites

Aucun secret consulte, aucune session, aucun vrai code/state OAuth ni jeton cron. Aucune API `/api/health`, aucun appel fournisseur payant, aucune mutation de base/compte, aucun deploy. L'inspection source confirme que chaque requete refusee retourne avant client service/claim worker/echange OAuth. Aucun packet capture fournisseur revendique. OAuth complet avec consentement distant et traitements cron authentifies non invoques. L'atomicite/replay state OAuth demeure prouvee par la CI inchangee ; ces sondes publiques ne revendiquent pas une preuve live de consommation avec session.

GitNexus : `node /Users/matissdornier/purama/.gitnexus/run.cjs query 'cron authentication OAuth callback state consumption' --repo sutra-t01-20261012 --limit 5` a guide la navigation ; index 4 commits derriere, aucune exhaustivite revendiquee. Aucun symbole produit modifie ni suite CI verte rejouee. Ecritures limitees au present repertoire de preuves.

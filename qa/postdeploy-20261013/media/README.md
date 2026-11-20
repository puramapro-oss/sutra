# SUTRA post-deploiement — medias, export et pipeline gratuit

Application deployee : `3e5596ea287f36427f687d3f3882d35c3f7c407b`.
Source inspectee : worktree T01, HEAD documentaire `27a08a1330fd3ecc8b831ffd8ec41ccf9dc7c2da`.
Auxiliaire de verification borne ; aucune reprise de propriete du terminal T05.

## Verification executee

```sh
node qa/postdeploy-20261013/media/free-runtime-probes.mjs
```

**30 assertions PASS, 0 FAIL, six GET HTTPS publics reels.** Resultat horodate : `public-media.json`.

Six cas sont rejetes avec HTTP 404 : base64 non canonique, segment `..`, segment vide, antislash, grant de publication forge et grant trop long. Pour chacun : `Cache-Control: private, no-store, max-age=0`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` et `Vary: Cookie` verifies. Aucun secret, compte, objet Storage, job, debit, publication ou appel fournisseur utilise.

La premiere tentative utilisait Node 26 `fetch` avec un chemin `%%%` et n'a obtenu aucune reponse HTTP (`NGHTTP2_PROTOCOL_ERROR`). Le probe a ensuite employe un chemin base64 non canonique mais valide comme URI (`YWJj=`) et HTTPS HTTP/1.1. Ces deux ajustements du harnais ne permettent pas d'attribuer la premiere erreur a l'application ; aucun code produit modifie. La preuve ne revendique pas une validation generale HTTP/2.

## Preuves fraiches conservees sans repetition

`qa/deployment-20261013/test-matrix-release.json` et `HANDOFF-SUTRA-T01-20261012.md` recensent la CI finale du meme code : 34 tests medias FFmpeg reels, 473 contrats PASS / 7 SKIP, 12 tests pipeline PostgreSQL, 254 assertions RLS, 1022 E2E PASS / 25 SKIP. Aucun de ces tests n'a ete relance ici. Ils ne remplacent pas une lecture de media prive ou un export authentifie sur la production.

## Controles prets mais non executes sans compte de recette dedie

Le module expose deux fonctions au coordinateur ; aucune ne charge ou n'enregistre de credentials. Il faut leur fournir le `APIRequestContext` Playwright deja authentifie du compte de recette. Ne jamais creer un utilisateur Auth global sans verifier les triggers : la coordination a identifie des effets hors SUTRA.

```js
const probes = await import('./qa/postdeploy-20261013/media/free-runtime-probes.mjs')
const report = await probes.authenticatedFreeChecks(context.request)
```

Ce premier controle attend :

- `POST /api/create {}` : 400 Zod avant profil, quota et job.
- `POST /api/production {}` : 400 Zod avant profil, quota et job.
- `POST /api/video/export {}` : 400 Zod avant profil, quota et job.
- `POST /api/subtitles/export` avec deux sous-titres synthetiques : 200, fichier `subtitles.srt`, contenu SRT exact.
- `POST /api/subtitles` avec narration synthetique, duree 5, style `classic`, **sans `targetLang`** : 200, segments bornes et SRT. Ce chemin est deterministe et sans fournisseur.

La lecture des trois handlers confirme les refus avant `submitVideoJob`. Ne pas utiliser `/api/auto/generate`, meme avec `{}` : ce handler charge la configuration existante puis peut lancer la generation. Ne pas utiliser un export video avec des scenes valides : `/api/video/export` lance Shotstack. Ne jamais appeler `/api/health`, `targetLang`, les routes voix/musique/generation/publication ou le thumbnail fournisseur dans cette recette gratuite.

Pour la preuve positive de media, le coordinateur peut autoriser et provisionner un objet **synthetique unique** dans `sutra-assets`, sous `owners/<UUID du compte de recette>/postdeploy/<nom unique>`. Conserver son empreinte et supprimer uniquement cette fixture creee par la recette apres verification. Ne toucher a aucun media existant.

```js
const mediaReport = await probes.ownedMediaChecks(context.request, {
  objectPath,
  sha256,
  byteLength,
  storageOrigin,
})
```

Ce controle lit la reference durable avec le proprietaire (307), suit la signature uniquement vers l'origine HTTPS Storage attendue, verifie SHA-256 et taille, teste `Range: bytes=0-15` (206), puis verifie le refus anonyme (401) et le refus d'un chemin d'un autre proprietaire (404). La signature temporaire n'est jamais incluse dans le rapport. Aucun upload ou suppression n'est execute par le module.

## Verdict borne

Aucun defaut produit reproductible constate dans ce lot. Protection publique des references medias : PASS live. Lecture media prive, generation locale de sous-titres et export SRT authentifies : PREPARES / NON EXECUTES faute de session de recette fournie. Pipeline payant et export video fournisseur : exclus par instruction utilisateur ; leur preuve conservee est la CI gratuite avec fixtures, pas une generation payante live.

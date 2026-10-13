# HANDOFF SUTRA T08 — QA intégrée — 2026-10-12

**RELEASE_CERTIFICATION = BLOQUE.** Branche `codex/sutra-t08-qa-integrated-20261012`, worktree `/Users/matissdornier/purama-worktrees/sutra-t08-qa-integrated-20261012`, base exacte `589732cb49959c1a576a3ba381b310cd594600ac` de `codex/sutra-t01-integration-20261012`. Livraison = commit contenant ce handoff ; SHA exact remis au coordinateur après push.

**43 exigences : 26 PASS, 5 FAIL, 5 BLOQUE, 7 NON TESTE**, avec frontières détaillées dans [MATRIX.md](qa/t08/integrated/MATRIX.md). Ces nombres portent sur les exigences, pas sur les assertions. Le seul nouvel échec dynamique produit est la double soumission export UI ; les autres FAIL désignent les fonctions historiques absentes et le build sans cache réseau. Aucune certification de production, DB distante ou fournisseur réel.

## Coordination et conservation

AGENTS/politique canonique lus, `POLICY_OK`, LOCKS racine et `.coord/LOCKS.md`, BATON/plan/brief/ERRORS, coordinations et handoffs SUTRA inspectés avant création. Réservation `SUTRA-T08-20261012:REPRISE-589732c` dans les deux LOCKS. T01 relu à son SHA exact et propre ; ancien T08 S5 `d3fcedf` conservé propre. Les 806 hashes du manifest T01 correspondent à la base. Contrôle final : seules la garde QA, son runner et la garde anti-preview diffèrent parmi ces 806 sources ; aucun fichier produit, script T01, migration, dépendance ou lockfile modifié.

Propriété respectée : T02 sécurité, T03 pipeline, T04 fournisseurs, T05 média, T06 publication, T07 UI et T01 tooling restent en lecture seule. Leurs reprises postérieures à 589732c ne sont pas intégrées par T08. Aucun reset/stash/clean/suppression de worktree, aucun arrêt de processus étranger ni copie de WIP. Dépendances et FFmpeg existants réutilisés en lecture ; aucun téléchargement/install. Garde anti-preview ajoutée uniquement pour cette branche dans `vercel.json`. Les workflows présents ne déploient pas cette branche.

Le dernier mandat autorise commit et push. Aucun déploiement, publication réelle, appel payant, migration (même locale), lecture de `.env*` ou de secret réel. Les identifiants/canaris sont synthétiques. Les mises à jour de coordination sont des fichiers locaux, aucune notification tierce envoyée.

## Delta livré

- `qa/t08/offline.cjs` : décodage par `fileURLToPath` avant contrôle des URLs de fichiers. Deux URLs `%2Eenv` contournaient la garde ; 2 régressions rouges avant correction, 12 tests VM verts après. Aucune I/O réelle durant cette preuve.
- `qa/t08/run.mjs` : profils redteam, browser-redteam, legacy-offline et build-offline avec environnement sur liste autorisée ; refus des arguments ignorés ; codes d'échec et sorties conservés. Les gates T01 restent importées, sans duplication de leur implémentation.
- `qa/t08/integrated/` : 14 tests garde/charge, six scénarios navigateur supplémentaires, réutilisation des vrais WOFF2 du cache via hook Next, matrice et preuves bornées.
- Ancien `qa/t08/playwright.config.ts` archivé sans modification en `.s5-source` : il référençait un test S5 retiré. README historique conservé en `README.s5-source.md`, nouveau README courant.
- Ce handoff, BATON, append au plan et garde anti-preview. Aucune correction produit masquée dans le lot QA.

## Exécutions et résultats

Node `24.21.0` depuis le cache existant `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node` ; macOS arm64, Next `16.3.8`, Chromium `145.0.7632.6`. `node` dans les commandes suivantes désigne cet exécutable.

| Commande | Résultat actuel |
| --- | --- |
| `node qa/t08/run.mjs redteam` | 14 PASS, 0 FAIL ; 12 garde + 2 charge |
| `node qa/t08/run.mjs contracts` | 427 PASS, 7 SKIP, 0 FAIL / 434 ; schedule/composition/publication PASS |
| `PATH="$PWD/test-results/media-bin:$PATH" node qa/t08/run.mjs media` | 33 PASS, 0 FAIL ; 3 moteur local + 30 composition/probe |
| `node qa/t08/run.mjs quality` | Typecheck PASS ; lint 0 erreur/111 avertissements hérités ; build FAIL car Google Fonts interdit hors cache |
| `T08_FONT_CACHE=/Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012/.next/static node qa/t08/run.mjs browser-redteam` | Build webpack 197 pages PASS ; 203 contrôles communs PASS, puis 5 PASS/1 FAIL T08 ; code final 1 conservé |
| Même variable, `node qa/t08/run.mjs legacy-offline` | 1 022 PASS, 25 SKIP, 0 FAIL, 0 flaky ; une exécution complète / 1 047 cas, 4 workers, 3 viewports |
| `python3 -m unittest discover -s deploy -p 'test_ovh.py'` | 9 PASS, aucun SSH/Docker |
| ESLint ciblé `qa/t08/run.mjs qa/t08/offline.cjs qa/t08/integrated` | 0 erreur/0 avertissement |

Le build navigateur remplace uniquement la récupération de police par des octets déjà présents, pas la police par une autre. Les trois hashes et leur cache source sont consignés. Ce build local ne remplace pas une preuve CI Linux propre. Première gate média : 6 FAIL avec FFmpeg Homebrew sans filtres subtitles/drawtext ; reprise avec le binaire complet de T01 : 33 PASS. Les échecs initiaux sont conservés, pas effacés. Aucun téléchargement fournisseur autorisé pour corriger ces gates.

Charge mémoire bornée : 8 workers, 32 séquences × 9 étapes, 288 opérations uniques après concurrence et reprise ; p95 séquence 13,41 ms, total 49,38 ms. Publication : 32 modèles de journaux, 64 destinations, 8 opérations actives maximum, 37,62 ms. Cela ne prouve ni SQL partagé, ni RLS, ni débit réseau/social. Les scripts de contrats et les scénarios navigateur sont des segments distincts, pas un parcours continu sur une vraie DB.

Navigateur : 156 audits axe sans violation, zéro erreur JS/hydratation capturée ; cinq largeurs de 320 à 1440px. Deux captures T08 affichées pour inspection. Dix observations locales : DCL 21–59 ms, aucune long task relevée ; aucun SLA/CWV de production revendiqué. Les titres/erreurs malveillants restent du texte, sans exécution du canari. Le refus 503, retry 202, conservation du payload et timeout rétablissent les contrôles.

## Défaut reproductible livré au propriétaire

**T08-I01 / P2 / T07**, `src/hooks/useEditorHandlers.ts:115` (`handleExport`). Deux `button.click()` synchrones dans le même `evaluate` donnent **2 POST `/api/video/export` au lieu de 1**, avant que React désactive le bouton. Source vidéo fixture valide, réponse 202 retardée de 250ms. Test : `same-frame duplicate export dispatches one request` dans `qa/t08/integrated/browser-extension.mjs`. Le rapport conserve l'assertion `2 !== 1` et le code 1.

Reproduction : commande `browser-redteam` ci-dessus. Preuve `qa/t08/integrated/evidence/browser-extra.json`. Aucune double dépense backend démontrée ; l'idempotence serveur est testée séparément. T07 détient le hook : aucune modification produit T08. Défaut remis pendant la recette dans `.coord/handoffs/SUTRA-20261012/T08-REPRISE-589732c.md` (racine PURAMA).

## Preuves réutilisées et blocages réels

- SQL local T01 : 13 contrôles migration, 9 concurrence multi-sessions, 49 RLS. Sources/migrations/tests inchangés vérifiés par hash. Résultats hérités, **aucune migration rejouée T08** ; aucune preuve du schéma distant.
- Audit dépendances T01 inchangé : 0 haute/critique, 5 modérées/2 faibles dans OpenTimestamps ; pas de nouvel audit advisory réseau. Actionlint/shellcheck T01 réutilisés sur fichiers inchangés.
- Legacy : 25 SKIP conservés (6 variantes auth, 6 escalades non implémentées, 13 répétitions viewport/API) ; détail nominatif dans `evidence/legacy.json`. Aucune reprise ni retry : 1 022 cas verts dans une exécution fraîche.
- Sept SKIP contrats : 4 INSEE réel, 2 DB distante, 1 OTS réseau. Scripts connect/storage-proofs requérant secrets et mutations réelles exclus. Aucun SKIP promu en PASS.
- Budget hybride, versions/restauration et logger/cron-runs S5 absents de PR3. Modifier le script éditeur ne régénère pas la voix. Parcours complet demandé non certifiable sur cette base.
- CI T01 [38289517548](https://github.com/puramapro-oss/sutra/actions/runs/38289517548) relue : trois jobs échouent dans setup avant tests ; `SMARANA_READ_TOKEN` manque selon diagnostic T01. Initialisation PostgreSQL réussie. Aucune valeur de credential consultée.
- Docker/Linux, runtime OVH, rollback réel, schéma distant, fournisseurs payants/social/auth/stockage réels non qualifiés. Aucun déploiement ni publication tentés.

GitNexus : impact préalable `checkPath` LOW (1 dépendant direct, 0 flux). Index T08 final 12 775 nœuds/24 830 relations/369 flux, **TRUNCATED** (930 candidats, 519 callees, 4 walks omis). `detect-changes --scope staged` archivé : 51 chemins/55 symboles, risque **medium**, deux flux GET → Music/Script associés à la propriété locale `asset` du test (voir `context-asset.txt`). Le contexte mélange des propriétaires sans lien avec cet objet local ; aucune édition produit ni import du test par le produit dans le diff. Les copies de rapports ajoutées ensuite sont inertes. Revue directe des chemins effectuée, aucune exhaustivité inférée du graphe.

Les preuves courantes sont sous `qa/t08/integrated/evidence/` et leurs sources détaillées sous `test-results/`. Les anciennes 25 PASS/21 FAIL S5 restent historiques, hors de tous ces compteurs. Le manifest courant relie les sources et rapports livrés. Prochaine action T01 : recevoir le delta QA, faire corriger T08-I01 par T07, intégrer ses SHA explicites et rejouer seulement les cas affectés ; maintenir la release bloquée jusqu'aux preuves manquantes.


## 2026-10-13 — T08 reprise fournisseurs (delta QA)

Base 48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4, branche codex/sutra-t08-provider-audit-20261013, worktree isole. Rapport : [qa/t08/providers-20261013/README.md](qa/t08/providers-20261013/README.md). Produit intact, verrous et WIP etrangers preserves.

- VERIFIED : 6 contre-tests hors reseau, 1 PASS et 5 FAIL conserves (quatre assertions de contrat Zernio, une erreur Suno 2xx reflechie au navigateur). Defauts remis aux proprietaires T04/T06/T02, aucune correction produit T08.
- VERIFIED : typegen, TypeScript et lint T08 exit 0, 111 avertissements herites. T01 480 contrats PASS/7 SKIP et schedule/composition/publication PASS reutilises, 752 fichiers sources/config identiques verifies par hash. Aucun build identique duplique.
- VERIFIED : preuves partagees T04 master normalise, Mac/OVH en lecture seule : RunPod 401, Shotstack 403 quatre combinaisons, Suno legacy public 503 sans auth, Zernio 200/zero compte. Aucun appel fournisseur ou SSH T08.
- BLOQUE : release, raccord OAuth/isolation profil, Suno erreur et contrat, acces fournisseurs. SSH T04 par alias existant reussi ; SSH avec seuls parametres master T01 refuse, distinction conservee. Aucun .env.local cree, aucun secret affiche, aucune generation/publication/deploy/migration/fusion.
- Livraison locale : nouvelles preuves/tests et append documentaire uniquement. Push en attente de garde anti-preview pour cette nouvelle branche : vercel.json reserve a T05 sur son propre delta ; aucune modification de ce fichier par T08. L'autorisation de push precedente ne permet pas de declencher un deploiement interdit.

Matrice du delta : 22 exigences, 8 PASS / 4 FAIL / 7 BLOQUE / 3 NON TESTE. Les preuves du 12 octobre restent historiques et ne sont pas rejouees. Prochaine action proprietaires : corriger les deux classes de defaut et rejouer uniquement redteam, qualifier les credentials et OAuth apres intervention humaine. SHA de livraison remis dans la coordination apres commit.

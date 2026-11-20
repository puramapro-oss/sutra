# T05 — sortie worker distant, media-probe et export — 14 octobre 2026

**Livraison de tests, validation média BLOQUÉE par T05-MEDIA-01.** 24 PASS, 1 FAIL réel, 0 SKIP/TODO. Produit intégralement en lecture seule. Aucun adaptateur parallèle.

- Branche : `codex/sutra-t05-salad-media-20261014`.
- Base exacte : `14617333bfb21efe1f2a1c91888d3322dde20f5b`, applicatif `e3b17117256269e281304cd4ab83bc722a6f7894`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t05-salad-media-20261014`.
- Mandat distinct Matiss 01h40 ; réservation exclusive `SUTRA-T05-20261014:SALAD-MEDIA` dans les deux LOCKS. Handoff coordinateur : `/Users/matissdornier/purama/.coord/handoffs/SUTRA-20261012/T05-SALAD-MEDIA-20261014.md` (SHA final après commit).
- Contexte actuel lu : `qa/ovh-final-providers-20261014/README.md` et coordination T01 Salad. Anciens refus RunPod/Shotstack/OAuth/Suno non repris : activation T01 du 14 octobre les a remplacés. Aucun de ces fournisseurs n’a été interrogé par T05.

## Défaut reproductible à corriger par T01 / propriétaire désigné

**T05-MEDIA-01 — une URL différente suffit à faire accepter une vidéo brute comme export sous-titré.**

1. Une source synthétique bleue sans texte, H.264 1280×720, 30 FPS, 0,4 s, est renvoyée octet pour octet sous une URL finale distincte.
2. Le brief exige un sous-titre (`requirements.subtitles = required`). Le reçu d’octets provient du vrai `verifyAndStoreRenderedVideo`, avec stockage simulé ; il n’est pas inventé.
3. `executeExportJob` utilise le vrai `validateRenderedMedia` : téléchargements simulés, probe et décodage FFmpeg réels, SHA-256 réels.
4. La validation déclare `burned-in` / `render-contract`, le SHA-256 source égale celui du final, et le callback de persistance est appelé une fois. L’export retourne avec succès. Aucun vrai statut DB n’est écrit dans ce test.
5. Le test attend un refus et reste **FAIL**. Trace JSON expurgée dans `tests.tap` : `persistCalls:1`, `finalEqualsSourceSha256:true`, `subtitlesClaim:burned-in`.

Points de revue : `src/lib/media-validation.ts` (`validateRenderedMedia`, `mediaValidation`) et `src/lib/pipeline-state.ts` (`assertFinalMedia`), puis le passage à la persistance dans `src/lib/export-pipeline.ts`. Les contrôles de vidéo brute comparent les URLs. Le sous-titrage est uniquement attesté par le contrat de rendu. Un reçu de probe d’octets ne prouve pas qu’une composition a été appliquée.

Correction proposée au propriétaire : refuser l’identité source/final quand le brief impose une transformation (ici sous-titres), vérifier la provenance du montage et lier le résultat au contrat et aux octets. Ne pas interdire sans distinction tous les montages sans modification ; ne pas assimiler une URL ou un SHA final valide à une preuve de sous-titres. Aucun correctif produit inclus ici.

Reproduction minimale, entièrement hors réseau :

```sh
node --import tsx --test --test-name-pattern='DEFECT T05-MEDIA-01' scripts/test-t05-salad-media.mts
```

## Couverture et niveaux de preuve

| Cas | Résultat sur la base | Preuve |
| --- | --- | --- |
| Worker `video_base64` / `video_url` de même origine | PASS | Vrais MP4 mesurés/décodés ; résultat source sans reçu `ready` |
| URL worker expirée 403 / 410 | PASS | Refus après deux requêtes simulées (soumission + lecture), aucun retour média |
| Dernier paquet corrompu avec en-tête encore lisible | PASS | Dimensions encore lisibles par ffprobe simple ; `verifyVideoBytes` et `probeMedia` refusent |
| Dimensions, orientation, FPS et pixels non carrés | PASS | Fixtures 360p, portrait, 16 FPS, SAR 2:1 refusées par le worker |
| Voix/musique obligatoires absentes | PASS | Zéro assemblage, zéro persistance |
| Audio facultatif absent | PASS | Export silencieux valide accepté après mesures fraîches |
| Audio final absent malgré reçu `hasAudio` falsifié | PASS | Validation finale réelle bloque la persistance |
| Piste audio présente mais décalée | PASS | Décalage mesuré 0,178667 s refusé |
| Résolution source/native/améliorée/demandée/finale | PASS | Mesures séparées 1280/640/3840/3840/3840 pixels de large |
| 4K upscalée vs origine native | PASS contrat seulement | Dimensions 4K seules → `4k-origin-unknown`; attestation explicite + mesure native → `native-4k-attested`; native basse résolution → `upscaled` |
| URL native déclarée mais expirée | PASS | Aucune provenance certifiée sans mesure |
| Reprise export corrompue/expirée | PASS | Relit le fichier, zéro nouveau rendu, zéro persistance |
| Échec assemblage / deux compositeurs en échec | PASS | Aucun succès brut, aucune écriture finale ; Shotstack exclusivement simulé |
| URL brute identique | PASS | Refus même avec reçu d’octets valide |
| Octets bruts sous URL distincte + sous-titres requis | **FAIL T05-MEDIA-01** | Persistance atteinte et déclaration `burned-in` incorrecte |

`measurements.json` contient dimensions, orientation, FPS moyen/nominal, codec, pixel format, SAR, bitrate vidéo/conteneur/audio, durée, nombre d’images, horloges A/V, streams sous-titres, SHA-256, taille et décodage complet. Neuf fixtures générées par `libx264` CPU et un MP4 corrompu dérivé : **92 257 octets** au total dans cet environnement. Les médias temporaires sont détruits après le test ; générateur et mesures restent versionnés. Aucun média utilisateur.

Les fixtures 3840×2160 sont synthétiques : **aucune génération native 4K par modèle n’est prouvée**. L’attestation native du test est une chaîne explicitement synthétique, utilisée pour vérifier le classement existant. Aucun OCR ou contrôle visuel de sous-titres réels n’est revendiqué.

## Commandes ciblées et résultats

```sh
T05_MEDIA_EVIDENCE=qa/t05-salad-media-20261014/measurements.json node --import tsx --test --test-reporter=tap scripts/test-t05-salad-media.mts
./node_modules/.bin/tsc --noEmit --project qa/t05-salad-media-20261014/tsconfig.json
./node_modules/.bin/eslint scripts/test-t05-salad-media.mts qa/t05-salad-media-20261014/fixtures.mts
gitleaks dir --no-banner --no-color --redact scripts/test-t05-salad-media.mts
gitleaks dir --no-banner --no-color --redact qa/t05-salad-media-20261014
```

- Tests : exit 1, **24 PASS / 1 FAIL / 0 SKIP**, `tests.tap`.
- TypeScript strict, uniquement le test et ses imports transitifs : exit 0, `typecheck.log`.
- ESLint des deux nouveaux fichiers exécutables : exit 0, `lint.log`.
- Gitleaks expurgé ciblé : exit 0, aucun secret détecté, `secrets-test.log` / `secrets-proof.log`.
- Versions et mesures : `measurements.json`. Dépendances réutilisées par lien vers le worktree T01 existant, lockfiles SHA-256 identiques ; aucune installation ni modification des dépendances.
- Fraîcheur : `verification.json` enregistre la base, les empreintes des sources de test et du lockfile, les commandes et leurs codes de sortie. Le SHA de livraison est enregistré dans le handoff partagé après commit.
- Premiers essais conservés : `harness-first.log` (initialisation synthétique avant imports corrigée), `typecheck-first.log` (type de transition corrigé), `tests-first.tap` (même défaut avant ajout du diagnostic). Aucun ancien PASS global rejoué.
- GitNexus : index propre au worktree, analyse des points d’entrée avant ajout, `detect_changes` avant commit ; résumé et limites dans `gitnexus-impact.json`, sortie dans `gitnexus-detect.log`. Les nouveaux tests n’éditent aucun symbole produit.

## Limites et suite coordinateur

L’adaptateur Salad T04 est en construction dans un autre worktree ; aucun fichier `src/lib/salad/**` n’existe sur la base testée. Ces assertions utilisent le contrat **réel existant** `generateLocalVideo` (`video_base64` ou `video_url` exclusifs) et les vraies portes de validation média/export. Elles ne réimplémentent pas un contrat Salad présumé. T04 annonce une enveloppe asynchrone autour de ce contrat ; T01 devra rejouer ces seuls tests après intégration du delta T04 et traiter toute évolution d’interface. Aucun test du worker Salad effectivement déployé, de son authentification, de sa disponibilité, de son GPU ou de son modèle.

Le runner existant `scripts/run-ci.mjs` utilise une liste explicite : ce nouveau test autonome n’y est pas ajouté, conformément au périmètre T05. T01 décidera de son raccordement à la gate après traitement du défaut ; la commande ci-dessus est directement exécutable.

T01 conserve config/OVH/Zernio/intégration. Produit, anciens tests, BATON/plan, secrets, WIP et autres branches préservés. Pas de build/gate globale, réseau fournisseur, rendu Shotstack, génération, GPU Mac, DB distante, publication, push, fusion ou déploiement. L’unique blocage produit démontré dans ce lot est T05-MEDIA-01 ; l’intégration du nouveau worker demeure non prouvée tant que le delta T04 n’est pas livré.

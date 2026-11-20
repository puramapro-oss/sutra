# SUTRA T05 — complément fournisseurs du 2026-10-13

**SHOTSTACK_LOCAL_PASS / PROVIDER_AUTH_AND_OAUTH_BLOCKED**. Branche `codex/sutra-t05-provider-contract-20261013`, base d'intégration `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`. Le commit contenant cette section est la livraison du delta ; SHA et push confirmés dans `.coord/handoffs/SUTRA-20261012/T05-PROVIDER-COORDINATION-20261013.md` à la racine PURAMA.

Correctif : `src/lib/shotstack.ts` utilise la clé propre à stage/production avant toute résolution média ; `scripts/test-shotstack-contracts.mts` couvre sept nouveaux cas sans réseau. `vercel.json` désactive uniquement l'auto-preview de cette nouvelle branche. Aucun autre fournisseur, OAuth, configuration de secrets ou WIP étranger modifié. Docs locales : BATON/plan, ce handoff et `qa/t05/providers-20261013/`.

Preuves T05 : régression rouge puis 89 tests ciblés PASS ; gate complète 488 PASS/7 SKIP/0 FAIL ; schedule/composition/publication PASS ; TypeScript PASS ; lint 0 erreur/111 avertissements existants ; build hors réseau197 pages PASS. Source/config/dépendances et preuves hachées dans le manifest. Contrats purement simulés ; pas de rendu Shotstack réel ni génération native 4K revendiquée. Tests FFmpeg synthétiques historiques inchangés non rejoués.

Preuves propriétaires réutilisées : T04 master/Mac/OVH RunPod401, Shotstack403 pour les deux clés/environnements, Suno503 sans envoi de clé et contrat non qualifié, Zernio200/0 compte. Six variables du maître portent un suffixe littéral `\n` ; suppression diagnostique en mémoire sans lever les refus, aucun fichier de secrets modifié. T08 conserve5 FAIL/1 PASS sur les contrats OAuth/Suno actuels. T06 documente scopes, state, profil/organisation, tokens, révocation et consentements. Ce ne sont pas des sondes T05 ni une certification globale.

Blocages internes transmis : diagnostic `src/lib/env.ts` à aligner sur la clé Shotstack d'environnement par T01/T04 ; raccord Zernio/API/callback/profil et fuite d'erreur Suno à corriger par leurs propriétaires ; rotation/révocation et origine callback non qualifiées. Actions utilisateur : clés RunPod/Shotstack et accès/contrat Suno ; consentements sociaux uniquement après correction OAuth. Aucun déploiement, fusion, migration, compte connecté, publication ou appel payant.

Rapport détaillé et liens officiels : [audit fournisseurs](qa/t05/providers-20261013/README.md). L'historique ci-dessous reste conservé ; ses blocages d'intégration/polices/OVH du 12 octobre sont historiques et ne décrivent pas l'état courant.

# Archive — SUTRA T05 média et export — reprise du 2026-10-12

Statut : **DELTA_T05_LOCAL_VERIFIE_SUR_INTEGRATION_589732c**. Aucun déploiement ni appel payant. Ce handoff remplace le compte rendu S5 de cette branche ; l'ancien travail reste conservé dans son worktree et son historique.

- Base demandée, vérifiée avant travail : `codex/sutra-t01-integration-20261012` à `589732cb49959c1a576a3ba381b310cd594600ac`.
- Branche livrée : `codex/sutra-t05-media-export-final-20261012`.
- Code et tests : `834e30edefafd224461616e9854ded42e857f3d4` ; commit de preuves = commit contenant ce handoff.
- Worktree isolé : `/Users/matissdornier/purama-worktrees/sutra-t05-media-export-final-20261012`.
- Pointeur coordinateur et SHA final après push : `/Users/matissdornier/purama/.coord/handoffs/SUTRA-20261012/T05-POINTEUR.md`.

## Ownership et reprise

AGENTS, politique canonique, BATON/plan/brief/ERRORS et deux LOCKS lus ; contrôle de démarrage `POLICY_OK`. Réservation `SUTRA-T05-20261012:REPRISE-589732c` dans les deux LOCKS. Base T01 propre et ancien T05 propre préservés. Aucun reset, stash, clean, remplacement de worktree ou reprise du WIP étranger. Dépendances T01 utilisées en lecture seule ; aucune installation.

Le lot T05 initial est déjà réconcilié par T01 : aucune deuxième implémentation. `media-probe.ts` canonique et le downloader/stockage T02 restent inchangés. Aucun changement dans les adaptateurs T04, workers/checkpoints T03, UI T07, package/lockfile ou CI T01. Seule exception de configuration : désactivation de l'auto-preview Vercel pour cette branche exacte, conformément au mandat de push sans déploiement.

## Delta livré et fichiers

| Fichier | Changement |
| --- | --- |
| `src/lib/media-validation.ts` | `validateRenderedBuffer` mesure désormais les sources, le natif/amélioré déclarés et les entrées voix/musique avant de délivrer une preuve. `mediaValidation` refuse les listes incomplètes et les provenances déclarées absentes ou sans image décodable. |
| `src/lib/video-compositor.ts` | Avant upload local, compare la taille et le SHA-256 de la preuve avec le buffer réellement livré. Une preuve périmée est une erreur de validation, sans bascule payante. |
| `src/lib/media-validation.test.ts` | Régression réelle FFmpeg : buffer sans mesures, source/native/amélioré, provenance audio-only, voix/musique sans audio. |
| `src/lib/video-compositor.test.mts` | Contrats simulés : preuve périmée taille/hash, échec des deux moteurs, URL brute retournée par le secours. |
| `scripts/helpers/media-validation-fixture.ts` | Métadonnées simulées complètes pour les tests injectés ; jamais présentées comme preuve runtime. |
| `vercel.json` | `deploymentEnabled["codex/sutra-t05-media-export-final-20261012"] = false`. Les workflows présents ne déclenchent aucun déploiement sur cette branche. |

Documentation et preuves : ce handoff, ajouts T05 à `BATON.md`/`task_plan.md`, `docs/t05-final-evidence/` (journaux, manifest et script de replay du build local).

Régressions observées avant correction : test de preuve périmée en échec `Missing expected rejection` ; test de validation du buffer en échec `0 !== 1` sur le nombre de sources. Après correction : ciblé **6/6 PASS**, puis gates finales ci-dessous. Le changement de comportement est volontaire : une source ou provenance déclarée devenue inaccessible/invalide bloque la validation ; aucune mesure ni provenance n'est inventée.

## Contrat média conservé et requalifié

- Exigences `optional|required|disabled` pour voix, musique, sous-titres, intro, outro et logo, issues du brief. Une entrée fournie invalide n'est pas supprimée silencieusement. Voix positionnée après l'intro et limitée au corps ; musique courte bouclée ; intro/outro/logo et fenêtres des sous-titres conservés.
- Montage FFmpeg prioritaire ; secours Shotstack uniquement sur panne moteur admissible. Échec de validation, d'upload ou annulation : erreur propagée. Si les deux moteurs échouent ou si l'URL retournée est un clip source : aucun fallback vers la vidéo brute.
- Mesures distinctes : source de composition, fichier natif et amélioré si déclarés, dimensions/durée/FPS demandés et fichier final. Les références native/améliorée non fournies restent `null`.
- Contrôles finaux : dimensions, orientation/rotation, 30 FPS moyen et nominal, H.264/yuv420p, bitrate positif mesuré, durées container/vidéo, nombre d'images, décodage intégral A/V, audio AAC mono/stéréo 44,1/48 kHz, synchronisation, SAR 1:1, corruption et absence de piste externe de sous-titres inattendue. Tolérances existantes : vidéo 0,1 s, container 0,12 s, ±1 image, début audio 0,08 s, fin audio 0,12 s.
- Preuve 4K synthétique : source **320×180**, native **160×90**, améliorée **320×180**, demandé/final **3840×2160** => `upscaled`. Source/native **3840×2160** avec attestation synthétique => `native-4k-attested` ; sans attestation => `4k-origin-unknown`. Un preset ou un upscale 4K ne démontre jamais une génération IA native 4K.
- Les tests FFmpeg lisent réellement les pixels du logo et des fenêtres de sous-titres ainsi que l'onde audio/silence/boucle musicale. La preuve runtime des sous-titres reste `verification: render-contract` : ni OCR d'un rendu arbitraire, ni contrôle sémantique de la voix ou lip-sync. Les attestations de génération réelle restent à fournir par T04.

## Tests gratuits et preuves

[Manifest](docs/t05-final-evidence/manifest.json) : SHA exact du code, 26 fichiers d'entrée hachés depuis `git show`, journaux hachés. Environnement : Node **24.21.0**, Next **16.3.8**, FFmpeg **6.0** avec libass, ffprobe **9.0.2**. Médias lavfi/ondes/formes synthétiques et HTTP loopback seulement ; réseau distant et lectures `.env` bloqués par la garde existante. Identifiants de tests fictifs, aucun secret lu.

| Commande / gate | Résultat frais sur le code livré |
| --- | --- |
| `node scripts/run-ci.mjs contracts` | **429 PASS, 7 SKIP, 0 FAIL** ; schedule/composition/publication PASS supplémentaires. |
| `node scripts/run-ci.mjs media` | **34 PASS, 0 SKIP, 0 FAIL** (3 local-engine + 31 compositor/formats/validation). |
| `node scripts/run-ci.mjs quality` — typecheck | **PASS**, `--noEmit --incremental false`. |
| Même gate — lint | **PASS**, 0 erreur / 111 avertissements hérités. |
| Même gate — build initial | **FAIL environnement** : Google Fonts Space Grotesk bloqué par la garde réseau `T08_NETWORK_DENIED`. Journal conservé. |
| Replay du seul build avec les polices locales T01 | **PASS, 197/197 pages** ; même code, garde réseau maintenue, réponse du chargeur de police injectée avec les vrais fichiers WOFF2 T01, hashes enregistrés. |
| `git diff --check`, contrôle des chemins réservés | **PASS** ; package/lockfile, probe canonique, Shotstack et export-pipeline inchangés depuis la base. |

Les 7 SKIP concernent INSEE live (4), DB distante (2) et OpenTimestamps réseau (1). Ils ne sont pas comptés PASS. Contrats Shotstack/storage injectés = **SIMULÉS**, pas une preuve fournisseur. Les suites UI/SQL/déploiement hors scope dont le code n'a pas changé restent les preuves historiques T01 au SHA de base ; elles ne sont pas présentées comme rejouées ici. Aucun test payant.

Reproduction (binaires déjà présents, aucune réinstallation) :

```sh
T05_TMP=$(mktemp -d -t sutra-t05-final-gates)
export TMPDIR="$T05_TMP"
export PATH="/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin:/Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012/test-results/media-bin:$PATH"
node scripts/run-ci.mjs contracts
node scripts/run-ci.mjs media
node scripts/run-ci.mjs quality
# Si le chargement distant de Space Grotesk est bloqué : rejouer seulement le build.
python3 docs/t05-final-evidence/build_with_local_fonts.py \
  /Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012 \
  /Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node
```

Le replay des polices certifie la compilation locale du delta, pas la disponibilité réseau Google Fonts ni un build CI vierge. Il lit le build T01 sans le modifier. Le problème de reproductibilité hors cache est transmis au propriétaire T01, sans modification de son runner ou de la police UI.

## Impact et limites réelles

Skill GitNexus appliqué avant modification. Impact upstream : `mediaValidation` **HIGH**, 13 affectés/4 directs ; `composeVideoWithFallback` **CRITICAL**, 14 affectés/1 direct, via final-composition et les pipelines create/production/export/auto/worker ; `validateRenderedBuffer` LOW, 7 affectés/1 direct ; fixture LOW. Risques annoncés avant édition. `detect-changes --scope staged` avant commit : **6 fichiers, 18 symboles, risque low, 0 flow retourné**. Ce résultat n'annule pas l'impact upstream : graphe **PARTIEL**, 929 entrées et 519 callees écartés, 4 parcours coupés. Inventaire exhaustif assuré par Git, pas par le graphe.

**Aucun blocage local T05 restant.** Restent externes : intégration par T01 de ce delta avec les reprises des autres terminaux ; CI vierge/reproductibilité des polices ; rendu Shotstack réel et génération native 4K réelle non testés ; runtime Linux/OVH, stockage réel et schéma distant non qualifiés. Le dernier handoff T01 signale également `SMARANA_READ_TOKEN` absent sur sa CI : constat T01 hérité, pas une nouvelle preuve distante T05. La branche T05 n'est pas déclenchée par le workflow web actuel ; aucun workflow manuel lancé.

Pour le coordinateur : reprendre uniquement les six fichiers du commit code et les preuves T05 ; les raccords T01/T03 existants restent canoniques. Pas de migration, secret, appel fournisseur, push sur main ou déploiement demandé. Commit et push de cette seule branche autorisés par le dernier mandat ; confirmation finale et SHA distant dans le pointeur de coordination.

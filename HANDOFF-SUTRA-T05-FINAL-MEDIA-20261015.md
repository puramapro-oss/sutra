# T05 — FINAL MEDIA / EXPORT — livraison locale 2026-10-15

**PASS LOCAL : 34 tests distincts,0 FAIL final,0 SKIP ; TypeScript/lint ciblés et scan secrets PASS.** 17 vrais exports MP4 CPU, 3 formats ×3résolutions avec deux scènes, plus8variantes1080p. REAL-EXPORT2da10b34 intégré vérifié (72fichiers commités +8logs locaux identiques,11producteurs identiques avant delta).

Branche : `codex/sutra-t05-final-media-20261015`.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t05-final-media-20261015`.
Base T01 : `49c166d4c15412d2a3c1246c216cf0df319f2df0` ; candidat produit3855665. SHA de livraison : communiqué dans le miroir de coordination après commit, sans auto-référence de commit.

## Correction bornée

Trois fichiers produit : `src/lib/ffmpeg-concurrency.ts`, `src/lib/ffmpeg-compositor.ts`, `src/lib/ffmpeg-encoder.ts`.
Cinq défauts RED→GREEN : slot de concurrence volé à un waiter (2actifs/maximum1), configuration fractionnaire donnant0slots, attente sans timeout total, téléchargement hors deadline, découverte encodeur hors deadline. Réservation atomique du slot, attente annulable, minimum1, deadline globale et arrêt du sous-processus de découverte borné. Une deadline expirée est classée annulation : aucun secours payant déclenché après épuisement du budget.

Autres fichiers : nouveau `scripts/test-t05-final-media.mts`, `qa/t05-final-media-20261015/**`, ce handoff et ajouts BATON/task_plan/ERRORS. Aucun orchestrateur T03, adaptateur fournisseur, fichier T01 ou WIP tiers modifié.

## Preuves et commandes

Détail : `qa/t05-final-media-20261015/README.md`, `verification.json`, `measurements.csv`, JSON et logs horodatés,17MP4,3images affichées, manifestes SHA-256.

```sh
node qa/t05-final-media-20261015/run-targeted.mjs resources
node qa/t05-final-media-20261015/run-targeted.mjs media
node qa/t05-final-media-20261015/run-targeted.mjs regression
node qa/t05-final-media-20261015/run-targeted.mjs limits
node qa/t05-final-media-20261015/run-targeted.mjs variants
node qa/t05-final-media-20261015/run-targeted.mjs failures typecheck lint
```

Groupes finaux :7+11+2+2+8+4=34PASS. Tests réseau fermé, données synthétiques, pas de secret. Commandes exécutées par groupes pour éviter de rejouer des PASS inchangés ; erreurs intermédiaires du harnais conservées et corrigées. Aucune gate globale/build identique relancé.

Mesures finales : 16:9=1280×720/1920×1080/3840×2160 ;9:16=720×1280/1080×1920/2160×3840 ;1:1=720×720/1080×1080/2160×2160. Neuf multi-scènes :1,6s,48images,30FPS,H.264/yuv420p,SAR1:1,rotation0,AAC ; décodage intégral et décalage audio-vidéo0s. Source native160×90 → améliorée320×180 → dimensions finales : **upscale**, pas génération native4K. Sous-titres SUTRA affichés/lisibles dans trois orientations ; timings/logo/scènes testés par pixels et pistes par fréquences PCM.

Refus vérifiés : assets requis absents, audio obligatoire absent du vrai fichier, invalide/corrompu/tronqué, URL expirée, MIME faux, durée finale incorrecte, échec des deux moteurs et URL brute retournée par un secours simulé. Aucun upload/résultat final dans ces refus. La transition persistée vers ready appartient à T03.

## Limites et suite T01

FAIL historiques : les5défauts ci-dessus corrigés. Aucun FAIL final T05 connu dans les tests exécutés.
BLOQUÉ : acceptation/intégration du nouveau SHA et recette candidate T01/T08 ; aucun blocage externe pour clôturer ce travail local.
NON TESTÉ : fournisseurs live, OVH/Linux, génération IA native4K, charge/OOM et quotas RAM production, textes longs/multilingues. RSS max observé2 903 638 016octets (~2,70Gio) pour le groupe4K/multi ; aucune limite dure RAM/CPU trouvée dans les trois définitions deploy consultées, transmettre à T01 pour qualification runtime. Checkpoints de reprise conservés après échec par contrat et supprimés après succès ; politique de rétention des jobs abandonnés hors preuve. Zéro répertoire temporaire média restant ; caches Node/tsx conservés exclus de Git.

GitNexus impacts LOW/compose UNKNOWN alias revu ; delta final MEDIUM,2flux attendus. Comparaison main historique CRITICAL et liste toujours plafonnée malgré limite10000 : pas de certification globale. Revue directe du diff borné.

T01 : intégrer uniquement ce commit après réception, préserver les deltas des autres owners, décider des limites runtime ; recette ciblée T08 sur candidat consolidé. Aucun merge/push/déploiement autonome, publication, secret, appel fournisseur payant ou GPU/IA Mac effectué. Pas de garantie « zéro bug ».

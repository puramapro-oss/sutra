# T05 → T01 — intégration FINAL-MEDIA et retest ciblé

**FIN_ECRITURE — PASS LOCAL INTÉGRÉ. Aucun nouveau défaut produit, aucune correction produit nécessaire.**

Branche locale : `codex/sutra-t05-integrated-retest-20261015`. Base documentaire : `56754679abed9aa1e51323c29aed5bef38bc17d0`. Produit testé : candidat `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`. Le SHA de livraison est celui du commit contenant ce handoff ; il est recopié dans le miroir de coordination après commit.

- **82/82 fichiers** du lot T05-FINAL-MEDIA `44cbbab40e20f65d0506c18af253218055884c46` strictement identiques au candidat. Les3journaux partagés sont exclus explicitement des85fichiers du commit auteur.
- **5 PASS / 0 FAIL / 0 SKIP** frais : trois montages réels CPU4K complets et onze scénarios négatifs répartis dans deux tests. TypeScript et lint ciblés PASS.
- Mesuré :16:9 **3840×2160**,9:16 **2160×3840**,1:1 **2160×2160** ;1,6s,30FPS,48images,H.264/AAC48kHz stéréo,SAR1:1,rotation0,décodage intégral PASS,écart début/fin audio-vidéo0ms. Bitrates conteneur301180/289045/255855bit/s.
- Composition réelle : deux scènes, voix+musique, sous-titres, logo, intro/outro obligatoires. Pixels et PCM vérifiés, trois images affichées, sous-titre court lisible. Pas de retour brut après échec, zéro upload lors des erreurs.
- Provenance : native160×90 → source/améliorée320×180 → dimensions finales mesurées, **upscale**, aucune génération native4K. Preset carré4K =2160×2160.
- CI exacte T01 réutilisée : FINAL-MEDIA32PASS et REAL-EXPORT49PASS, autres groupes détaillés dans `ci-reused.json`. Les variantes seules/optionnelles,720p/1080p, MIME/durée/audio manquant et limites sont déjà testées après intégration. Aucun total additionné entre suites qui se recouvrent.
- **37 exports historiques préservés,0rejoué** dans cette reprise. Trois nouvelles sorties seulement. Réseau fournisseur fermé, CPU uniquement, aucun secret.

Commande exécutée : `node qa/t05-integrated-retest-20261015/run.mjs media typecheck lint`.

Fichiers livrés : nouveau dossier `qa/t05-integrated-retest-20261015/` (tests, logs, manifestes, trois MP4, trois PNG, mesures JSON/CSV, résultats GitNexus), ce handoff et append BATON/task_plan. Aucun code produit, orchestrateur T03, config ou preuve historique modifié.

Mesure ressources :13,61s réelles,RSS max2903703552octets,zéro swap ; temporaires média nettoyés, caches propres conservés/ignorés. GitNexus delta QA LOW ; processus du graphe tronqués et comparaison historique main CRITICAL/plafonnée, aucune certification exhaustive revendiquée. Détails dans [rapport](qa/t05-integrated-retest-20261015/README.md).

**FAIL nouveau : aucun. BLOQUÉ T05 : aucun. NON TESTÉ** : fournisseur, upload distant, production/OVH, charge/OOM et plafond RAM dur, synchronisation labiale humaine, textes longs, génération IA native4K. Recette globale et promotion réservées à T01/T08. Ce lot local ne vaut pas autorisation de déploiement. Aucun push/fusion/déploiement/publication.

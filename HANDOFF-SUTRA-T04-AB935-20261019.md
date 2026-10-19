# T04 → T01 / T08 — fournisseurs sur ab935

Base auditée : **ab935e59ca4e39776630f05b2ba6c0422c74ec62**. Branche de livraison : **codex/sutra-t04-ack-ab935-20261019**. Le SHA de livraison est celui du commit contenant ce document ; il est également recopié après commit dans le handoff commun `.coord/handoffs/SUTRA-20261012/T04-ACK-AB935-20261019.md` du dépôt PURAMA.

**ACK T4 : BLOQUÉ sur ab935 pour validation fournisseurs complète ; delta local PASS, prêt pour revue T01.** Pas d'ACK inconditionnel, de fusion, push ou déploiement. Le SHA d'intégration suivant devra être confirmé par T01. Aucune compatibilité GPU/WanGP ou génération réelle inventée.

Produit modifié exclusivement : **`src/lib/stock.ts`**. Préservation des adaptateurs existants, du worker Salad, de Shotstack, de la pipeline et du connecteur WanGP. Les fichiers de preuve/sources des harnais sont exclusivement `qa/t04-ack-ab935-20261019/**` ; les autres modifications sont ce handoff et les appendices T04 de `BATON.md` / `task_plan.md`. Le manifeste de fichiers exacts est dans `qa/t04-ack-ab935-20261019/files.json`.

Défauts reproduits puis corrigés : erreurs HTTP/transport et schémas invalides masqués en liste vide ; échec d'une source masqué par les autres ; URL média dangereuse acceptée ; transport sans échéance/corps borné ; Coverr sans auth/urls, preview susceptible d'être étiqueté HD. Réutilisation du lecteur de corps existant, schémas stricts des champs utilisés, délais 15 s/2 MiB, erreurs expurgées et aucun retry/fallback. Une source configurée en panne rend maintenant la recherche indisponible explicitement ; choix intentionnel, pas de succès partiel dissimulé.

Tests nouveaux : **17 contrats adapter PASS + 3 route/appelant PASS**, zéro génération. Reproduction avant : **8 FAIL / 2 PASS**. TypeScript ciblé, lint ciblé et syntaxe Python PASS. CI **38827288351** du SHA exact réutilisée après contrôle de **1070 blobs inchangés** : contrats **1209 PASS / 0 FAIL / 7 SKIP**, autres familles consignées sans addition des compteurs. Pas de nouveau build global. Impacts GitNexus avant édition LOW pour searchStock/1 appelant ; ancien helper partagé MEDIUM ; graphe partiel, non exhaustif. Analyses staged/compare et scan de secrets conservés dans le dossier QA.

Lectures gratuites expurgées du 19 octobre : **RunPod health200**, **Shotstack stage templates200**, **Shotstack v1 templates200**, **SunoAPI credit200**, **Unsplash catalogue200**. **ElevenLabs401 `invalid_api_key`** avec le véritable adaptateur/en-tête/URL : refus du fournisseur. **Salad et Pexels : configuration locale malformée, zéro HTTP** ; aucune preuve que leurs comptes refusent une clé correcte. **Pixabay/Coverr : clés absentes**. LTX auth/crédits/génération NON TESTÉS. Six GET, zéro retry, zéro mutation distante, zéro secret affiché/copied, aucun `.env.local` créé. Source privée uniquement `~/.env.purama.master`.

Variables à action propriétaire, noms uniquement : `SALAD_API_KEY`, `SALAD_ORGANIZATION_NAME`, `SALAD_PROJECT_NAME`, `PEXELS_API_KEY`, `ELEVENLABS_API_KEY` ; facultatives `PIXABAY_API_KEY`, `COVERR_API_KEY`. Activation Salad et protocole minimal d'essai GPU à autoriser : [matrice et preuves](qa/t04-ack-ab935-20261019/README.md). Aucun modèle/GPU lancé ni poids téléchargé ; recette d'image existante préparée mais non construite/qualifiée.

Transferts propriétaires :

- **T01** : registre `src/lib/env.ts:117` annonce encore Coverr sans clé ; le contrat officiel exige une clé. Reproduction statique exacte et sources dans la matrice ; aucun edit concurrent de config.
- **T01/T03** : preview Pollinations ancien (`storyboard.ts:47` / thumbnail production) non qualifié par les docs actuelles. Ne pas migrer implicitement vers une génération authentifiée payante. Ancien endpoint non appelé, disponibilité NON TESTÉE.
- **T01/T07** : attribution et notification du téléchargement Unsplash dans le consommateur à vérifier ; l'adaptateur conserve les URLs/ixid mais ne déclenche pas un téléchargement.
- **T08** : matrice distingue PASS contrats, PASS lecture, BLOQUÉ configuration/compte et NON TESTÉ GPU/génération. Les échecs de reproduction sur ab935 restent des FAIL historiques, pas des tests verts réécrits. Aucun « zéro bug garanti ».

LTX V2 intégré : jobs/poll/reprise/coûts, T2V/I2V première/dernière image, retake/extend/HDR/reframe ; aucun webhook, annulation distante ou références arbitraires prétendus. RunPod cancellation API documentée mais pas de helper distant dans l'adaptateur ; abort local n'arrête pas nécessairement la dépense. Montants réels inconnus restent `null/not_reported`.

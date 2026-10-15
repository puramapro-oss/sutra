# T08 — recette indépendante, 15 octobre

**NON PRÊT aux essais réels.** Référence testée : `3855665fa79e3cc2171124d864a834214d6ac617`. T01 confirme que `49c166d4c15412d2a3c1246c216cf0df319f2df0` ajoute seulement des preuves, puis annonce dans son handoff du15oct de nouvelles corrections en cours. Aucun nouveau SHA intégré final n'est fourni à la clôture de cette recette. Aucun ACK de promotion.

La [matrice](MATRIX.md) contient **45 PASS, 12 FAIL, 2 BLOQUÉS, 13 NON TESTÉS** sur72 exigences. Les PASS sont limités aux scénarios nommés ; un scénario simulé ne qualifie jamais un fournisseur, GPU, consentement ou post réel. Aucune promesse de zéro bug.

## Exécution indépendante

Worktree `sutra-t08-final-candidate-20261015`, branche `codex/sutra-t08-final-candidate-20261015`, base exacte3855665. Aucun fichier produit ou test auteur modifié. Dépendances existantes réutilisées après égalité du lockfile ; aucun build/CI global relancé.

Commandes de reproduction ci-dessous ; argv réellement exécutés, Node24 et flags complets dans les reçus JSON :

| Commande | Résultat | Limite |
|---|---|---|
| `python3 qa/t08-final-candidate-20261015/run.py production-error durable social-authority modes journey` |59 PASS/0FAIL/0SKIP |Session, persistance et services externes synthétiques ; suites propriétaires originales réutilisées|
| `python3 qa/t08-final-candidate-20261015/run.py cancellation` |3 PASS/**1FAIL**/0SKIP, exit1|Nouveau défaut T08-CANCEL-01 conservé rouge|
| `python3 qa/t08-final-candidate-20261015/verify_provenance.py` |99 contrôles PASS|Reçus CI locaux et hashes, aucun nouvel appel GitHub/fournisseur|
| `node node_modules/typescript/bin/tsc --noEmit -p qa/t08-final-candidate-20261015/tsconfig.json` |PASS|Nouveau scénario et imports concernés|
| `node node_modules/eslint/bin/eslint.js qa/t08-final-candidate-20261015/cancellation.test.mts` |PASS|Nouveau scénario seulement|
| Analyse AST des nouveaux scripts Python |PASS|Aucun build applicatif|

Les cinq premières phases ont été exécutées en série, parcours complet en dernier. L'annulation a ensuite couvert un risque distinct non couvert par ce parcours ; aucune suite verte inchangée n'a été rejouée. `run.py` retourne bien1 pour ce rouge et ne l'ignore pas. Le parcours J01 relie routes, file, worker, checkpoints, montage, validation, export et journal social ; ses fournisseurs et mesures médias restent simulés. J02/J11 couvrent12 requêtes concurrentes isolées, pas une charge distante.

Le processus enfant utilise une allowlist d'environnement, uniquement des valeurs fictives et le garde réseau/lecture.env `qa/t08/offline.cjs`. Aucun secret nécessaire, lu, affiché ou copié. Aucun achat, calcul IA/GPU Mac, publication publique, migration, déploiement, push ou fusion.

## Réutilisation des preuves exactes

CI T01 [38598361267](https://github.com/puramapro-oss/sutra/actions/runs/38598361267), SHA3855665, trois jobs SUCCESS. `provenance.json` vérifie43 fichiers d'artefacts, les reçus, les entrées applicatives et37 MP4 conservés. La comparaison avec le worktree T01 est un snapshot antérieur à ses nouveaux WIP ; elle ne qualifie pas ceux-ci. Les familles se recouvrent : ne pas additionner leurs compteurs aux tests T08.

- Contrats870 PASS/7SKIP ; sept dépendances externes ignorées explicitement, jamais comptées PASS. Médias120 PASS CPU synthétiques réellement encodés/décodés.
- PostgreSQL jetable réel : pipeline16, Salad7, reprise/OAuth26, RLS259 assertions. Atomicité SQL et migrations canoniques couvertes séparément du modèle T08.
- TS/lint/build applicatifs PASS, avertissements lint préexistants. Audit dépendances0high/critical,2low/5moderate, pas une sécurité exhaustive.
- Chromium210+7 contrôles,165scans axe/0violation ; bibliothèque25, légal15/parcours34/téléchargement privé9 PASS, assertions communes non additionnées. Legacy1022PASS/25SKIP/0flaky.
- Les captures exactes `legal-375.png` et `download-1440.png` ont été affichées et examinées par T08. Modal lisible et focus visible à375 ; lecteur/téléchargement à1440 visibles. Cette revue de deux images ne constitue pas une validation visuelle complète ni lecteur écran.
- Sauvegarde : reçu historique14oct14:03UTC,141 tables restaurées, auth limitée aux IDs et blobs non figés transactionnellement. Preuve de restauration bornée, **pas une sauvegarde fraîche**. Migration/rollback isolés et concurrence DDL prouvés ; aucun rollback production T08.

Les anciens FAIL Suno, parcours sociaux du 14 octobre, stockage/preuve publique, pagination/contraste, modal, diagnostic de soumission, checkpoint, autorité de publication et états du lecteur sont clos dans leur périmètre précis sur la CI exacte et/ou les contre-tests directs. Les nouvelles frontières défaillantes restent visibles dans les lignes distinctesR54-R56/R64-R72, sans transformer l'ancien test rouge en skip.

## Défauts ouverts et responsabilités

Voir [DEFECTS.md](DEFECTS.md). T08-CANCEL-01 est reproduit directement par T08 ; les onze autres exigences FAIL reposent sur les nouveaux rouges propriétaires. Les tests applicatifs ciblent49c166d, dont le produit égale3855665 ; le défaut SQL T01 concerne explicitement sa copie privée du schéma runtime, et non une exécution T08 sur la migration candidate. Les reçus et handoffs datés sont conservés dans `receipts/` ; leurs corrections WIP ne sont pas certifiées.

T01 a reçu la demande de SHA, puis confirmé que3855665 est désormais une référence ancienne. Le [plan de reprise](SMOKE-T01.md) impose les seuls tests affectés, puis le parcours complet sur le nouveau candidat. **Le blocage de clôture de certification est externe au lot T08 : corrections propriétaires et SHA intégré manquants.** Aucune attente de permission utilisateur n'est inventée.

## Conditions restantes

Configuration inactive : cron et Salad restent désactivés, gateway absente. T01 signale une clé Salad malformée sans en révéler la valeur ; aucune sonde doublonnée. Configuration et exploitation restent T01. Le nouveau reçu de restauration T01 du15oct01:10UTC ferme le manque de sauvegarde fraîche au snapshot de recette :141 tables/comptages exacts et4 contrats de schéma. Auth complète et cohérence atomique blobs restent non prouvées. Toute promotion ultérieure doit revalider fraîcheur et liaison exacte au candidat ; T08 n'autorise aucune promotion.

Actions personnelles, après correction du code : remplacer la clé Salad par une clé valide depuis le [portail officiel Salad](https://portal.salad.com) via le canal sécurisé habituel si le GPU est voulu ; effectuer soi-même connexion/acceptation légale et consentements OAuth des seuls réseaux souhaités via le parcours SUTRA ([guide officiel Zernio](https://docs.zernio.com/guides/connecting-accounts)) ; définir et autoriser explicitement un budget borné avant tout essai GPU facturé. Aucun achat/consentement/publication n'a été exécuté par T08. Essai appareil mobile/lecteur écran, génération GPU, qualité IA, alertes réelles et publication réelle restent NON TESTÉS.

GitNexus : index local créé sans embeddings ;5 gros fichiers ignorés, flows tronqués, FTS désactivé. Context exact `cancelJobByKey` : route POST appelante ; aucun symbole produit modifié. `detect-changes all` avant staging ne voit pas les nouveaux fichiers ; analyse staged/compare exécutée avant commit, limites consignées dans `gitnexus-review.json`. Aucun graphe partiel présenté comme exhaustif.

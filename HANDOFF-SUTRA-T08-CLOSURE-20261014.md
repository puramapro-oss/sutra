# T08 → T01 — recette indépendante, clôture ciblée

Branche `codex/sutra-t08-closure-20261014`, worktree `/Users/matissdornier/purama-worktrees/sutra-t08-closure-20261014`, base intégrée testée **e09fdaeafbf1ec8554a7b689fe3c44dd696d0140**. SHA de livraison dans le miroir canonique `.coord/handoffs/SUTRA-20261012/T08-CLOSURE-20261014.md` après commit.

**Verdict : cette version n'est pas prête aux essais utilisateur complets.** Les quatre FAIL historiques sont clos par retest ; les défauts récents T03/T06/T07 ne sont pas encore intégrés. T01 a confirmé14:10 puis14:15 que le candidat exact est différé ; réception T03 47f6896 à14:23 en WIP, HEAD intégré toujours e09 à14:24. Aucun ancien bilan repris sans vérification pour déclarer les défauts corrigés ou encore présents.

- 13 scénarios indépendants de parcours PASS, budget/droits, queue durable, reprise, montage/export, planification/publication simulées, erreurs partielles et concurrence12. Connexion personnelle/DB/provider remplacés par fixtures explicitement.
- Anciennes régressions : Suno19, OAuth38+9, stockage/preuve18, OTS16, navigateur bibliothèque/cookie/social25 PASS.
- Nouveau défaut T02-FINAL-01 reproduit par T08 :3 PASS/1 FAIL, diagnostic RPC exposé dans HTTP503. Copie exacte du test auteur, aucun affaiblissement. Correctif T03 à retester après intégration.
- 37 MP4 CPU T05 vérifiés par hash/taille ;11 producteurs conformes,6 modules produit et lockfile identiques au candidat. Pas d'encodage répété ni preuve GPU.
- Qualité ciblée : TypeScript, ESLint, syntaxe Python PASS ; CI/build globaux inchangés réutilisés. Commandes/logs dans `qa/t08-closure-20261014/`.

Adaptation livrée à la demande T06/T01 : **seulement les données de fixture** dans `scripts/test-t08-integration-journey.mts` et `qa/t08-integration-journey-20261014/database.mts` (UUID, binding, provenance). Toutes les assertions restent identiques ;13 PASS après modification. Compatibilité future T06 à confirmer sur candidat intégré. Impact GitNexus LOW/un appelant test, graphe tronqué. Aucun fichier produit, helper T06 ou test propriétaire modifié.

Matrice : **53 exigences =37 PASS /5 FAIL /2 BLOQUÉ /9 NON TESTÉ**. Les cinq FAIL sont les exigences légal, diagnostic production, intégrité durable, autorité sociale, lecteur. Les reproductions récentes propriétaires sont séparées de la reproduction directe T08. Les47 lignes historiques seules :35 PASS/1 FAIL/2 BLOQUÉ/9 NON TESTÉ ; R41 nouvel échec clavier, R32 exhaustivité séparée d'OTS corrigé, R47 ancienne attente close mais nouveau candidat attendu.

Fichiers : les deux fixtures ci-dessus, nouveaux tests/preuves/matrice/reproductions/plan smoke sous `qa/t08-closure-20261014/**`, ce handoff et append BATON/task_plan. Le dossier inclut copie byte-identique du test T02, pas une réimplémentation unitaire. Aucun produit corrigé par T08 : corrections réservées aux propriétaires.

À reprendre seulement après SHA T01 : [SMOKE-T01.md](qa/t08-closure-20261014/SMOKE-T01.md). Défauts minimaux, attendu/observé/propriétaire : [DEFECTS.md](qa/t08-closure-20261014/DEFECTS.md). Matrice complète : [MATRIX.md](qa/t08-closure-20261014/MATRIX.md).

Blocages réels : candidat intégré absent, ordonnanceur autonome non activé. Consentements personnels et budget/qualification GPU sont distincts ; générations GPU, publications réelles, DB→rendu→publication continu, alerte live, SLA et lecteur d'écran complet NON TESTÉS. Aucun appel payant, secret, calcul IA/GPU Mac, publication, push, fusion, migration distante ou déploiement. Aucun autre terminal interrompu.

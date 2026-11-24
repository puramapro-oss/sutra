# T07 → T01 — frontend intégré retesté, 15 octobre 2026

Branche `codex/sutra-t07-integrated-retest-20261015`, worktree `/Users/matissdornier/purama-worktrees/sutra-t07-integrated-retest-20261015`. Base documentaire56754679abed9aa1e51323c29aed5bef38bc17d0 ; candidat applicatif **d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2**. Le SHA de livraison est le commit contenant ce document et sera inscrit dans le miroir partagé après commit.

**Intégration PASS** : les neuf fichiers du dernier lot T07c72188a sont identiques au candidat. **Retest Chromium PASS142/FAIL0**, desktop1440 et mobile375 ; **39 scans axe/0 violation** dans les régions/règles testées. Connexion/inscription, consentement réel sur fixture, création, progression/reprise/erreurs, bibliothèque, téléchargement privé vérifié, montage/sous-titres, social, planification, clavier/focus et navigation couverts. Zéro erreur runtime/hydratation et mutation inattendue. Aucun nouveau défaut produit reproduit, aucun fichier produit/backend/config modifié.

Livraison uniquement : `qa/t07-integrated-retest-20261015/**`, ce handoff et sections finales T07 de BATON/task_plan. Réutilise les composants et scénarios opérationnels, notamment le harnais corrigé par T01. **Ne pas remplacer les documents communs ni réimporter les neuf fichiers produit déjà intégrés.**

Mesures locales **développement** : DCL54–713ms,15–16ressources,5,28–5,29Mo transférés avec instrumentation ; compilation/cache différents, aucun gain de chargement affirmé. Une requête par double soumission auth/planning ; erreurs social/planning visibles vers10,9s. Les gains historiques2→1 restent documentés dans le précédent lot ; pas de nouveau benchmark avant/après comparable ni d'optimisation spéculative.

Commandes exactes, compteurs par famille, captures inspectées, métriques et reçus : [README](qa/t07-integrated-retest-20261015/README.md). Runner, lint ciblé et syntaxe vérifiés. TypeScript/lint/build globaux et WebKit réutilisés depuis la CI exacte T01 **38677062190 SUCCESS**, sans rebuild/rejeu identique. Aucun secret ou `.env` lu, aucun fournisseur réel ni opération payante ; serveurs propres arrêtés.

**BLOQUÉ / dépendance existante T01–T03** : contrat UI d'annulation durable create/production non raccordé ; ne pas confondre abandon du fetch et annulation distante. **NON TESTÉ** : Safari natif, appareil physique, VoiceOver, consentements personnels, fournisseurs/GPU/publication réels, latence de production. Les essais Chromium utilisent des viewports mobiles, pas un appareil physique.

Ce reçu est une preuve frontend locale supplémentaire pour T01/T08, pas un ACK indépendant T08 ni une autorisation de promotion. Aucun push, fusion, changement de production ou déploiement effectué. Réservation close FIN_ECRITURE après commit dans les deux LOCKS ; miroir `.coord/handoffs/SUTRA-20261012/T07-INTEGRATED-RETEST-20261015.md`.

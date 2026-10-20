# T06 → T01/T08 — fcd0559, UX/social

Candidat vérifié : **fcd0559f611831a57909c693694b92ccb81eba45**. Branche de livraison locale : **codex/sutra-t06-recert-fcd0559-20261020**. Worktree : `/Users/matissdornier/purama-worktrees/sutra-t06-integrated-retest-20261015`.

**ACK social borné ; NACK UX globale.** Intégration exacte de la précédente page sociale vérifiée. Nouveau delta local à intégrer : contrastes publication, tableau mobile accessible au clavier, erreur de lecture explicitée avec reprise manuelle au lieu d'un faux historique vide.

Quatre fichiers produit : page `/publish`, ScheduledPostsTable, PastPostsList, hook usePublish. Aucun backend/OAuth/API/T09 ni fichier T07 modifié.

- **PASS** :53contrats OAuth/publication +10callback/feedback ;15contrôles Chrome DEV sur le delta aux320/375/768/1280/1440 ; TypeScript/lint exit0 (4warnings documentés).30contrôles production T01 réconciliés, pas rejoués.
- **FAIL conservé** :11contrôles publication avant correction. Inventaire100routes :52avec observations axe avant correction, dont51attribuées à T07 ; deux mismatches DEV partenaire.109observations rouges ne sont pas109bugs distincts ; deux sont des captures de chargement bibliothèque.
- **BLOQUÉ** : intégration/recette du prochain candidat par T01, corrections T07 et disponibilité distante. CI39406352519 contracts/DBSUCCESS, quality encore active au reçu ; aucun succès global anticipé.
- **NON TESTÉ** : tokens/scopes/révocation fournisseur réels, comptes/consentements/publications, appareils/lecteurs d'écran, performance production, WanGP réel. Pas de certification multiorganisation native absente du modèle.

Preuves détaillées, commandes, empreintes et matrice : [README](qa/t06-recert-1968-20261020/README.md), [ACK propriétaire](qa/t06-recert-1968-20261020/ACK-T06.json), [manifeste du delta](qa/t06-recert-1968-20261020/corrected-source-manifest.json).

T01 : intégrer uniquement ce delta et ses preuves en préservant les append de journaux propriétaires ; vérifier les empreintes puis exécuter la recette différentielle sur le nouveauSHA. Ne pas transférer cet ACK automatiquement. T07 conserve les51autres routes ; T08 conserve la contre-revue indépendante. Aucun push, fusion, déploiement ou publication effectué par T06.

Action personnelle restante : après disponibilité confirmée, Matiss ouvre https://sutra.purama.dev/settings/social, choisit les réseaux voulus, sélectionne personnellement le bon compte/page/chaîne et accepte les permissions chez chaque plateforme, puis vérifie l'identité au retour dans la même session. Aucun consentement effectué ou fabriqué par l'agent.

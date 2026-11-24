# T04 → T01 — reprise Salad auth, 15 octobre 2026

Branche `codex/sutra-t04-salad-auth-20261015`, worktree `/Users/matissdornier/purama-worktrees/sutra-t04-salad-auth-20261015`. Base exacte `d5d49a458e9e630ffbc1a433a7693a8cecd7dad5` / candidat applicatif `c7a7ebd876d36c521b1c30f6d487b7bb07f000a8`, CI38750974353SUCCESS. SHA final dans le miroir de coordination. Aucun push/fusion/déploiement.

**PASS :30tests ciblés/0FAIL/0SKIP** —3 nouveaux diagnostics,21 régressions Python,6 contrats Node. Correctif limité à `qa/t04-salad-access-20261015/secure_setup.py` : un échec de saisie indique désormais le NOM rejeté, la raison constante et les codes HTTP disponibles, sans valeur ni corps brut. Reproduction rouge conservée (3méthodes/5sous-échecs) ; sécurité refus avant réseau et écriture préservée.

**BLOQUÉ :** reçu utilisateur18:03:40UTC `INVALID_LITERAL_INPUT`, avant réseau, master inchangé. Contrôle18:07:39UTC : `SALAD_API_KEY` présente mais non littérale, `SALAD_ORGANIZATION`/`SALAD_PROJECT` absentes. Aucun HTTP Salad observé, aucun défaut distant inventé. Nouveau lanceur masqué transmis à Matiss, reçu de nouvelle saisie attendu. Noms techniques à relever dans [le portail officiel](https://portal.salad.com), l'API publique ne sait pas les énumérer. Voir [preuves et lancement](qa/t04-salad-auth-20261015/README.md).

**NON TESTÉ :** auth réelle, crédits, droit de créer, groupe/image/GPU/VRAM, génération, interruptions/réplication et facture. Les deux lectures200 de scope seraient une preuve d'accès seulement. Aucun GPU, modèle Mac, secret affiché, master modifié ou `.env.local` créé dans cette reprise.

Configuration OVH exclusive T01 : reçu T01 observe18:05UTC production86d04c85 saine etSaladOFF. Aucun SSH/modification distante T04 ; aucune activation automatique. La recette image, worker, bridge, journal et adaptateurs intégrés sont réutilisés.90/91 sources comparées inchangées depuis db93ef0 ; seul filtrage d'erreurs route production T02 déjà intégré, non modifié ici. Gates globales c7 réutilisées sans répétition ; lectures historiques fournisseurs distinguées de nouveaux tests dans README.

Fichiers exacts : `qa/t04-salad-auth-20261015/files.json`. Tests/commandes : `checks.json` et logs. Écritures : seul outil de diagnostic existant, nouveau dossier QA, ce handoff, append propres `BATON.md`/`task_plan.md`/`ERRORS.md`. GitNexus LOW avant édition, index partiel : aucune certification exhaustive.

Suite minimale : Matiss exécute le nouveau `qa/t04-salad-auth-20261015/Saisie-Salad.command` ; deux GET gratuits puis sauvegarde privée des seuls trois noms si validés. T01 prépare ensuite image construite/digest, poids officiels/licences, PostgreSQL/TLS, Gateway/token, manifeste mesuré et devis/budget réel. Liste de noms de configuration et protocole de deux calculs distincts (qualification puis job HTTP) dans README ; **aucun essai payant autorisé par ce handoff**. Ne pas reproduire les30tests inchangés ni les gates c7 sans delta.

Clôture accès18:15:17UTC : `final-access.json` confirme `MASTER_LITERAL_INPUT_REQUIRED`, même état des trois noms, zéro requête et zéro écriture. Ancien reçu18:03:40UTC inchangé, aucun reçu du nouveau lanceur. Matiss reste le seul à pouvoir compléter la saisie masquée ; aucune erreur HTTP distante observée.

Validation finale locale : gitleaks stagedPASS et diff-checkPASS ; GitNexus deltaLOW27fichiers/28symboles/0flux avant les seuls derniers reçus, graph/index et affichage partiels. Compare mainCRITICAL historique signalé, aucune promotion fondée dessus.

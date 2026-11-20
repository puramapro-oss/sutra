# T07 → T01/T08 — UI fcd

Candidat **fcd0559f611831a57909c693694b92ccb81eba45** ; branche locale **codex/sutra-t07-ui-fcd-20261020**, parent QA `cabae2c155f54d095202df0494e2c17b41339e3d`. Worktree propre à T07 : `/Users/matissdornier/purama-worktrees/sutra-t07-final-two-20261015`.

**PASS local borné, intégration à retester sur le prochain SHA.** 65 sources frontend réservées : contrastes, noms accessibles, clavier/labels, hydration partenaire, liens absents/valides, suppression de la fausse sauvegarde des notifications et libellé Analytics « Solde de crédits » autorisé par T01. Aucun backend ni calcul financier changé.

Chromium réel DEV, fixtures et réseau externe bloqué, 375/1440 : **100 lignes PASS / 2 FAIL, 50/51 routes**, **20 groupes d'interactions PASS**. FAIL restant : bouton export `/ma-memoire`, source juridique intacte et confiée à T02 par T01. Analytics vérifie 40→43 sans vidéo aux deux largeurs ; copy/UTM, double clic, indisponibilité et clavier testés. Les échecs bruts et corrections du harnais sont conservés.

TS PASS ; lint ciblé PASS (30 avertissements), syntaxe/diff PASS ; scan secrets et GitNexus borné documentés. Mesures DEV 1001→971 ms médiane non comparables pour conclure à un gain ; GET inutile notifications 1→0. Safari, appareil physique, lecteur d'écran et build du nouveau diff **NON TESTÉS ici**.

Fichiers exacts, empreintes, commandes, captures affichées et limites : [README](qa/t07-ui-fcd-20261020/README.md), [manifest](qa/t07-ui-fcd-20261020/source-manifest.json), [summary](qa/t07-ui-fcd-20261020/summary.json), [ACK](qa/t07-ui-fcd-20261020/ACK-T07-UI.json).

Personnalisation persistante des notifications toujours indisponible, affichage maintenant véridique. ACK automatisation distinct au commit `cabae2c155f54d095202df0494e2c17b41339e3d` ; 13 contre-tests SQL T07 en attente du cluster CI jetable T01, pas couverts par les 19 tests historiques. Activation réelle non autorisée ; aucune dépense, publication, cron, push, déploiement ou modification d'un autre worktree.

Le SHA de livraison sera ajouté après commit aux miroirs partagés T01/T08/T07. T01 doit intégrer puis transmettre le nouveau SHA pour la recette différentielle ; aucun ACK transféré automatiquement.

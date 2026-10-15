# Réception T01 — candidat72f

Ne pas relancer un audit général ni des PASS inchangés. Lire `matrix.json`, `source-verification.json`, `ci-verification.json` et le handoff final. Le SHA de code accepté reste `72f406b940b7e3cdfb27873751a4059375646f25` ; un commit documentaire T08 n'est pas un nouveau candidat applicatif.

Si T01 modifie encore un fichier testé, fournir le nouveau SHA et son delta ; rejouer uniquement les consommateurs affectés puis `python3 qa/t08-acceptance-72f406b-20261015/run.py journey` avec le runner lié au nouveau manifeste. Ne jamais faire passer le contrôle de manifeste en ignorant un écart. Aucun build identique parallèle.

Sans delta, les112 tests ciblés exécutés et la CI exacte suffisent au périmètre simulé. Avant tout essai utilisateur, expliquer : mode Salad inactif, aucune génération réelle certifiée, annulation durable serveur non câblée dans `/create`, ordonnanceur autonome inactif. Un reset de formulaire ne prouve pas l'annulation d'un fournisseur.

Actions personnelles minimales, hors exécution T08 :

- Saisir localement les accès Salad valides et noms techniques organisation/projet via le lanceur masqué T04, après consultation de [Salad Portal](https://portal.salad.com/). Aucune clé dans le chat. T01/T04 doivent ensuite qualifier l'infrastructure Linux/GPU et un budget explicitement autorisé ; aucune provision/génération n'est déclenchée par cette recette.
- Après disponibilité contrôlée du candidat, choisir les réseaux nécessaires et donner soi-même les consentements légaux/OAuth dans [SUTRA](https://sutra.purama.dev/settings/social). Aucune connexion ou publication automatique par T08.

T01 conserve la propriété exclusive SQL/config/OVH. Cette recette n'autorise ni promotion, ni DDL de production, ni activation cron/worker facturable. Les reçus restore141tables sont bornés (auth IDs, blobs non atomiques) et la fraîcheur du backup doit être réévaluée au moment d'une opération autorisée séparément.

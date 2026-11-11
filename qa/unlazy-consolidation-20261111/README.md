# SUTRA — composition des corrections de tests, 11 novembre 2026

## Problème et composition

Le candidat cinéma de la PR #14 (`b1a3c244`) conserve la file sociale durable de #13, mais sa base analytics s'arrête à `6575c67`. Deux correctifs présents dans la PR #12 (`2257eb3`) manquent : les cas UI support/médias réellement exercés et le drainage des connexions PostgreSQL avant les redémarrages privés.

Cette composition fusionne #12 dans #14 en conservant leur ascendance. Les quatre fichiers de tests modifiés sont identiques octet pour octet à #12. Tous les fichiers produit `src/` restent identiques à #14. La configuration Vercel ajoute uniquement la désactivation de la branche de revue `codex/unlazy-sutra-consolidation-20261111-ac3c`.

## Vérifications locales initiales

- PASS : quatre tests existants du pool, avec pg et ses dépendances aux versions du verrou. Les connexions sont simulées ; aucune base ni service n'a démarré.
- PASS : syntaxe TypeScript des trois fichiers et syntaxe Node du runner. Cela ne remplace pas un typage global.
- PASS découverte : Playwright 1.58.2 retrouve les douze instances rétablies, sans statut attendu skipped. Ces instances n'ont pas été exécutées en navigateur local.
- PASS : blobs identiques aux corrections entrantes, absence de changement produit et contrôle des espaces du diff.
- GitNexus : index isolé de la projection sparse et impacts ciblés LOW. Les limites de traçage sont conservées dans le reçu. Le premier essai interrompu à 150 s reste un échec ; le second a abouti.

Les logs et le reçu initial accompagnent ce fichier. Ils distinguent exécution, découverte et vérification de contenu. Les mêmes entrées du helper et de son test étant inchangées par la fusion, leur résultat reste applicable ; il ne certifie pas le parcours natif de reprise.

## Gates de réception

1. Vérifier les deux parents du commit et les quatre blobs entrants.
2. Vérifier le graphe du diff indexé avant commit.
3. Exécuter la CI existante sur la composition complète : types/lint/build, contrats, PostgreSQL jetable et navigateurs. L'audit npm conditionnel peut être ignoré en PR ; ne pas le déclarer réussi dans ce cas.
4. Vérifier que la branche de revue reste exclue du déploiement automatique.

Statut au moment de ce reçu : **PARTIEL, CI composée attendue**. Aucun service hébergé, fournisseur réel, paiement, compte de production ou fonctionnement continu n'est qualifié par ces vérifications. Aucune installation locale n'a été faite : le Next local disponible diffère du verrou et n'a pas été utilisé comme preuve de compilation.

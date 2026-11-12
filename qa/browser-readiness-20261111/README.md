# SUTRA — disponibilité du banc navigateur T08

## Défaut observé

Le run [43116691551](https://github.com/puramapro-oss/sutra/actions/runs/43116691551) teste le merge temporaire `f5811b1eebb29b154113251cbb18f9193d1e6b0b`, arbre `3f7cd8b12441c509066c47ba9bdb7b70c459493e`. Les jobs contrats et base jetable réussissent. Le job qualité échoue dans `browser-redteam`.

L'archive `sutra-quality-results` 13898878595 montre un délai de navigation dépassé à `/library`, en attente de `networkidle`, avant les assertions d'inertie et avant la navigation vers l'éditeur. Quatre contrôles d'export échouent ensuite faute de bouton éditeur. La capture intitulée « editor retry 320 » montre en fait la bibliothèque : son ancien libellé PASS ne qualifie donc pas l'éditeur. Ces cascades ne démontrent ni faille XSS ni régression d'export.

La trace finale conserve des préchargements GET non terminés. Elle est compatible avec une attente globale inadaptée, sans identifier à elle seule la requête causale précise. Le témoin natif ajouté reproduit ce mécanisme sur HTTP local avec un trafic de fond maintenu ouvert.

## Correction du banc

La préparation vérifie la réponse HTTP 200, le document chargé, la carte persistée exacte, le titre exact de l'éditeur, son URL et sa commande d'export activée. Toutes les assertions d'inertie et d'export existantes sont conservées. Aucun délai de la suite applicative, seuil d'audit ou garde de sécurité n'est relevé.

Si cette préparation échoue, les quatre contrôles d'export et l'audit éditeur sont marqués BLOCKED avec leur prérequis ; la sortie globale reste en échec. L'audit confirme également l'URL, le titre et la commande de l'éditeur, pour éviter une capture d'une autre page sous un libellé trompeur. Le contrôle indépendant de respiration reste exécuté.

Les sept scénarios natifs couvrent le témoin `networkidle`, la préparation malgré le trafic de fond, le mauvais contenu bibliothèque, le mauvais titre éditeur, un balisage réellement exécutable, une commande désactivée et une réponse HTTP 503. Ils sont exécutés dans l'étape navigateur native existante, avant la suite applicative complète.

## Vérification et portée

Les trois fichiers JavaScript passent `node --check`, ESLint ciblé et le contrôle du diff. La tentative de navigateur local reste **NON TESTÉE** : Chromium échoue au lancement avec `socket() EPERM`, avant les assertions. Son journal est conservé ; cet incident d'environnement ne compte ni comme régression reproduite localement ni comme test réussi. Aucune permission locale n'a été modifiée.

La qualification finale doit être lue dans la CI attachée au commit candidat et dans le reçu de composition de son arbre exact. Le workflow utilise déjà son conteneur Playwright 1.58.2 verrouillé. Cette livraison ajoute les contre-tests à l'étape existante et ne modifie ni son image, ni ses permissions, ni ses secrets, ni son délai maximal.

```sh
node --test qa/t08/integrated/stored-markup-readiness.test.mjs
node qa/t08/run.mjs browser-redteam
```

Le delta conserve les correctifs de sous-titres, dont CRLF/CR/BOM, présents au parent `ece8f760`. Aucun fichier produit n'est modifié par cette correction du banc. La seule garde de publication ajoutée désactive le déploiement automatique de la branche PR18 ; les gardes déjà existantes sont conservées.

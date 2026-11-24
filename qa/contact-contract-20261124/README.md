# SUTRA — cohérence et confirmations des formulaires de contact

## Source et défauts reproduits

Base distante : PR3 `9b6d96a127c84adc388496faefe95e53600a83d1`, arbre `38337fae0780eef66d424c2480fcde69498ec3c0`. Base locale `6e72e5708ce58170b1c1a8da4b9e5f3696543bc9` : même arbre. Les copies partagées n'ont pas été modifiées.

Les anciens formulaires pouvaient proposer un sujet absent ou trop court, perdre le nom envoyé à la route, confirmer une simple réponse HTTP 200 sans reçu positif et soumettre deux fois avant le prochain rendu React. Le serveur gardait déjà le destinataire fixe, la vérification du reçu fournisseur et son limiteur par processus ; ces protections sont conservées.

## Corrections

- Sujet obligatoire de 5 à 200 caractères et message de 10 à 2 000 caractères, mêmes contraintes dans le schéma partagé et les deux formulaires.
- Normalisation des espaces périphériques ; nom validé de 1 à 100 caractères et conservé dans le texte. Le champ `name` reste facultatif pour le consommateur Escalade existant, qui conserve son prénom dans le message.
- Verrou synchrone avant le premier `await` ; champs figés pendant l'envoi ; aucune confirmation sans HTTP réussi et `success: true`.
- Erreur associée au formulaire, brouillon conservé, labels associés, confirmation et focus clavier explicites. Après succès du formulaire `/help`, un nouveau message exige l'action correspondante.
- Une réponse de l'ancienne instance après navigation ne déclenche pas de notification globale sur le nouveau formulaire. Cette garde de présentation n'annule pas un envoi déjà admis au serveur.

## Vérifications locales

Node `v24.22.3`, dépôt isolé, dépendances existantes réutilisées sans changement.

| Contrôle | Résultat |
| --- | --- |
| `node --experimental-vm-modules --test scripts/test-email-contact.mjs` avant correction | 24 PASS / 10 FAIL sur 34 : nom absent, espaces et limites non normalisés. |
| Même suite après correction | 34 PASS, aucun FAIL ni SKIP. Modules de production réels ; seul fournisseur simulé, réseau refusé. |
| Contrats historiques contact avec les variables de fixtures du lanceur CI | 5 PASS, aucun FAIL ni SKIP. |
| TypeScript ciblé sur les quatre fichiers produit et Escalade | PASS. Configuration héritée du dépôt, `--noEmit --incremental false`, plafond de tas 512 Mio. |
| React/JSDOM : composants et handler réels, fournisseur simulé | Avant : 1 PASS / 35 FAIL sur 36 assertions de scénario ; après : 36 PASS / 0 FAIL. Ces assertions ne désignent pas 35 défauts indépendants. Empreintes des sources dans `dom-baseline.json` et `dom-candidate-final.json`. Ce contrôle n'est pas un navigateur. |
| ESLint des quatre fichiers produit et des trois fichiers de tests modifiés ; `git diff --check` | PASS sur la composition finale, zéro erreur. |
| Revue indépendante | Destinataire, reçus, consommateurs et concurrence examinés. Défaut de notification tardive identifié puis corrigé. |

Le typage global local a été interrompu avec sortie 137 sans diagnostic TypeScript ; ce n'est pas un résultat positif. Le démarrage du Chromium local est refusé avec `socket() EPERM` avant toute page ; WebKit local est absent. Aucun succès navigateur local n'est revendiqué.

Les journaux `server-final.txt` et `legacy-final.txt` conservent les résultats des suites ci-dessus. La suite historique a été exécutée avec `RESEND_API_KEY=re_isolated` et `NODE_OPTIONS=--require=./qa/t08/offline.cjs`, comme son lanceur CI ; un premier appel sans configuration synthétique avait correctement reçu 503 et ne constituait pas une régression. Le harnais JSDOM utilise la dépendance déjà installée hors dépôt : aucune nouvelle dépendance ni modification du verrou. Une comparaison d'un tableau entre contextes JavaScript a été corrigée dans ce harnais avant le reçu final 36/36 ; aucun fichier produit n'a changé pour cette correction de test.

## Portes de CI conservées et complétées

La suite existante `scripts/test-email-contact-ui.mjs` garde les 18 parcours Escalade. `scripts/test-contact-forms-ui.mjs` ajoute 88 parcours : Chromium et WebKit, deux formulaires, contraintes, limites, réponses altérées, erreurs fournisseur, conservation, concurrence et démontage. Les formulaires réels appellent le vrai handler, le schéma et le limiteur via HTTP loopback ; le fournisseur de messagerie reste simulé. Toute connexion inattendue est refusée.

La sélection locale explicite `SUTRA_CONTACT_TEST_ENGINES=chromium` ne vaut pas qualification WebKit. Par défaut les deux moteurs sont requis ; aucun scénario n'est ignoré lorsque le moteur manque. Le step CI appelle les deux fichiers avec `--test-concurrency=1` après le build complet. Aucun gate existant n'a été supprimé ou affaibli.

## Limites

Aucun message réel envoyé, aucun fournisseur ni compte de production qualifié. La garde de soumission protège une instance du formulaire ; elle ne garantit pas l'absence de doublon après rechargement, entre onglets ou après une réponse réseau perdue. Le limiteur conserve sa portée par processus. Le circuit des séquences email et son journal ne sont pas détournés pour créer une seconde autorité de contact.

Le nouveau commit doit être identifié dans la PR de réception. Les résultats CI et l'intégration ont leur preuve distincte ; aucun succès des anciennes révisions n'est transféré au nouveau code. La branche de correctif et la branche de consolidation sont exclues du déploiement Vercel ; `main`, EAS/OTA et les migrations restent inchangés.

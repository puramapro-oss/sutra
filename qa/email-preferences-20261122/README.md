# SUTRA — préférences et reçus email, 22 novembre 2026

Base de reprise : `11d4ea707f1a13f4c9e88fc453c21d85f0786b2c`, branche de revue de la PR3. Les travaux antérieurs sont conservés. Le lot découle de la validation collective du 21 novembre et de la demande de terminer le code restant.

## Défauts reproduits

Le cron ne consultait pas les choix email, ignorait les erreurs renvoyées par le SDK et écrivait son historique après le transport. Deux exécutions concurrentes pouvaient donc envoyer le même message. La sauvegarde des préférences ne vérifiait pas la ligne enregistrée. Le parcours dédié de réglages ne permettait pas encore cette sauvegarde.

Les 18 premiers scénarios sur les sources initiales donnaient **2 PASS et 16 FAIL**, sans fournisseur réel. `before.log` conserve la contre-épreuve, avec espaces de fin de ligne normalisés. Des contrôles supplémentaires ont été ajoutés après revue indépendante : transport suspendu, reprise après un préfixe historique, confirmation effacée par le rafraîchissement du profil et échec silencieux de la seconde vérification de session.

## Comportement livré

- Les six choix existants sont chargés et enregistrés sur les deux accès aux réglages. Seul un reçu exact du compte courant permet d’annoncer la sauvegarde ; doubles appuis, changements de compte et réponses tardives sont isolés. Les échecs conservent les choix et permettent une reprise explicite.
- Une actualisation du même profil conserve le reçu de sauvegarde. Une panne d’actualisation n’annule pas une écriture déjà confirmée. Une nouvelle modification des choix efface la confirmation précédente.
- Les séquences ne traitent que les comptes éligibles avec consentement explicite. Les préférences et l’état du compte sont relus avant admission puis avant transport.
- L’intention est persistée dans le journal existant avant tout transport et protégée par son unicité `(user_id, email_type)`. Le reçu fournisseur est vérifié puis enregistré avant de compter une acceptation.
- Une issue incertaine reste consultable pour réconciliation et n’est jamais renvoyée automatiquement. L’expiration de la fenêtre d’idempotence du fournisseur ne libère pas l’intention.
- Le nom inséré dans le message est échappé. Les anciennes promesses promotionnelles sans preuve sont retirées. Aucun nouvel envoi, déclencheur cron ou abonnement n’est activé par cette branche.

## Qualification

Les résultats locaux exacts sont consignés dans `verification.json`. Les tests unitaires exécutent le vrai handler et les vrais helpers avec les frontières base/fournisseur simulées et les requêtes externes interdites. La contre-revue React indépendante utilise JSDOM ; elle ne vaut pas recette navigateur.

La CI existante intègre les nouveaux tests aux contrats, aux parcours Chromium et au PostgreSQL jetable. La réception de chaque job sur la tête publiée est consignée dans la description de la PR ; aucun résultat d’un candidat antérieur n’est transféré automatiquement.

## Migration et limites

`migrations/20261122_email_sequence_receipts.sql` complète la table existante. Ses gardes refusent un schéma incompatible ; le gate PostgreSQL vérifie application répétée, conservation de l’historique, droits et concurrence. La migration doit être appliquée selon le processus de déploiement existant avant l’activation du nouveau handler. Elle n’a pas été appliquée à une base distante pendant cette reprise.

`emailsSent` signifie que le fournisseur a accepté le message et que cette acceptation a été enregistrée ; cela ne prouve pas sa livraison en boîte de réception. Les intentions ambiguës demandent une réconciliation à partir des journaux et de la preuve fournisseur. Les campagnes conservent leurs fenêtres journalières existantes ; aucun rattrapage de campagnes expirées n’est inventé.

Les essais locaux de compilation interrompus avec le code137 sont des échecs d’exécution et ne sont pas comptés comme des PASS. L’environnement local refuse l’ouverture de sockets ; les parcours navigateur et la base native sont qualifiés par CI. Aucun email réel, changement de secret, paiement, migration de production, fusion vers main ou déploiement n’a été effectué.

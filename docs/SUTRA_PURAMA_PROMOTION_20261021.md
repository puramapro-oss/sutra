# SUTRA — promotion transparente de PURAMA

## Statut réel

Complément à l'issue #4 et à la préparation des comptes (PR #5). Ce lot ajoute un
planificateur de BROUILLONS et ses tests, pas un service de publication opérationnel.
Il ne crée aucun compte, n'appelle aucun réseau, ne charge aucun modèle, n'achète
aucune publicité et ne modifie aucun connecteur existant. Aucune route/API/UI n'est
raccordée. Les modèles WanGP personnels restent séparés du parcours client.

## Demande et résultat recherché

Les comptes personnels/éditoriaux AUTORISÉS du propriétaire peuvent présenter PURAMA,
ses applications, formations, produits et services pertinents. Leur lien avec PURAMA
doit être visible. Ne pas les présenter comme des consommateurs indépendants ou de
faux médias neutres. Les comptes clients, d'affiliés et de partenaires ne sont jamais
inscrits automatiquement : mandat explicite, révocable, propre au titulaire.

« Tous mes comptes participent » ne signifie pas « chaque publication est une publicité ».
Prévoir une identité de marque cohérente, un profil transparent, des démonstrations
vérifiables, des tutoriels utiles, des réponses aux questions et un appel à l'action
adapté au sujet. Aucun ratio universel de posts publicitaires n'est prétendu optimal.
La fréquence est décidée par édition et mesurée ; respecter les quotas des plateformes,
les refus du public, la pertinence, les droits et la capacité de modération.

Exemples à produire UNIQUEMENT après preuve des fonctions disponibles :
- compte création : démonstration réelle d'une fonction SUTRA et de ses limites ;
- compte formation : une compétence, une démonstration, un exercice, puis lien pertinent ;
- compte entraide : projet documenté et ressource PURAMA réellement utile ;
- compte marque : présentation exacte d'une offre disponible ou d'une bêta explicitée.
Ne pas insérer du trading dans une vidéo destinée aux enfants ni exploiter une confidence
sur la santé, les finances ou l'isolement pour proposer un produit.

## Catalogue et preuves commerciales

Le catalogue autorisé est la source unique des noms, versions, capacités, disponibilité,
pays, langues, prix, conditions et éventuelles réductions. Aucun prix ou taux de commission
n'est codé dans ce module. Relire le canon actuel et les conditions commerciales validées
avant de raccorder le catalogue ; le canon Library complet n'a pas été récupéré dans ce lot.

Conserver la correction utilisateur : pas de réintroduction de primes ou bonus. Les
commissions ne sont pas des remises clients et les liens de la marque ne doivent pas
écraser l'attribution d'un affilié légitime. Toute logique d'affiliation est hors de ce lot
et doit réutiliser le système existant, sans fabriquer une promesse de gain.

Le statut « prévu » autorise seulement un brouillon de présentation/liste d'attente dont
le statut est annoncé, jamais une présentation comme produit immédiatement disponible.
Une offre retirée est bloquée. Chaque affirmation reprise doit avoir un identifiant de
preuve dans le catalogue. Cela ne prouve pas automatiquement que la preuve est vraie :
le responsable du catalogue doit en vérifier la validité. Les catégories santé, finance,
enfants, formations financées publiquement et inconnues demandent un circuit spécialisé ;
ce lot ne les déclare ni légalement autorisées ni toutes illégales.

Interdictions de conception : faux témoignages, résultats financiers/santé garantis,
rareté inventée, faux prix barrés, fonctions prévues présentées comme livrées,
comparaison « meilleur du monde » sans preuve, recommandations de tiers inventées.

## Transparence et originalité

Distinguer autopromotion, affiliation, partenariat et achat de publicité.
Le plan affiche d'abord le texte commercial approuvé ; il restitue séparément l'exigence
de marquage natif revue par réseau/pays/langue/relation commerciale. La plateforme n'est
pas présumée avoir les mêmes règles pour autopromotion et partenariat rémunéré.

Ne pas recopier un même spot sur un réseau de comptes miroirs. Chaque édition doit
apporter une création utile et une raison éditoriale distincte. Aucun like, commentaire,
avis, abonnement ou partage artificiel entre les comptes. Pas de prospection automatique
non sollicitée. Les réponses et messages privés requièrent un parcours séparé conforme.

Les scènes, droits musicaux/voix/personnes, mentions IA et mentions commerciales doivent
être vérifiés sur le RENDU final, y compris lorsque recadrage, sous-titres ou traductions
risquent de les masquer. Le module ne fait pas d'OCR ni de contrôle vidéo : il consomme
une attestation de revue liée au digest créatif. Il ne valide pas seul les droits d'auteur,
la véracité, l'originalité ou la conformité juridique.

## Implémentation fournie

`src/lib/purama-promotion-plan.ts` : parseur strict de l'intention ; clé stable liée à
propriétaire, tenant, compte, plateforme, mode, campagne, produit/version, affirmation,
politique commerciale, langue, pays, CTA et digest créatif. Les champs supplémentaires
(prix, budget, secret, commission, texte libre, autorisation) sont rejetés.

Le contexte est EXCLUSIVEMENT construit côté serveur depuis identité vérifiée et preuves
persistées. L'API ne doit jamais désérialiser ce contexte depuis le navigateur ou un LLM.
Les identifiants de politiques et révisions du catalogue désignent des versions IMMUTABLES.
Changer un texte ou une destination sans changer sa version invalide ce contrat : le
raccordement doit interdire les mises à jour en place de ces versions.

Contrôles : compte et mandat exacts ; adhésion commerciale distincte de la simple
connexion OAuth ; catalogue récent ; pertinence thématique ; état produit et CTA ;
affirmation prouvée ; destination HTTPS exacte approuvée ; politique et mentions revues ;
revue créative liée à l'intention ; cadence bornée et récente ; réconciliation d'une
opération déjà en vol/inconnue/confirmée. Aucun traitement réseau en attente implicite.

Les fenêtres de fraîcheur (catalogue 24 h, politique/création 7 j, mandat 30 j, cadence
60 s) sont des garde-fous internes de ce premier lot, PAS des prescriptions légales.
Il n'y a pas de limite universelle de publications quotidienne codée.

La sortie `DRAFT_READY` contient un brouillon issu des textes approuvés et un lien
séparé sans paramètres de suivi. Elle conserve TOUJOURS :
`remoteExecutionAllowed=false`, `publicationAllowed=false`, `paidSpendAllowed=false`.
Le support de langues dépend des textes revus fournis ; aucune traduction automatique
n'est implémentée. Aucun format natif, pixel, cookie ou circuit d'affiliation n'est activé.
Le marqueur `aggregate-only-proposed` n'implémente pas à lui seul une mesure d'audience.

## Raccordement restant, sans doublon

T1 : comparer les nouveaux fichiers au candidat actuel, conserver PR #5 et issue #4,
réserver uniquement les écarts et garder production/automatisation désactivées.
T2 : identité/tenant serveur, droits marque, opt-in comptes clients, versions immuables,
mandats et révocations ; ne pas exposer le contexte privilégié au client.
T3 : persister la demande et rattacher le journal durable existant ; réserver atomiquement
cadence et quotas par compte, campagne, propriétaire ET application/projet. Une simple
lecture du snapshot de cadence ne garantit pas la concurrence. Après résultat incertain,
réconcilier et ne pas recréer la publication avec une autre clé.
T4 : vérifier capacités et mentions natives réellement supportées, règles à jour et
contrat du connecteur Zernio ou autre fournisseur. Pas de migration aveugle de fournisseur.
T5 : storyboard/démonstrations exactes, adaptation des rendus, audit droits et mentions.
T6 : sélection explicite des comptes, aperçu publicitaire, date de disponibilité,
revue/consentement/retrait, erreurs compréhensibles et conditions réelles de l'offre.
T7 : programmation, pauses et plafonds de pression commerciale, revalidation à l'envoi,
interrupteurs globaux/par compte, absence de rafale après panne ; aucun achat média.
T8 : tests d'intégration indépendants, refus entre comptes, renouvellement d'accord,
concurrence durable, labels rendus, lien final réel, non-régression de la publication.
T9 : aucun changement demandé au moteur personnel WanGP par ce lot.

Les campagnes payantes sont un produit séparé : budget, périmètre et autorisation distincts.
Le suivi envisagé mesure intérêt, essais, usage réel, achats/annulations/remboursements et
retours consentis plutôt que seulement vues. Minimiser les données et obtenir les
consentements requis avant tout traceur non exempté ; aucune exemption présumée.

## Tests et limites

Commande : `node qa/purama-promotion/run.mjs`.
Le runner compile uniquement le nouveau module en TypeScript strict puis lance les tests
Node sans dépendance téléchargée, appel réseau, base réelle ou dépense. Il utilise le
TypeScript local au dépôt s'il existe, sinon le compilateur déjà installé.

Tests indépendants exécutés sous Node 22.16.0 / TypeScript 5.8.3 : 162 PASS, 0 FAIL,
0 SKIP. Rejouer sous Node 24/26 exigé par le dépôt et exécuter build/lint/régressions globales
avant fusion. Le scénario à 1 000 comptes est SYNTHÉTIQUE ; il n'autorise aucun volume réel.
Ni stockage durable, ni connexion réseau, ni création de compte, ni publication, ni
campagne payante, ni intégration UI, ni test de charge 24/7 n'ont été exécutés.

## Sources consultées le 21 octobre 2026

- Transparence et véracité : https://www.economie.gouv.fr/influenceurs-quels-sont-mes-devoirs
- Pratiques trompeuses : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/pratiques-commerciales-trompeuses-les-cles-pour-les-reconnaitre-et-sen-premunir
- YouTube, branded content : https://support.google.com/youtube/answer/17596007?hl=en
- X, activité authentique : https://help.x.com/en/rules-and-policies/authenticity
- X, automatisation et consentement : https://help.x.com/en/rules-and-policies/x-automation
- CNIL, traceurs : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/comment-mettre-mon-site-web-en-conformite

Ces sources n'accordent aucune permission à SUTRA ; l'éligibilité de chaque application,
compte, produit, pays et format doit être vérifiée lors du raccordement puis à l'activation.

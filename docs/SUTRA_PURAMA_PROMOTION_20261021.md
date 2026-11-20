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

## Studio vidéo publicitaire · 18 novembre 2026

La demande du 2 novembre a retenu ChatGPT pour l’angle et le scénario, Codex pour les animations et Remotion pour le MP4. Le studio s’ouvre dans **Storyboard**. Le même parcours accepte une publicité, une démo produit ou un tutoriel.

1. Saisir le sujet, le format et la durée. Dans **Travailler avec ChatGPT, Codex ou MotionLab**, copier le brief. ChatGPT ou Codex peut renvoyer les plans en JSON.
2. Coller la réponse et choisir **Importer les plans**. Chaque plan devient éditable. Si des plans sont déjà affichés, le studio demande de confirmer leur remplacement.
3. Pour le kit local **MotionLab**, télécharger le brief. Le lanceur proposé par SUTRA l’ouvre dans une session Codex depuis le dossier de l’exemplaire du créateur. Depuis le dossier de téléchargements, exécuter `node lancer-motionlab.mjs "/chemin/vers/MotionLab" sutra-brief-motionlab.txt`. L’option `--check` vérifie le dossier, le brief et le CLI local avant toute session. Le brief contient les textes, plans, durées, indications visuelles et format. [Présentation de MotionLab](https://motionlab.life/)
4. Dans **Projet cinéma**, le rendu sur l’appareil anime les textes en MP4 jusqu’à deux minutes si le navigateur sait encoder en H.264. Pour continuer dans **Remotion**, exporter la composition éditable. Le fichier contient les commandes de rendu local et accepte les images, clips et voix off du créateur. La licence dépend de l’usage et de l’organisation. [Documentation Remotion](https://www.remotion.dev/docs/license/pricing)
5. Dans **Relire le rendu MP4**, ouvrir le fichier livré par MotionLab, Remotion ou un autre éditeur. La lecture reste sur l’appareil. Le studio affiche les dimensions et la durée lues dans le fichier, et permet de rejoindre un plan du storyboard.

### Inventaire des outils pour ce parcours

| Besoin | Intégration ou format | État dans le périmètre examiné |
| --- | --- | --- |
| Scénario et direction visuelle | ChatGPT ou Codex, ou API OpenAI Responses via SMARANA | Échange manuel depuis le storyboard. Le serveur peut aussi appeler OpenAI pour générer les plans dans SUTRA. |
| Animation des textes et du produit | MotionLab et Remotion | Lanceur local Codex pour le kit du créateur et échange par brief ou MP4. Composition Remotion éditable en 9:16, 1:1 ou 16:9. |
| Images et séquences | Pexels, Pixabay, Unsplash, Coverr, LTX, WAN/RunPod | Adaptateurs présents dans `src/lib/stock.ts`, `ltx.ts` et `wan.ts`. Les droits, clés et capacités dépendent du fournisseur choisi. |
| Voix, musique et sous-titres | ElevenLabs, Suno, sous-titres SUTRA | Modules existants. Les appels facturés et la qualification des voix relèvent du compte utilisé. |
| Montage et 3D | FFmpeg, Shotstack, export Blender, Higgsfield | Le storyboard exporte déjà le projet Blender. L’adaptateur Higgsfield prépare ses requêtes, son routage de production reste désactivé sur cette base. |
| Finition dans un logiciel de montage | OpenTimelineIO pour DaVinci Resolve et les éditeurs compatibles | L’export fournit une piste vidéo avec la cadence du projet, la durée de chaque plan et des emplacements où relier les rushes. [Format OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/docs/tutorials/architecture.md) |
| Outils personnels | WanGP et OpenMontage | Le candidat personnel du 28 octobre documente un MP4 OpenMontage de deux secondes rendu sur CPU. WanGP y reste désactivé et son exécution GPU reste à qualifier. |
| Diffusion | Circuit existant des comptes et de publication | Une exportation vidéo est indépendante d’une publication ou de l’achat d’une campagne. |

Le site de MotionLab documente un dossier local pour agents. Une API publique du kit et une licence permettant de redistribuer son contenu dans SUTRA restent à établir. L’échange du brief et du MP4 permet d’utiliser un exemplaire détenu par le créateur. Les fichiers commerciaux du kit restent dans son espace de travail. [Présentation de MotionLab](https://motionlab.life/)

### Générer les plans avec l’API OpenAI

Le bouton **Générer le storyboard** utilise le fournisseur choisi par le serveur. Pour activer OpenAI, renseigner les cinq paramètres de la section Storyboard dans `.env.example` côté serveur, notamment la clé de projet, le modèle Responses, ses tarifs et le plafond quotidien de tentatives. SMARANA réserve une tentative dans son journal de consommation PostgreSQL avant l’envoi et enregistre les jetons de la réponse. Les requêtes de ce parcours transmettent le brief avec `store: false`. Le mode par défaut conserve le moteur SMARANA déjà configuré. [Référence de l’API Responses](https://developers.openai.com/api/reference/resources/responses/methods/create)

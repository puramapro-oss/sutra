# SUTRA — consolidation et validation du 11 octobre 2026

**Décision de mise en service : NON VALIDÉE.** Cette branche est une consolidation testée en environnement isolé, pas une certification de production. Aucun déploiement, génération IA payante, publication sociale, paiement, changement de secret ou migration de base distante n’a été effectué.

## Périmètre et conservation du travail

- Base principale relue : `35c137fc0bc0bd5ff6e54c3ef44ef8b6e46b2fc5`.
- PR #1 : `a322e53d046b02005b3e05b91f42083a5ca20b1e` ; files et pipelines durables conservés.
- Correctif vidéo isolé : `05d164daafff3502ab764d852742f5e1bf17a8ca` ; moteur local, contrats HTTP, Shotstack et inspection des médias conservés.
- PR #2 : `e1bdd1b5489721aef7b7b8a42e946e2dee1202e8` ; horaires IANA, changements d’heure, occurrences et protections de publication conservés.
- Consolidation dans une branche distincte. Les branches des deux PR et `main` ne sont pas modifiées par cette livraison.
- Les conflits des routes de génération et de planification sont résolus vers les composants durables existants. Aucun moteur de file supplémentaire.
- Les travaux locaux du Mac ne sont pas inclus : Desktop Commander indique `mac.home` hors ligne et MacDevBridge renvoie une erreur interne. Les verrous, worktrees et handoffs locaux restent à rapprocher avant toute intégration sur la machine du propriétaire.

## Seconde passe : LTX, fichiers finaux et publication

Les corrections suivantes complètent le premier lot. Elles sont vérifiées en environnement isolé et ne constituent pas un déploiement.

- **LTX texte/image : API V2 asynchrone.** Soumission unique sur `api.ltx.io/v2`, identifiant et intention enregistrés dans les checkpoints existants, empreinte du contenu, reprise par GET, états terminaux, polling espacé et téléchargement sans transmettre le token fournisseur. Un POST à l’issue inconnue bloque la resoumission. Aucun fallback WAN après une soumission LTX potentiellement facturée. Les routes production, auto et create transmettent les checkpoints par scène. Retake/extend historiques restent des approximations à remplacer ; la migration complète de toutes les capacités LTX n’est pas certifiée.
- **Téléchargement commun.** HTTPS, DNS public vérifié puis épinglé à la connexion, contrôle de chaque redirection, refus des adresses privées/réservées et encodages IP ambigus, limite pendant la lecture, délai couvrant le corps, MIME et signature MP4. Utilisé pour LTX, WAN et les preuves vidéo. Les tests simulent le transport HTTPS ; la politique réseau effective du VPS reste à vérifier.
- **Rendu final mesuré et conservé.** Production, export, auto et create passent par `verifyAndStoreRenderedVideo` après le rendu existant. FFprobe mesure dimensions, FPS, durée et présence audio ; FFmpeg décode le fichier. La durée attendue vient du montage demandé, pas uniquement du retour fournisseur. Copie dans Storage sous un chemin par propriétaire et empreinte SHA-256 ; le checkpoint conserve le résultat vérifié. Une erreur de vérification ou de stockage ne donne pas de résultat « prêt ». Le mode auto silencieux passe également par un export : ce coût de rendu doit être inclus dans la réservation réelle avant activation.
- **Reprise create.** Réutilisation de la voix durable de production, checkpoints script/musique/scènes/rendu/vérification, refus d’une scène absente et vérification des écritures du média. Toutes les tâches parallèles se terminent avant le traitement de leur échec. Les fallbacks internes de musique et la transaction globale de quota restent à traiter.
- **Publication unique pour les trois routes historiques et l’autopilot create.** Authentification, propriétaire, compte externe et fichier vérifié sont contrôlés. Un état de soumission dans `videos.publish_data` est réservé par comparaison/mise à jour avant le fournisseur. Le rejeu retourne le résultat enregistré ou réconcilie par GET ; une issue inconnue ne renvoie pas un POST. Les historiques `social_posts` et `scheduled_posts` utilisent des identifiants stables et une sauvegarde contrôlée.
- **Contrat Zernio de publication.** `/v1/posts`, `mediaItems`, comptes externes, `Idempotency-Key`, mapping `x → twitter`, captions par plateforme et hashtags réellement inclus dans le texte. Les réponses 201/207 sont lues par compte. « Programmé », « en cours », « partiellement publié » et « publié » sont distincts dans les résultats et l’interface. Les schémas OpenAPI `PostCreateResponse` et `PostPublishIncompleteResponse` ont été relus. Cela ne valide pas le compte fournisseur réel ni le flux OAuth historique.
- **Anciens médias.** Une vidéo historique simplement marquée `ready` ne suffit plus : publication classique exige une vérification liée à son URL finale ; publication auto exige le checkpoint de vérification d’un job terminé appartenant au client. Les anciennes productions doivent être réconciliées et vérifiées, jamais relancées aveuglément.

Limites des fichiers : téléchargement de rendu limité à 64 MiB, durée vérifiable à 1 200 secondes, décodage à 60 secondes de temps écoulé. Les productions dépassant ces bornes échouent explicitement ; elles ne sont pas certifiées. La présence d’audio ne prouve pas la bonne synchronisation, le contenu distinct des deux pistes voix/musique, ni la lisibilité perceptuelle des sous-titres. Le stockage reste public selon le composant existant ; isolation privée, conservation réelle et sauvegardes non validées. Les ressources CPU/RAM globales nécessitent encore un worker isolé sur le VPS.

## Premier lot de corrections — état avant la seconde passe

| Domaine | Comportement préparé | Limite de la preuve |
|---|---|---|
| Cron | Les 20 routes passent par `assertCronAuth`, directement ou par alias. Secret absent, vide ou prévisible refusé ; comparaison constante à longueur égale ; journalisation sans valeur du secret. | Les tests invoquent les routes avec une autorisation invalide. La restriction réseau au reverse proxy du VPS reste à vérifier. |
| Montage autonome | Musique sans voix, sous-titres et éléments de marque déclenchent le montage. Une voix ou musique requise absente bloque le résultat final. Un montage échoué ne retourne plus l’URL brute comme succès. | La vérification de chaque piste dans le fichier cloud final reste à intégrer. |
| Reprise autonome | Checkpoints distincts pour vidéo, musique et voix ; intention de soumission persistée avant appel. Résultat inconnu : réconciliation obligatoire, sans nouvelle génération automatique. | La récupération distante d’une réponse perdue n’est pas implémentée pour tous les fournisseurs. |
| Shotstack | Identifiant de rendu sauvegardé avant polling ; reprise du même rendu dans production, export et auto. Intention sans identifiant : arrêt pour réconciliation. Logo transmis au montage. | Le pipeline `create` n’est pas encore entièrement raccordé à cette reprise. L’URL de résultat du fournisseur est temporaire. |
| Production | Une scène manquante bloque le montage. Voix découpée : manifeste et empreinte contrôlés ; pas de seconde synthèse pour remplacer des morceaux perdus. | Toutes les soumissions de scènes et de musique ne disposent pas encore d’un identifiant distant durable. |
| Sauvegarde | Route de production et worker utilisent la même sauvegarde. L’identifiant du job empêche de créer deux vidéos au rejeu. Le worker conserve le résultat final dans le checkpoint. L’export vérifie l’erreur DB et le propriétaire. | Une transaction complète reliant quota, job et média reste nécessaire. |
| Quotas | Erreurs RPC remontées. Un quota non confirmé après la fin du média déclenche un signal de réconciliation, sans remettre la génération terminée en file. | Réservation et règlement ne sont pas encore liés atomiquement à chaque job et à sa période. |
| File | Un `enqueue` dupliqué ne réinitialise plus le statut ou les checkpoints. Une clé réutilisée pour un autre utilisateur ou contenu est refusée. | Le verrouillage final et les RPC de bail nécessitent encore un contrôle SQL de propriété du bail. |
| Planification | Tous les créneaux d’une fenêtre de rattrapage/préparation sont examinés. L’occurrence est insérée avant les appels payants, puis envoyée au worker existant. | Insertion de l’occurrence, réservation et mise en file ne forment pas encore une transaction unique. Une interruption entre ces étapes peut laisser un orphelin. |
| Publication auto | Approbation et état contrôlés ; comptes lus côté serveur ; verrou de comparaison/mise à jour partagé entre action manuelle et cron ; résultat partiel distinct. | Les autres routes de publication et le contrat Zernio restent à unifier. Un verrou local n’est pas une preuve de publication distante. |
| OAuth | État lié à l’utilisateur vérifié et à un secret navigateur HttpOnly, expiration de dix minutes, consommation atomique unique. Aucun identifiant utilisateur extrait du `state` n’est accepté comme identité. | Migration SQL non exécutée. Le contrat fournisseur historique doit encore être remplacé par le flux Zernio documenté. |
| Configuration | Les comptes Zernio ne peuvent plus être injectés par le PATCH générique de configuration auto. | Vérification complète de toutes les routes sociales et des politiques SQL encore nécessaire. |
| Export | Export sans voix accepté ; plafond du plan vérifié avant réservation ; sauvegarde partagée avec le worker ; résultat du worker checkpointé. | Audio réellement présent, résolution finale et maintien des assets doivent encore être vérifiés. |
| Build | Exports non autorisés des routes Next.js supprimés ; constante NAMA conservée dans son module existant ; typage de reprise corrigé. | Des avertissements de dépréciation middleware/Edge restent présents. |
| Dépendances | Next.js et ESLint Next alignés sur 16.3.8 ; Sharp >=0.35.5 ; Source Map JS >=1.2.2. Alias de l’ancien paquet OpenTimestamps vers le paquet officiel 0.4.9. | Des avis modérés/faibles restent ouverts ; ce contrôle ne prouve pas l’absence de vulnérabilités applicatives. |

## Vérifications réellement exécutées

Sur une copie cloud isolée, sans secrets de production :

- Suite Node : **205 tests recensés, 204 réussis, 0 échec, 1 ignoré**. Le test ignoré est l’horodatage réseau réel OpenTimestamps.
- Trois scripts supplémentaires de la PR #2 réussissent : calendrier, exigence du montage final, publication/comptes.
- Les tests comprennent des fichiers vidéo synthétiques décodés par FFmpeg/ffprobe et un serveur de test sur loopback. Aucun modèle IA n’a été exécuté sur le Mac.
- Cas vérifiés : refus des 20 routes cron, montage musique sans voix, pistes absentes, interruption des morceaux voix, reprise Shotstack par identifiant, réponse distante incertaine, occurrences proches, conservation de la file, concurrence de publication, erreur de sauvegarde, OAuth interutilisateur/interplateforme/internavigateur/expiré/rejoué, et quota incertain après succès. La seconde passe ajoute LTX V2, reprise par identifiant, blocage de double soumission, DNS/redirections/flux médias, vérification et copie du rendu, refus de publication des anciens fichiers non vérifiés, concurrence, changement de version pendant publication et sauvegardes de publication, états 201/207 et identifiants de comptes.
- Compatibilité OpenTimestamps : une preuve d’attente fabriquée hors ligne avec l’ancienne version 0.4.5 est relue et sérialisée à l’identique par 0.4.9. Cela ne constitue pas une preuve d’ancrage Bitcoin.
- TypeScript complet réussi ; build Next.js 16.3.8 `--webpack` réussi avec avertissements.
- `git diff --check` réussi ; aucun conflit Git non résolu.
- `npm audit --omit=dev` : avant corrections, **3 critiques, 3 élevées, 8 modérées, 2 faibles** ; après corrections, **0 critique, 0 élevée, 8 modérées, 2 faibles**. Ces nombres désignent des dépendances signalées, pas un décompte de failles exploitables distinctes.

Commande de la suite exécutée :

```sh
node --import tsx --test scripts/test-api-contracts.mts scripts/test-env-contracts.mts scripts/test-local-engine.mts scripts/test-shotstack-contracts.mts scripts/test-production-queue.mts scripts/test-auto-export-queue.mts scripts/test-release-regressions.mts scripts/test-local-engine-e2e.mts scripts/test-video-contracts.mjs scripts/test-opentimestamps.mjs scripts/test-ltx-v2-media.mts scripts/test-social-publication.mts
node scripts/test-auto-schedule.mjs
node scripts/test-auto-composition.mjs
node scripts/test-auto-publication.mjs
```

**Installation et portée du build.** Le `npm ci` initial n’a pas abouti : dépendance privée Git SSH et configuration ESLint externe au dépôt. Les vérifications utilisent un environnement séparé de dépendances de registre, aux versions du lockfile, et le source SMARANA du commit verrouillé `bc3469eb595485714b2044790105acfc5e3b0f31`, récupéré par l’accès GitHub autorisé. Aucun source privé SMARANA n’est ajouté à cette branche. Les dépendances privées imbriquées ne constituent pas une reproduction certifiée d’un `npm ci` complet. Le lint officiel n’est pas validé : le paquet partagé `../packages/eslint-config-purama` n’est pas disponible dans cette copie. Il faut rendre cette installation reproductible en CI avant intégration.

Les tests Stripe live, Supabase distant, stockage distant, fournisseurs IA et publication réelle n’ont pas été exécutés. Les migrations n’ont pas été répétées sur une base jetable. Les tests navigateur authentifiés, mobile, charge et isolation multiclient ne sont pas certifiés.

## Accès et hébergement

La cible reste le VPS OVH, sans activation de service ni réabonnement Vercel. Le contrôle HTTP de `https://sutra.purama.dev` retourne **402**, en-tête serveur **Vercel**. Ce constat concerne le domaine historique ; il ne détermine pas l’état d’un éventuel déploiement OVH à une autre adresse.

L’historique mentionne une migration OVH et un blocage Supabase à diagnostiquer, mais aucun accès SSH opérationnel n’est disponible dans cette session. Les accès Mac restent indisponibles. L’état réel des conteneurs, du reverse proxy, des sauvegardes, des tâches cron et de la base n’est donc pas vérifié. Aucun serveur n’a été redémarré et aucun volume n’a été touché.

## Blocages de mise en service prioritaires

1. **Coordination et environnement réel.** Lire les deux `LOCKS.md`, les handoffs et les worktrees du propriétaire ; rapprocher N8-0130, P8-F5-0135, P8-2254 et P8-2350. Identifier un seul responsable par chantier. Vérifier la cible OVH et l’état Supabase avant toute opération distante.
2. **Connexion Zernio encore bloquante.** Publication migrée vers `/v1/posts`, mais `/oauth/url`, `/oauth/exchange` et la gestion historique des tokens doivent être remplacés par le flux officiel à profils clients. Les anciens identifiants non conformes sont refusés et demandent une reconnexion. Vérifier propriété du profil, permissions, disponibilité de chaque plateforme, quotas, révocation, webhooks authentifiés et limitations du compte réel. Une publication auto encore « en cours » ne dispose pas encore de réconciliation autonome complète.
3. **Contrat SQL de publication à valider.** Les trois routes classiques sont unifiées et ne créent plus un faux succès. Leur verrou utilise `videos.publish_data` et `shotstack_json` comme JSONB, avec comparaison de la valeur antérieure. Il faut confirmer les types, index, permissions et contraintes effectifs, empêcher les clients de modifier les preuves/états serveur et éprouver la concurrence sur PostgreSQL. Les doublures des tests ne prouvent pas le comportement du SQL distant. Un seul compte par plateforme est sélectionné ; plusieurs comptes nécessitent un choix explicite, jamais un choix silencieux.
4. **LTX V2 partiellement intégré.** Texte et image utilisent désormais soumission/polling/téléchargement V2 avec tests sans génération payante. Les fonctions historiques `retakeVideo` et `extendVideo` restent une variation de prompt et une continuation depuis une image : elles ne doivent pas être présentées comme les opérations `/v2/retake` et `/v2/extend`. Audio-vers-vidéo, modèles supplémentaires, coûts réels, annulation et webhooks restent à vérifier avant d’élargir le contrat. V1 est annoncée arrêtée après le 26 octobre 2026 à 23:59 UTC.
5. **Reprise et coût au-delà de LTX.** Create réutilise maintenant les checkpoints voix et rendus, et LTX peut reprendre le même job. Les réponses perdues sans identifiant sont bloquées. WAN, les plans LLM et la chaîne de fallback musique demandent encore une réconciliation complète et des règles de facturation. Une erreur d’un fournisseur musique ne démontre pas qu’aucune dépense n’a été faite avant le fournisseur suivant. Aucune garantie globale « exactement une fois » n’est établie.
6. **File et quota SQL.** Rendre atomiques création du job/réservation, règlement final et annulation. Contrôler le propriétaire et l’expiration du bail à chaque checkpoint/finalisation, plafonner les tentatives dans toutes les variantes de claim et gérer le changement de mois. Une réserve agrégée par utilisateur ne suffit pas à prouver un règlement unique par job.
7. **Qualification du fichier et perception.** Vérification physique et copie sont raccordées aux quatre pipelines ; les anciens checkpoints non vérifiés sont bloqués. Il reste à mesurer synchronisation et contenu audio, lisibilité réelle des sous-titres, fidélité aux références, codecs/bitrate et qualité perceptuelle sur des médias représentatifs. Une résolution finale mesurée n’est pas une génération native 4K. Les plafonds actuels de taille/temps doivent être adaptés aux longs formats dans un worker isolé.
8. **Conservation effective des médias.** La copie vérifiée remplace maintenant l’URL temporaire Shotstack dans les résultats finaux des nouveaux parcours. Vérifier le bucket réel, ses politiques, la restauration, la rétention, les URLs signées et les anciennes URLs déjà expirées. Le succès d’un mock Storage ne prouve pas l’état du stockage de production.
9. **Couverture SSRF restante.** LTX, WAN et horodatage partagent le nouveau téléchargement contrôlé. Il reste à inventorier et raccorder les autres importateurs/fournisseurs, vérifier le filtrage réseau du VPS et l’isolation CPU/RAM des workers, puis éprouver les fichiers malformés supplémentaires. Le stockage privé et l’isolation multiclient effective ne sont pas certifiés.
10. **Isolation SQL et tokens.** Les politiques effectives de la base ne sont pas accessibles. Vérifier les schémas `public`/`sutra`, la propriété de chaque ligne, les organisations, les budgets, les comptes, les secrets fournisseurs et les statistiques. Le durcissement du state OAuth ne certifie pas le chiffrement, la rotation ou la révocation des tokens historiques.
11. **États historiques et migrations.** Répéter les migrations v10, occurrences et OAuth sur une base jetable issue d’un schéma représentatif. Inventorier les statuts et doublons avant les contraintes ; ne supprimer aucune ligne historique pour faire passer un index. La migration des occurrences est transactionnelle dans ce lot pour éviter un schéma partiellement modifié en cas d’échec.
12. **Parcours client.** Vérifier authentification web/mobile, endpoints et méthodes utilisés par l’app mobile, approbation, erreurs récupérables, édition et bibliothèque. Le build ne remplace pas ces tests.
13. **Dépendances restantes.** Avis sur `bn.js`, `moment`, `request`/ses wrappers, `uuid`, `dompurify`, `elliptic`, et leurs dépendants. Certains n’ont pas de correction directe compatible. Analyser l’atteignabilité et remplacer la chaîne concernée avec tests de preuves ; ne pas appliquer une mise à jour majeure forcée ni annoncer « zéro vulnérabilité ».
14. **Capacités promises.** Les parcours vidéo, voix, musique, sous-titres, bibliothèque et auto ont du code existant. Un podcast complet, chansons avec paroles, doublage intégral, extraction de courts depuis un long, campagnes multimarques et autonomie exhaustive ne sont pas démontrés par cette suite. Leur absence ou achèvement doit être établi par scénario utilisateur avant création d’un nouveau module.

## Contrat d’orchestration à finaliser dans la file existante

Conserver `video_jobs`, les pipelines existants et `progress`. Une création possède un état métier ; ses tâches techniques et ses publications par compte possèdent leurs propres checkpoints. Aucun moteur concurrent.

- Progression métier proposée : `draft → planning → generating_script → generating_assets → compositing → verifying → pending_approval/ready → scheduled/publishing → partially_published/published`.
- Budget insuffisant : `awaiting_budget`, sans soumission payante. Reprise seulement après réservation confirmée.
- `pending_approval → ready` exige une approbation authentifiée ; `ready/scheduled → publishing` exige un fichier vérifié, une échéance atteinte et les comptes autorisés.
- `partially_published` n’autorise que les destinations restantes. Une réponse distante inconnue bloque le rejeu et exige réconciliation.
- Les transitions d’échec/reprise/annulation/expiration doivent être une table autorisée et contrôlée côté serveur. Le redémarrage ne réinitialise pas les tâches déjà facturées.
- Migration des anciens `generating_video`/`generating_audio` vers `generating_assets` seulement avec conservation du sous-état et des données. `compositing_failed` demande une analyse de l’erreur et du job distant avant tout classement « réessayable ». Un statut inconnu doit être conservé et examiné.
- Chaque opération payante : clé logique stable, empreinte du contenu, fournisseur/modèle/version, identifiant distant, état distant, réservation et période, sortie vérifiée, reçu/coût réel, historique et règle de reprise. L’idempotence ne doit être activée que si le fournisseur la documente.
- Les tâches autonomes s’arrêtent à la limite d’autorisation ou de budget. Une erreur de base n’est jamais une preuve de réussite.

## Critères de finalisation mesurables

Une version utilisable doit démontrer les parcours requis sur la cible OVH, avec dossiers de test anonymisés et résultats conservés :

1. Deux clients ne peuvent consulter ou modifier aucun média, job, compte, budget ou statistique de l’autre.
2. Coupure avant/après chaque soumission et checkpoint : aucun succès inventé, aucune soumission payante répétée lorsque l’issue est inconnue.
3. Musique sans voix, voix sans musique, silence demandé, sous-titres, logo, intro/outro : toutes les combinaisons requises arrivent au résultat attendu ou à une erreur explicite.
4. 16:9, 9:16 et 1:1 : dimensions et décodage réellement mesurés. Enregistrer séparément génération native, source, amélioration, demande de rendu et mesure finale.
5. Publication : autorisation valide, validation distante, doublons, comptes déconnectés, expiration, succès partiel et reprise par compte.
6. Déploiement reproductible, sauvegarde restaurable, retour arrière testé, disponibilité du worker et supervision. Aucune dépendance opérationnelle à Vercel si le VPS est la cible retenue.
7. Mesurer temps d’interface, attente en file, p50/p95 des générations et exports, taux d’échec/récupération, coût réel par résultat accepté et jugement de qualité à l’aveugle. Ces mesures ne sont pas encore produites.
8. Comparer les concurrents sur les mêmes briefs, formats, contraintes, répétitions et budgets. Aucune supériorité universelle ni latence nulle n’est établie par cet audit.

## Sources officielles consultées

- Next.js, hébergement autonome : https://nextjs.org/docs/app/guides/self-hosting
- Next.js 16.3.8 et correctifs : https://github.com/vercel/next.js/releases/tag/v16.3.8
- Avis Sharp : https://github.com/advisories/GHSA-wq5f-xc86-pv6w
- OAuth, RFC 9700, état et liaison au navigateur : https://www.rfc-editor.org/rfc/rfc9700.html
- LTX, migration V1/V2 : https://docs.ltx.io/migrate-v1-to-v2
- LTX, jobs asynchrones : https://docs.ltx.io/async-jobs
- LTX, retake : https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-retake
- LTX, extend : https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-extend
- Zernio, connexion : https://docs.zernio.com/guides/connecting-accounts
- Zernio, isolation des clients : https://docs.zernio.com/multi-tenant
- Zernio, index des contrats : https://docs.zernio.com/llms.txt
- Zernio, création de post : https://docs.zernio.com/posts/create-post
- Zernio, idempotence : https://docs.zernio.com/guides/idempotency
- Zernio, OpenAPI : https://docs.zernio.com/api/openapi
- OWASP, prévention SSRF : https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- Shotstack, API : https://shotstack.io/docs/api/
- Shotstack, durée de conservation : https://shotstack.io/docs/guide/architecting-an-application/temporary-files/
- OpenTimestamps, renommage officiel : https://github.com/opentimestamps/javascript-opentimestamps

Les documentations décrivent les contrats fournisseurs. Elles ne prouvent pas l’accès du compte SUTRA, ses quotas, sa facturation ou un résultat réellement obtenu en production.

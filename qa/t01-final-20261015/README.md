# SUTRA — livraison T01 du 15 octobre 2026

## Versions et verdict

- Candidat exact en recette : `d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2`, branche `codex/sutra-final-providers-20261013`, poussé.
- [CI exacte 38677062190](https://github.com/puramapro-oss/sutra/actions/runs/38677062190) : **SUCCESS : qualité, contrats et base PASS**. Les deux gardes rouges du candidat précédent restent documentés dans `ci-a520114-tests.json`.
- Déployé OVH : `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164`, [SUTRA](https://sutra.purama.dev). Le contrôle 03:40 UTC confirme image/source/démarrage inchangés, healthy, zéro redémarrage et cinq smokes HTTP PASS.
- Image candidate isolée : `sha256:57474bc6221abe05455c3103530daa1582db162fa4acd94239063e328ad95d55`, cinq smokes HTTP et FFmpeg PASS, réseau désactivé, conteneur candidat arrêté. Ce n'est pas un déploiement.
- Promotion BLOQUÉE : CI complète PASS, mais revue indépendante T08 exacte absente. La demande utilisateur de validation T08 est conservée. T08 original inaccessible via le transport des terminaux (MacDevBridge -32603) ; relais déjà demandé, aucun ACK présumé ou remplacé par la CI T01.

Les commits ultérieurs de reçus ne remplacent pas ce SHA applicatif. Les 1034 fichiers du manifeste doivent rester identiques au commit testé.

## Livraisons et défauts

Les sept livraisons ont été importées par deltas/blobs vérifiés, sans fusion aveugle. La base produit commune était `49c166d`, équivalente à `3855665` ; T08 était sur `3855665`.

| Terminal | Commit livré | Correction ou preuve intégrée |
|---|---|---|
| T02 | `5822770c2280b6498039305429578d47280a7f3e` | Autorité/provenance avant signature de média privé. |
| T03 | `ee3f7017da762c72163440706064ad08df84f761` | Résultats durables, checkpoints, ACK, annulation et reprise. |
| T04 | `6ba23d4c31e4a511997b260ecb49e71ace293b2e` | Préparation conteneur Salad désactivée, contrats et lecture fournisseur. |
| T05 | `44cbbab40e20f65d0506c18af253218055884c46` | Slots FFmpeg, concurrence/délai total, exports CPU réels. |
| T06 | `10693a2096c8b193d9adf034f1863966c212c393` | Revalidation OAuth, révocation idempotente, purge des anciens tokens. |
| T07 | `c72188a221588402498f10248f181cffe32bee1e` | Erreurs sociales explicites, dialogues accessibles, double soumission auth, montage/navigation. |
| T08 | `3e49d038d6f87ab5ea61251a7aeee3c83b42ca50` | Preuves indépendantes historiques, annulation C04 inchangée, matrice72 exigences. Revue du candidat final non reçue. |

[RECONCILIATION.md](RECONCILIATION.md) rattache les douze FAIL de la dernière matrice T08 à leurs propriétaires/correctifs. Les chiffres historiques4FAIL/3BLOQUÉS/9NONTESTÉS sont dépassés : la dernière matrice T08 portait45PASS/12FAIL/2BLOQUÉS/13NONTESTÉS sur3855665. Elle reste conservée, sans faux verdict T08 sur d21b7b4.

T01 a ajouté trois migrations canoniques et les gates exactes de promotion. Deux fixtures contrats incompatibles ont été corrigées en conservant les exigences métier ; le harnais WebKit a été borné par des contrôles HTML natifs. Aucun code produit n'a été changé pour faire disparaître un diagnostic moteur. CI48eb91a, CIed12d9c et CIa520114 restent FAIL dans leurs preuves historiques.

## Commandes et résultats du candidat exact

Ces groupes se recouvrent : aucun grand total additionné. Les fichiers .log originaux restent dans les artefacts GitHub et dans la copie locale ; seuls les reçus nécessaires sont versionnés.

| Commande | Résultat | Portée |
|---|---|---|
| `npm run check` | PASS dans la CI | TypeScript, lint, build. |
| `npm run test:contracts` | PASS | Groupe principal955PASS/0FAIL/7SKIP ; durable-submission18PASS ; planification/composition/publication simulées PASS. |
| `npm run test:media` | PASS | Groupes49/12/32/25/3/31PASS ;0FAIL/0SKIP.17exports CPU frais du lot final, sans IA. |
| `node qa/t08/run.mjs redteam` | PASS | Contrats sécurité/offline et charge locale simulée. |
| `npm run test:migration-local` | PASS | PostgreSQL16 jetable CI, aucune DB production. |
| `node --import tsx --test scripts/test-pipeline-postgres.mts` | PASS |16tests concurrents PostgreSQL. |
| `node scripts/test-security-rls.mjs` | PASS |261assertions RLS. |
| `node scripts/test-final-write-permissions.mjs` | PASS |30tests permissions SQL. |
| `node scripts/test-final-social-history.mjs` | PASS |23tests historique social. |
| `node --import tsx --test scripts/test-salad-persistence.mts` | PASS |7tests journal isolé, concurrence, artefacts immuables. |
| Régressions durables/OAuth PostgreSQL (commande complète dans workflow et reçu CI) | PASS |46tests sur4fichiers. |
| `node qa/t08/run.mjs browser-redteam` | PASS |210contrôles,165analyses axe sans violation ; cinq largeurs320/375/768/1280/1440 ; identité synthétique. |
| `node qa/t07-frontend-fixes-20261014/browser.mjs --production` | PASS | Bibliothèque et consentements,25assertions. |
| `node qa/t07-final-ux-perf-20261015/run.mjs --final-integrated` | PASS |20familles Chromium/WebKit desktop/mobile, une build ; par moteur22/10/9/15/34/9/31/5/3/4assertions PASS,0FAIL. |
| `node scripts/run-ci.mjs legacy` | PASS |1022PASS/0FAIL/25SKIP,0flaky. |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` | PASS |77tests,0FAIL/0SKIP. |
| `python3 -m unittest discover -s qa/t01-consolidation-20261014 -p 'test_*.py'` | PASS |25tests,0FAIL/0SKIP. |
| `python3 qa/t01-final-20261015/social-history-transition-test.py` | PASS |12tests,0FAIL/0SKIP. |
| Simulation promotion du candidat exact (commande inline dans reçu CI) | PASS |8tests,0FAIL/0SKIP ; recouvre le groupe77. |
| `npm audit --omit=dev --audit-level=high` | PASS AU SEUIL HIGH |0high/critical ;2low/5moderate encore signalés. |
| `node --test qa/t01-final-20261015/browser-harness/guard.test.mjs` | PASS LOCAL |56PASS/0FAIL/0SKIP, contrôles HTML natifs et négatifs ; mêmes sources qued21b7b4. |
| ESLint ciblé du harnais/runner | PASS LOCAL |Même delta ; aucun code produit modifié. |
| `python3 deploy/candidate.py --source-ref d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2` | PASS OVH ISOLÉ |Build exact, cinq smokes sans réseau et FFmpeg. |

Les7SKIP contrats sont préexistants : quatre appels INSEE live, deux écritures DB live historiques, un appel réseau OpenTimestamps. Aucun nouveau skip ni transformation d’un rouge en skip. Les25SKIP legacy sont détaillés avec titres et sources dans `ci-d21b7b4-tests.json` :10répétitions API hors desktop,1desktop-only,2mobile-only,6parcours limités par mur auth et6annotations sans description. Ils ne sont pas additionnés aux contrats.

Les reçus `ci-d21b7b4-tests.json`, `ci-d21b7b4-database.json` et `ci-d21b7b4-status.json` conservent commandes exactes, empreintes d’artefacts et compteurs séparés. Les diagnostics WebKit bruts sont conservés :5planning,111journey,48social,20extra,16legal, tous qualifiés par les contrôles natifs du harnais ;0erreur inattendue/DOM dans les vingt familles. Cette qualification n’est pas une certification CORS/Safari en production.

L’audit des dépendances conserve sept alertes de la chaîne javascript-opentimestamps/bitcore-lib/elliptic/request/uuid. Le correctif proposé par npm est une rupture vers opentimestamps@0.0.0 ; aucune mise à jour forcée effectuée. Le seuil high/critical PASS ne signifie pas zéro vulnérabilité. Les trois avis et la chaîne concernée sont référencés dans le reçu.

Les anciens FAIL restent consultables : CI48eb91a38669067659 (deux fixtures contrats et cinq gardes WebKit), CIed12d9c38671657736 (un garde social WebKit), CIa52011438674263839 (profil synthétique au départ du document, HEAD classé à tort comme écriture). Leurs résultats ne sont pas réécrits par les corrections ultérieures.

## Base, migrations et rollback

Aucune migration de ce lot n'a été appliquée à la production. Les trois migrations ont été essayées/rejouées/annulées sur une copie privée OVH et sur PostgreSQL jetable :

1. `20261015_final_durable_integrity.sql` : six fonctions, résultats terminaux/checkpoints, concurrence et ACK.
2. `20261015_client_write_permissions.sql` : permissions DML/colonnes et RLS client bornées.
3. `20261015_social_authorization_history.sql` : historique social atomique append-only, conservé au rollback.

Sauvegarde 01:10 UTC : six artefacts protégés,141tables restaurées et comptages égaux, quatre contrats de schéma comparés. Identités auth complètes et gel atomique des blobs NON PROUVÉS ; aucune promesse de restauration globale Supabase. La gate refuse une sauvegarde de plus de quatre heures. Une nouvelle sauvegarde est donc obligatoire si la promotion reprend après05:10UTC.

La promotion compare SHA, CI, manifeste, migrations, état live, image et reçus avant mutation. Le rollback utilise une comparaison de l'état attendu avant remplacement ; une issue SSH incertaine exige une réconciliation, jamais une répétition aveugle. Les trois receipts apply n'existent pas encore pour d21b7b4 ; les commandes ci-dessous restent bloquées tant que les conditions ne sont pas remplies :

```sh
python3 qa/t01-consolidation-20261014/checkpoint-transition.py apply --source-ref d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2 --ci-run 38677062190 --proof-dir qa/t01-final-20261015
python3 qa/t01-final-20261015/client-permissions.py apply --source-ref d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2 --ci-run 38677062190
python3 qa/t01-final-20261015/social-history-transition.py apply --source-ref d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2 --ci-run 38677062190
python3 deploy/ovh.py deploy --source-ref d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2 --ci-run 38677062190 --schema-ready --proof-dir qa/t01-final-20261015
```

Rollback applicatif exact, utilisable seulement après création du snapshot certifié de cette promotion :

```sh
python3 deploy/ovh.py rollback --source-ref d21b7b4cdaf4d0a7699560af78cdd38cfb20d2b2
```

Il restaure image/configuration précédentes et ne modifie ni DB ni DNS. Les rollbacks SQL séparés restent soumis aux états et reçus de leurs helpers ; ne pas exécuter une commande nue sur la base partagée. Aucun autre service n'a été redémarré par T01.

## Fournisseurs et configuration réelle

Preuve `provider-runtime.json`, lecture authentifiée depuis le runtime86d04c8 à01:58UTC, zéro soumission :

| Fournisseur | Preuve réelle | Limite |
|---|---|---|
| RunPod | GET health de l'endpoint autorisé200, contrat valide. | Zéro worker ; soumission/modèle/génération NON TESTÉS. Le401 du listing global n'est pas pertinent pour cette clé restreinte. |
| Shotstack | GET templates stage etv1,200, contrats valides. | Stage sélectionné ; aucun rendu effectué. |
| Suno | API tierce sunoapi.org, crédit200, contrat valide/crédit disponible. | Ce n'est pas l'API officielle Suno ; musique NON TESTÉE. |
| Zernio | Profil PURAMA unique, ownership serveur Matiss et binding vérifiés ;200. | Zéro compte social connecté ; aucun consentement personnel/publication. |
| Salad | Adaptateur/container et contrôles simulés intégrés. | Clé master malformée, jamais envoyée/copiée ; organisation/projet/gateway/token worker non prouvés. Image CUDA/GPU réel NON TESTÉS, mode désactivé. |

Provenance sans valeurs : `config-provenance.json`. Master sécurisé0600 ; RunPod key et clés Shotstack correspondent au runtime. RUNPOD_ENDPOINT_ID et Suno correspondent au master après normalisation des caractères de bord documentée dans le reçu ; les valeurs applicatives prioritaires ont été conservées. La variable Suno effectivement consommée est SUNO_API_BASE_URL. Origine SUTRA, Suno, cron et secrets app prioritaires conservés ; aucun écrasement aveugle. Variables Supabase proviennent de la configuration app existante. Binding Zernio provient de l'identité/ownership serveur vérifiés, pas d'une identité devinée. Aucune rotation ni secret commité.

## Fonctions réellement testées et limites

- Exports FFmpeg CPU : encodage/décodage de17cas frais avec entrées synthétiques dans le lot final médias ; ni génération IA ni preuve qualité4K native.
- Contrats API clients, pipeline/reprise/annulation, médias privés, sécurité OAuth/cron, publication et planification simulées : preuves CI exactes. Aucun flux continu DB réelle→fournisseur payant→publication réelle.
- Public actuel86d04c8 : parcours navigateur desktop1440/mobile375 du14oct04:14UTC réutilisés puisque source/runtime inchangés, reçu `../final-delta-20261014/public-browser-final.json`. Redirection auth, erreur callback, formulaire invalide et absence de débordement testés ; zéro session personnelle et zéro mutation envoyée.
- Parcours Chromium/WebKit desktop/mobile : identité et services synthétiques ; le résultat CI exact distingue chaque famille. Ce n'est pas une session personnelle Matiss ni Safari/iOS natif.
- Mode propriétaire : GPU distant open source, pas local Mac, pas gratuit. Pas de promesse de pipeline intégralement open source ni capacité24Go qualifiée. Aucun modèle démarré sur Mac ; aucun repli payant implicite validé.
- Cron/exécuteurs : infrastructure exécutante absente ET désactivation volontaire des tâches génératrices/publicatrices. Observateur lecture seule testé, non installé en service permanent. Files observées vides ; aucune autonomie cron revendiquée.
- `/create` n'expose pas une annulation durable serveur ; interrompre son fetch local ne prouve pas l'arrêt fournisseur. Le contrat `step=cancel` est testé séparément.
- Logs/base à02:21UTC : conteneur sain, zéro erreur observée dans la fenêtre, zéro index invalide/transaction longue. L'absence d'erreur sur cette fenêtre n'est pas une garantie générale.
- DNS/TLS02:05UTC : autorités Cloudflare et deux résolveurs concordants vers OVH, TLS1.3/SAN valide. DNS-only observé ; API Cloudflare non interrogée faute de credential dans la source autorisée. Aucun changement DNS.
- Qualification CORS du harnais limitée aux fixtures ; réserve indépendante dans `browser-harness/review-a520114.md`. Toutes les erreurs brutes restent disponibles.

## Parcours et exigences restant ouverts

Les routes disponibles sont `/login`, `/library`, `/create`, `/editor/[id]` (identifiant issu de la bibliothèque), `/auto/schedules` et `/settings/social`. Leur présence ne certifie pas une session personnelle ni un job fournisseur. Après connexion, les consentements légaux doivent être accomplis personnellement. Ne pas lancer une génération ou une publication pour vérifier simplement la navigation.

| Exigence T08 | État de cette livraison et limite |
|---|---|
| R30 ordonnanceur autonome | BLOQUÉ : exécuteur absent, fonctions génératrices/publicatrices désactivées volontairement. |
| R47 revue indépendante finale | BLOQUÉ : CI du candidat distincte de la revue demandée à T08 ; aucun ACK reçu. |
| R43 accès fournisseurs | TESTÉ T01 en lecture depuis le runtime existant ; R43 historique T08 n'est pas réécrit en validation indépendante. |
| R02 OAuth personnel ; R45 publication réelle | NON TESTÉS : nécessitent consentements personnels ; aucune publication autorisée ici. |
| R07 coût consommé ; R44 GPU24Go | NON TESTÉS : aucune ressource facturable ni budget d'essai autorisé. |
| R18 qualité IA ; R34 chaîne DB→rendu→publication | NON TESTÉS : tests CPU, SQL et services simulés restent des preuves distinctes. |
| R32 sécurité exhaustive | NON TESTÉE : les contrôles bornés PASS ne garantissent pas l'absence de tout défaut. |
| R36 alertes ; R38 SLA/charge distante | NON TESTÉS : aucune alerte délivrée ni qualification SLA réelle. |
| R41 lecteur écran/parcours manuel complet | NON TESTÉ : clavier/focus/axe automatisés ne remplacent pas cette recette. |
| R62 restauration Supabase complète | NON TESTÉE : identités/sessions complètes et blobs atomiquement gelés hors preuve. |
| R63 migration/rollback production | NON TESTÉS : uniquement copie privée et simulations, aucune promotion de ce lot. |

Les corrections R66/R67/R72 ne protègent pas encore le runtime courant : leurs migrations sont préparées et testées, mais non appliquées en production. Aucune revendication de clôture de ces défauts sur le site public.

## État des terminaux

T02, T03, T04, T05, T06 et T07 : FIN_ECRITURE, livraisons intégrées, commits et worktrees préservés. T08 : livraison historique intégrée, revue du candidat exact encore attendue. T01 : campagne exacte terminée PASS, reçus consolidés ; promotion non effectuée, en attente T08. Le reçu `preservation-final-d21b7b4.json` vérifie neuf worktrees auteurs/historiques propres, leurs HEAD inchangés, les sept empreintes WIP étrangères et les 1034 fichiers du manifeste. Aucun terminal fermé ; aucun statut FERMABLE global déduit de ces seuls contrôles.

## Actions indispensables

1. Obtenir la revue indépendante T08 sur **d21b7b4** et la CI38677062190, suivant [SMOKE-T01](../t08-final-candidate-20261015/SMOKE-T01.md). T01 reprend ensuite les gates et la promotion autorisée ; aucune nouvelle permission de déployer n'est nécessaire.
2. Pour activer ultérieurement Salad : remplacer la valeur malformée du master par une clé API valide depuis [Salad Portal](https://portal.salad.com/). T01 pourra alors rechercher en lecture seule les organisations/projets existants ; un choix utilisateur ne sera nécessaire que si leur propriété ou sélection reste ambiguë. La configuration demeure désactivée avant ressource et budget chiffré explicitement autorisés.
3. Pour les réseaux souhaités : consentements personnels depuis [SUTRA social](https://sutra.purama.dev/settings/social), selon le [parcours officiel Zernio](https://docs.zernio.com/guides/connecting-accounts). Aucun consentement accepté au nom de Matiss.

Aucune dépense, génération payante, publication réelle ou fermeture de terminal. Les travaux/commits/worktrees restent conservés. Les limites non testées ne sont pas transformées en succès.

## Revue du commit de preuves

GitNexus staged : fichiers de reçus/docs uniquement, aucun symbole indexé recoupé. Comparaison historique main :3467fichiers/2862symboles/99flux, risque CRITICAL, liste tronquée et index ancien ; aucune certification exhaustive revendiquée. Vérification directe :1034fichiers du candidat identiques aux empreintes testées, sept WIP étrangers préservés, neuf worktrees auteurs/historiques inchangés. Gitleaks staged PASS et diff-check PASS. Le commit de preuves ne remplace pas le SHA applicatif d21b7b4 et ne justifie pas une nouvelle campagne complète.

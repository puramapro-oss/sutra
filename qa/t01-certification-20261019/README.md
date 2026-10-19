# SUTRA T01 — candidat de certification du 19 octobre 2026

**INTEGRÉ / contrôles locaux bornés — CERTIFICATION BLOQUÉE.** Ce dossier accompagne le nouveau commit descendant de `ab935e59ca4e39776630f05b2ba6c0422c74ec62`. Le SHA exact et la CI post-commit seront consignés dans le registre partagé `T01-CERTIFICATION-20261019.md`, sans réécrire ce candidat après les demandes d'ACK. Aucun ACK propriétaire n'est transféré automatiquement au nouveau SHA. Aucun redéploiement, redémarrage OVH, migration distante, achat, GPU, publication ou appel fournisseur payant n'a été effectué par T01.

## Intégration et conservation

Worktree isolé : `sutra-certification-integration-20261019`, branche `codex/sutra-certification-integration-20261019`. Le worktree T01 historique est resté sur ab935. `wip-preserved.json` vérifie ses 3108 chemins WIP : aucun manquant ni modifié. Les worktrees, branches et cinq ancêtres historiques protégés sont conservés. Aucun reset, stash, clean, merge forcé ou fermeture de terminal.

`baseline/manifest-verification.json` : **1160 chemins uniques, 1160 blobs conformes à ab935 et au produit initial, zéro écart**. Le champ historique `base=7d96b38` est antérieur au commit, mais les empreintes correspondent à ab935. `tested-source-manifest.json` et `baseline-delta.json` décrivent le nouveau contenu ; les 19 modifications de chemins du manifeste historique sont expliquées ci-dessous, aucun fichier historique ne manque. Les nouveaux tests et la migration sont ajoutés au manifeste, les reçus mutables en sont exclus.

`integrated-owners.json` conserve chaque SHA, parent, chemin, blob Git et SHA256 livré. Les fichiers ont été rapprochés manuellement des contrats puis intégrés depuis les blobs committés, jamais depuis un WIP tiers.

| Responsable | Livraison exacte | Décision et preuve |
|---|---|---|
| T02 | `2b69a8feabb0e82e34939d96cb5176116baa244d`, puis `fee35754890b442086e9dd4bbf069ca4c1e992b6` | Setup réservé au propriétaire, diagnostics publics expurgés, contact borné, QR/scan refus fermé. Le scan a ensuite reçu le raccord atomique T01 ; les anciens mocks count/insert restent des preuves historiques, pas des tests de la nouvelle RPC. |
| T03 | `fd8c92837b595cc51d60bb8ef74ff8ada565b4b8` | Livraison QA, aucun delta produit. ACK borné sur ab935, 211 cas distincts. Qualification R107 demandée au propriétaire, sans réponse à la clôture locale. |
| T04 | `62bb57f94525e6e4063d2209436da911c6f96d8b` | Stock : erreurs explicites, URL HTTPS stricte, taille/délai bornés, Coverr Bearer. 20 tests propriétaires intégrés au runner. |
| T05 | `b18360607df42fee24c048d554054681199a720d` | Livraison QA, 26 tests frais synthétiques ; 17 MP4 CI rehashés/redécodés, deux exports CPU. Média invariant ; aucune nouvelle génération. |
| T06 | `46870824d434dfbfc8d7c87e899e7e57ae0a9d9a` | Six composants : dialogue accessible, destinations valides, états incertains non rejoués, retry limité aux échecs, dates IANA/DST, erreurs expurgées. |
| T07 | `8becf38d5f5c35b706eee9061d47bf16d679c838` | Livraison QA, 32 contrôles, huit redémarrages PostgreSQL privés. Réserve R107 réelle ; 308 invocations manuelles ne prouvent pas un worker autonome. |
| T08 | `97c288e37cfd6c2e53d971d1ef2b14ad805f1798` | Revue indépendante ab935 : **79 PASS / 12 FAIL / 6 BLOQUÉS / 12 NON TESTÉS**. Ce décompte remplace l'ancienne matrice ; il ne certifie pas le nouveau candidat. |

Les attestations originales T03/T05/T07 et la matrice T08 sont archivées sans modification dans `owner-attestations/`. Les NACK T02/T04/T06 sont conservés dans leurs dossiers livrés. **ACK du nouveau candidat : T02, T03, T04, T05, T06, T07 et T08 tous EN ATTENTE**, tant qu'une réponse personnelle datée n'est pas reçue. Un message de T01 ou une CI verte ne vaut pas attestation.

## Corrections T01 et couverture

- Coverr : présence de `COVERR_API_KEY` exigée par le registre ; sonde administrative authentifiée seulement si configurée. Le contrat officiel impose Bearer : <https://api.coverr.co/docs/auth/>. Contre-test rouge 2/4 puis vert 4/4, sans réseau.
- Quota partenaire : l'ancien SELECT-count/INSERT acceptait deux requêtes concurrentes à 99/100. La nouvelle RPC `record_partner_scan` verrouille le partenaire, utilise la colonne canonique `scanned_at`, conserve les quotas existants (100/partenaire/24 h, un IP/partenaire/24 h), refuse toute erreur sans cookie. Pas de mutation financière. Route 9/9 ; PostgreSQL 10/10, dont 20 requêtes concurrentes à 99 et 20 requêtes de même IP. Le test de permission a d'abord échoué sans les privilèges artificiels de fixture ; la migration accorde maintenant les droits serveur minimaux et aucun droit client.
- WebKit : le clic ne focalise pas toujours le bouton déclencheur. Deux prises de focus explicites dans `PublishTriggerButton` permettent à la modale existante de restaurer le focus ; aucun nouveau composant modal. Risque GitNexus HIGH annoncé avant édition.
- CLI de migration historique : suppression du credential de secours embarqué et de l'IP par défaut ; refus avant accès distant sans configuration explicite ; contrôle strict de clé d'hôte. Aucune utilisation du credential ni rotation. La présence historique justifie une revue propriétaire de validité, sans republier sa valeur. Le chemin canonique de déploiement OVH reste obligatoire ; ce CLI n'est pas une autorisation d'exécution distante.
- CI : nouveaux contrats T01/T02/T04 raccordés, PostgreSQL partenaire privé ajouté. Lockfile et dépendances produit inchangés.

R100/R101/R106/R108 : correctifs sécurité intégrés et retestés. R80/R102/R109 : stock et Coverr corrigés et testés avec mocks. R103/R104/R105 : UI corrigée et retestée navigateur. **R107 demeure FAIL** : fenêtre cron [-1 h,+3 h] pouvant perdre une occurrence après longue panne ; propriété T03, contre-preuve T07, aucun changement concurrent. **R92 demeure FAIL** : indisponibilité OVH. Ces statuts sont ceux de T01 ; seule une nouvelle revue T08 peut actualiser sa matrice.

## Commandes et résultats locaux

Les groupes se recouvrent : ne pas additionner leurs assertions. Les reçus donnent commandes, sorties, versions et empreintes.

| Contrôle | Commande / preuve | Résultat |
|---|---|---|
| Dépendances reproductibles | `npm ci --prefer-offline --ignore-scripts --no-audit --no-fund --fetch-retries=3 --fetch-timeout=180000`, puis `npm rebuild --no-audit --no-fund` | PASS ; tentatives offline/cache et timeout précédentes conservées |
| TypeScript, lint, build | `npm run check`, `gates-node26/quality/` | PASS ; 0 erreur lint, 111 avertissements hérités. Le delta focus final est vérifié par lint ciblé et builds navigateur production suivants. |
| Contrats Node 24 canonique `.nvmrc`/CI | `node scripts/run-ci.mjs contracts`, `gates-node24/contracts/` | **1261 PASS / 0 FAIL / 7 SKIP** ; durable-submission 18 PASS et scripts schedule/composition/publication PASS. Sept SKIP existants : quatre INSEE live, deux DB distantes, un OTS live. Aucun test changé en SKIP. |
| Node 26, campagne précédente | `gates-node26/contracts/` | **1241 PASS / 20 FAIL / 7 SKIP** ; mocks externes contact/autopilot/parcours non appliqués. Les trois groupes passent inchangés sous Node24. Compatibilité de ce harnais sous Node26 NON VALIDÉE. |
| SQL partenaire réelle locale | `node qa/t01-certification-20261019/partner-pg-run.mjs partner-pg-grants-green` | **10 PASS / 0 FAIL / 0 SKIP**, backup/restore identiques, cluster arrêté ; voir reçu. Aucun accès OVH. |
| Route partenaire et Coverr | Inclus dans contrats Node24 | 9 et 4 PASS, sans les compter à nouveau |
| Publication UI / modes | `node qa/t06-ux-social-ab935-20261019/browser.mjs --webkit --production --out=integrated-webkit-qualified-production` | 29 PASS ; cinq largeurs, axe zéro, simulation de publication seulement. |
| Garde runtime natif | `node --test qa/t01-final-20261015/browser-harness/guard.test.mjs` | 72 PASS / 0 FAIL / 0 SKIP ; vraies exceptions, rejets, mutations et CORS refusés restent détectés |
| Chromium après focus | `node qa/t06-ux-social-ab935-20261019/browser.mjs --production --out=integrated-chrome-final-production` | **29 PASS / 0 FAIL / 0 SKIP**, voir `browser-final.json` ; la tentative dev précédente a expiré sur le bouton cookie avant les assertions et n'est pas un PASS. |
| Audit production | `npm audit --omit=dev --audit-level=high` | 0 high, 0 critical ; 2 low et 5 moderate conservés |
| Migration CLI fermée | `node --check scripts/apply-migration.mjs`, test environnement réduit | PASS ; sortie1 attendue avant réseau sans configuration |

Les résultats bruts rouges sont conservés : course quota initiale, SQL initiale puis permission fixture, WebKit focus, diagnostics de navigation avant qualification, timeout session Chromium dev et Node26. Le garde runtime existant n'est pas modifié : un diagnostic WebKit n'est qualifié que si un GET/HEAD de lecture connu est interrompu pendant une navigation explicite, avec preuve native et sans exception DOM. Les erreurs brutes et contrôles négatifs restent archivés ; aucun filtre général de texte. Captures mobile375 et desktop1440 WebKit affichées et examinées, champ date visible et accessible, pas de recouvrement par le pied de dialogue. Ceci n'est pas une recette Safari natif ou appareil réel.

## SQL, OVH, sauvegarde et rollback

Le runtime OVH identifié porte **ab935**, image `sha256:a6f8c93f40fdf5ac9e21b4a62269da9b6bc795001f93f6ff9b7e41ae208a9ff5`, mais `purama-sutra` est **exited depuis le 17/10 07:23:14 UTC**, exit143, pasOOM. `supabase-db` est aussi exited depuis07:23:17, exit0. Cause non établie. Six GET publics, dont login et API, retournent404 ; TLS1.3 valide ne signifie pas application saine. URL : <https://sutra.purama.dev>. Aucune remise en marche d'infrastructure partagée.

Cron : timer observateur actif, dernières observations UNAVAILABLE, réseau privé/AF_UNIX, dispatch OFF. Ce service ne génère ni ne publie ; il ne prouve pas un worker applicatif fonctionnel. Catalogue SQL live, tests authentifiés, médias et accès fournisseurs depuis ce runtime sont BLOQUÉS par l'arrêt.

Trois migrations historiques ont des reçus d'application du16/10 : durable `925fa5d28ee1724226fe7793767f409af85efe7a392d4991365284107d4ccccf`, permissions `3776c0c57fb83523c83a6ba4ada5d8cc55ccab8205765743bc527126ad340e6c`, historique social `d2f6a9cb380a15285759085cdf602701f0d9d785d4a7f76f2061438d38ab9ddc`. Leur état courant n'a pas été relu dans une base arrêtée.

**Nouvelle migration locale, NON APPLIQUÉE OVH** : `migrations/20261019_partner_scan_atomic.sql`. Elle est additive et doit précéder le nouveau handler ; si la RPC manque, le handler refuse503. Ordre : préflight/backup frais et restauration testée, revue des ACL existantes, migration transactionnelle puis candidat applicatif. Elle notifie PostgREST pour rechargement du schéma. Tests locaux : données historiques intactes, RLS conservée, exécution interdite aux rôles client, double application, rollback puis réapplication. La vérification promotion historique des trois migrations ne certifie pas automatiquement cette quatrième migration.

Six artefacts sauvegardés dans `/opt/purama/apps/sutra/backup-t01-coherent-ovgjp1a8` ont leurs empreintes intactes et permissions0700/0600. Ancienne restauration141tables prouvée ; identités complètes/sessions et blobs non figés NON TESTÉS. **Reçu expiré le16/10 02:40UTC : pas de backup frais utilisable comme gate de promotion.** Les trois scripts rollback SQL et l'image précédente restent présents. Voir `baseline/backup-db-readonly.json`.

Rollback applicatif conservé : `/opt/purama/apps/sutra/rollback-ab935e59ca4e39776630f05b2ba6c0422c74ec62`, ancienne image `sha256:d1c8e9ee93fd7c647a92461acb192f934e6ddac6e9976459457e0fef693541fc`, SHA précédent `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164`. La commande historique `python3 deploy/ovh.py rollback --source-ref ab935e59ca4e39776630f05b2ba6c0422c74ec62` **ne doit pas être exécutée maintenant** : application et DB arrêtées, autorisation actuelle limitée à préparation/validation. Après validation explicite, vérifier cible, état attendu et hashes avant usage ; ne pas toucher une autre app.

Rollback SQL nouveau : d'abord remettre l'application compatible précédente, puis `20261019_partner_scan_atomic.rollback.sql`. Il retire uniquement la RPC, conserve données/index et droits service_role nécessaires ; restaurer une ACL antérieure exige son snapshot préalable, pas une révocation aveugle. L'ancienne route a les défauts connus : un rollback n'est pas une correction. Aucun rollback production effectué.

## Fournisseurs et blocages humains

Les diagnostics gratuits du19/10 appartiennent à T04 et proviennent uniquement du master sécurisé, jamais de secrets affichés : RunPod endpoint health200 (zéro worker prêt), Shotstack stage/prod templates200, SunoAPI crédits200 (fournisseur tiers), Unsplash200. Cela prouve un accès en lecture, pas une génération. LTX sans test auth gratuit probant. Zernio/consentements inchangés, aucune connexion ou publication automatique. Salad/Pexels : format d'entrée invalide avant réseau, pas un refus administratif démontré ; ElevenLabs401 invalid_api_key. Coverr/Pixabay optionnels absents.

Actions minimales, sans envoyer de valeur :

1. Les propriétaires T02–T08 doivent répondre personnellement au nouveau SHA, avec comparaison des deltas/retests concernés ; T03 doit qualifier/corriger R107 dans son périmètre. T01 ne peut signer à leur place.
2. Réparer les entrées concernées dans la source sécurisée via [Salad](https://portal.salad.com/), [Pexels](https://www.pexels.com/api/key/), [ElevenLabs](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys). Ce n'est pas une autorisation GPU ni achat.
3. Après gates et ACK, validation explicite de remise en service/déploiement SUTRA et coordination de la DB partagée ; backup/restauration frais indispensables avant migration. Ne pas masquer R107 en activant le cron.
4. Si l'incident « failed to load workspace requirements » persiste, fournir son contexte et horodatage exacts. Un initialize/configRequirements/read réussi ne prouve pas sa résolution rétroactive.
5. Connexions sociales et consentements légaux personnels restent à effectuer par Matiss dans le parcours existant une fois l'application disponible. Aucune génération facturée, publication réelle ou qualification GPU ne fait partie des preuves présentes.

**Signal T09 : BLOQUÉ_ACK_OVH_R107**, aucun démarrage WanGP/GPU. Le reçu partagé signé seulement T01 référence le nouveau SHA, les preuves et chaque ACK réellement reçu. Aucun « zéro bug garanti » ni parcours live déclaré terminé.

GitNexus : impacts exécutés, risques HIGH signalés, détection des changements avant commit. Index partiel/tronqué (entrée, branchement, budget de parcours), certains handlers UNKNOWN ; revue directe complémentaire et aucune prétention de couverture exhaustive. Les preuves post-commit et la CI exacte sont dans le registre partagé, pas dans un faux ACK propriétaire.

Détection finale GitNexus : **CRITICAL**, 379 chemins préparés,258 symboles,219 flux annoncés. Comparaison main : CRITICAL, liste plafonnée. Revue directe :19 chemins produit/config/validation historiques modifiés,2 SQL ajoutés ; aucun moteur/cron/dépendance média changé. Les rapprochements de noms communs QA (`root`) limitent la précision ; ce signal reste conservé et impose la revue propriétaire, il ne devient pas un PASS exhaustif. Gitleaks staged expurgé :0détection.

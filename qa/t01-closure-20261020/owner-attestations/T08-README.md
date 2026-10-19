# T08 — audit indépendant SUTRA du 20 octobre 2026

**Verdict : NON PRÊT aux essais réels complets.** Candidat T01 effectivement examiné : **79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a**. La CI exacte est verte, mais les contre-tests nouveaux révèlent des défauts absents de cette couverture. Aucun nouveau SHA ne reçoit ce verdict par héritage.

La [matrice exhaustive](MATRIX.md), également disponible en [JSON](matrix.json), contient **89 PASS, 12 FAIL, 6 BLOCKED et 12 NOT TESTED**, soit119 exigences. Ce sont des exigences, pas une addition de tests unitaires. Les12 FAIL comprennent des défauts produit, un défaut de disponibilité opérationnelle et des échecs navigateur dont l'impact production reste à qualifier. Ils ne sont pas douze vulnérabilités critiques.

Le précédent bilan82/0/5/12 concernait une étape antérieure. L'audit indépendant97c288e avait ensuite documenté79/12/6/12 sur109 exigences. Sur79cd, dix de ces douze FAIL sont fermés par contre-preuves; R107 et R92 restent ouverts. Dix nouvelles exigences sont ajoutées pour musique, connexion sociale, langue et banc/runtime navigateur. Aucun échec n'est transformé en test ignoré.

## Identité et origine des preuves

- Worktree T08 isolé : `/Users/matissdornier/purama-worktrees/sutra-t08-final-ack-20261015`, branche `codex/sutra-t08-closure-79cd95b-20261020`. Ancienne branche et livraison97c288e préservées. Aucune modification produit, migration, dépendance ou configuration.
- T01 a personnellement annoncé79cd dans son miroir de clôture; HEAD du worktree d'intégration a été revérifié. [1188 blobs](source-integrity.json) du manifeste correspondent aux octets du candidat. Le libellé historiqueab935 du manifeste ne représente pas son contenu actuel : la comparaison des empreintes, pas ce libellé, fonde la réconciliation.
- [CI39328438907](https://github.com/puramapro-oss/sutra/actions/runs/39328438907), `headSha=79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a`, trois jobs SUCCESS. Métadonnées interrogées directement, ZIP GitHub téléchargés en mémoire et digests vérifiés indépendamment. Aucun déclenchement CI effectué par T08.
- Artefact quality12224783811 : SHA256 `8c39fb215ab03186cad0b55319f179885e4b95b7d345b510d9abde0865c4a754`; contracts12223308399 : `7ccb66449ac8b9196198c06747eb6bdd315d9359b56f179894204f5b10511ff9`. [Reçus](receipts/artifacts-independent.json), [résumés extraits](ci-summary.json).
- Logs bruts quality et PostgreSQL également récupérés et comparés aux reçus T01, sans les afficher ni les persister : [empreintes](receipts/ci-job-logs-independent.json). Les JSON de résultats extraits conservent leurs libellés d'origine; l'enveloppe du run fournit le SHA d'exécution.
- Mac T08 : Node24.22.0, cache existant, configuration synthétique minimale et garde réseau offline. CI : Node24.21.0. L'essai initial Node24.13.0 n'attachait pas certains mocks SDK; ses échecs sont conservés dans `harness-initial/`, sans modification de dépendance ni suppression d'assertion.
- Secrets : aucun master ni `.env` lu par T08. Les constats de provenance des variables sont des reçus expurgés T04, datés, pas une nouvelle lecture ou validation des secrets par T08.

## Verdict par domaine

| Domaine | Statut | Preuve et limite |
|---|---|---|
| Provenance candidat/CI | PASS | HEAD exact,1188 blobs, run/artifacts/logs indépendamment vérifiés. |
| Installation propre, TypeScript, lint, build | PASS | Exécutés en CI exacte; pas de build identique relancé sur Mac. |
| Authentification synthétique/isolation utilisateur | PASS | Parcours13/13, sécurité23/23 T08, ACK T02; aucune preuve d'organisations natives absentes du modèle. |
| Sécurité ciblée T02 | PASS |320 exécutions propriétaire recouvrantes, droits/SSRF/IDOR/CSRF/XSS/OAuth; périmètre borné. |
| Erreurs privées des adaptateurs | FAIL | R111 : corps fournisseur dans exception StableAudio. Pas de fuite HTTP publique démontrée : le wrapper expurge sa réponse. |
| Pipeline durable et annulation existants | PASS | Vraies routes simulées, PostgreSQL privé CI réel, ACK perdu/quota/audit/concurrence. Arrêt local ne prouve pas arrêt d'un fournisseur déjà soumis. |
| Rattrapage de l'ordonnanceur | FAIL | R107 : occurrence12h perdue après reprise20h et redémarrage PostgreSQL. T03. |
| Fournisseurs simulés | FAIL | Contrats existants PASS, mais trois contre-exemples StableAudio/Riffusion FAIL. T04. |
| Média, probe, montage et export synthétique CPU | PASS | FFmpeg/probe réels CI, ACK T05 et conservation des preuves. Aucune génération GPU. |
| Bibliothèque et téléchargement | PASS | CI Chromium/WebKit exacte, pagination, média vérifié, timeout de flux/reprise. Stockage distant réel non exercé. |
| Connexion sociale simulée | FAIL | DoublePOST, chargement sans fin et diagnostic callback brut reproduits indépendamment. T06. |
| Planification et publication simulée | PASS | Parcours13/13 et25 contrôles publication dans chacun des deux moteurs; aucune publication publique. |
| Interface complète / navigateur | FAIL | Locale anglaise incohérente et échecs de banc/runtime dev conservés. CI optimisée verte distincte. T01/T06/T07. |
| Accessibilité bornée | PASS | Axe/focus/clavier, viewports320–1440; captures320/1440 effectivement affichées. |
| Mobile physique, VoiceOver, visuel exhaustif | NOT TESTED | Aucun appareil physique ni lecteur d'écran réel. |
| Migrations/rollback isolés | PASS | SQL privé réel CI et simulations de promotion/rollback; données historiques testées dans ces fixtures. |
| Backup frais et restauration opérationnelle complète | BLOCKED | Dernier reçu périmé; restauration complète identités/sessions/blobs NOT TESTED. |
| Gate de promotion des nouvelles migrations | FAIL | R119 : RPC partenaire utilisée sans reçu/catalogue exigé par promote.py. T01 corrige; aucune promotion exécutée. |
| Migration/rollback de production | NOT TESTED | Pas exécutés; migration partenaire uniquement locale. |
| OVH/health/HTTPS applicatif | FAIL | App et DB arrêtées; routes404. Installationab935, aucun déploiement79cd. |
| Cron autonome réel | BLOCKED | Dispatch OFF; activation non autorisée et R107 ouvert. |
| Charge raisonnable isolée | PASS | Concurrence12 simulée et SQL multi-session CI/T02; aucun SLA distant. |
| Performances réelles/alertes/endurance | NOT TESTED | Runtime arrêté, pas de soak distant ni alerte complète. |
| GPU réel et publication publique | NOT TESTED | Aucune dépense, consentement ou génération/publication réelle. |
| Coordination T09/WanGP | BLOCKED | Six ACK personnels verts sur même candidat absents; R107, musique et UI ouverts. Aucune disponibilité annoncée. |

## Exécutions indépendantes T08

Les fichiers JSON portent la commande, le SHA, le runtime, les dates et l'empreinte des tests. Les logs rouges restent des preuves, pas des tests passés.

| Commande / artefact | Résultat | Nature |
|---|---|---|
| `node qa/t08-closure-20261020/counterexamples.mjs 79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a` |5 PASS | Sources Git exactes en VM; sept requêtes simulées, zéro native. |
| `python3 qa/t08-closure-20261020/run_targeted.py --candidate 79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a journey security-delta` |13 +23 PASS,0 SKIP | Vraies routes et moteurs, frontières synthétiques; suites existantes réutilisées. |
| Même lanceur, `stock-delta` |4 PASS,0 SKIP | Coverr/configuration, aucune recherche extérieure. |
| `node --test qa/t08-closure-20261020/callback-errors.mjs` |6 FAIL,0 SKIP | Effet réel compilé, hooks/toast et URL synthétiques; aucune exécution XSS démontrée. |
| Même lanceur, `music-counterexamples` |3 FAIL,0 SKIP | Contre-tests T04 réexécutés indépendamment à source identique. |
| Harnais canonique `qa/t06-ux-social-ab935-20261019/browser.mjs`, Chromium, sortie `publication-current-chromium` |28 PASS /1 FAIL |25 contrôles publication PASS; mode ready absent5s. |
| Même harnais, `--webkit`, sortie `publication-current-webkit` |25 PASS puis sortie1 | Navigation/create interrompue par/library; modes non exécutés. |
| `node qa/t08-closure-20261020/social-boundaries.mjs --out=<sortie absolue T08>` |9 PASS /5 FAIL | Harnais neuf T06 inchangé; doublePOST, attente infinie, langue; première erreur503 et mode ready à qualifier. Runtime inattendu vide dans cet essai. |

Le premier harnais publication historique avait12 PASS/2 FAIL : ancien libellé «Publié» attendu contre «Publie» actuel, et hydratation/ChunkLoadError. La dérive de libellé n'est pas un défaut produit. Le harnais courant ferme ce point; les diagnostics runtime demeurent archivés et qualifiés séparément. T06 a également reproduit un mismatch DashboardChrome sur son banc neuf. Aucun filtre large ni retry pour faire disparaître un rouge.

Le parcours13/13 relie connexion/session, projet, devis/réservation simulés, queue, worker, checkpoints, reprise, montage, export, validation, journal et publication simulée. Ce n'est **pas** une exécution continue navigateur→base réelle→GPU réel→plateforme publique. Les preuves navigateur et PostgreSQL complètent la couverture par frontières; elles ne fabriquent pas cette chaîne réelle.

## Échecs restants, reproduction et correctif minimal

| ID | Attendu / observé | Responsable / clôture nécessaire |
|---|---|---|
| R107, majeur | Planning12hUTC, tick00h, vrai redémarrage PostgreSQL, tick20h : attendu1 occurrence récupérée, observé0 job/0 quota avec HTTP200. | T03 : curseur durable/RPC/CAS, permissions INSERT/DELETE et UPDATE, pagination, bornes, concurrence et replay. T07 contre-testera après intégration T01. |
| R110, majeur | StableAudio processing avec output doit resterpending; actuellement accepté terminal. | T04 : statut terminal strict, conserver intention/ID et repriseGET; aucun resubmit ou fallback payant. |
| R111, frontière sécurité | HTTP401 synthétique contenantPRIVATE_BODY_MARKER doit produire exception expurgée; le marker subsiste. | T04/T02 : erreur typée, corps borné/expurgé; contre-test adaptateur et réponse publique. Pas de fuite HTTP publique démontrée par ce cas. |
| R112, majeur | Riffusion completed avec data.data[0].stream_audio_url doit être reconnu après validation; actuellement ignoré. | T04 : parseur contrat strict et reprise sans nouveauPOST. |
| R114, majeur | Deux activations synchrones du bouton OAuth doivent produire1POST; observé2. | T06 : garde synchrone par intention, aucun nouveau mécanisme OAuth parallèle. |
| R115, majeur | POSTconnect suspendu : timeout borné puis reprise manuelle; bouton toujoursdisabled/aria-busy après11s. | T06 : deadline/abort local et erreur récupérable, aucun retry automatique. |
| R118, diagnostic utilisateur | URL error arbitraire transmis au toast, codes OAuth bruts et message non persistant :6FAIL. | T06 : allowlist de messages sûrs, alerte persistante, nettoyage ciblé de l’URL. Aucun XSS exécuté démontré. |
| R116, mineur | Localeen : titre création traduit; affichage «Creer une video». | T01/T07 : catalogue existant, retest des langues et accessibilité. |
| R113, échec QA | Chromium mode ready absent5s; WebKit navigation interrompue; nouveau banc premier503 sans erreur visible. | T06/T01 : qualifier session/hydratation/readiness/navigation, garder assertions et délais; comparer production existante avant attribution produit. |
| R117, impact production non qualifié | Hydratation DashboardChrome en dev, DOM serveur/client divergent. | T01/T07 : qualification sur build production invariant, reproduction puis correction si cause produit. Garde native inchangée. |
| R119, majeur release | Route partenaire utilise record_partner_scan; promotion ne contrôle que les3SQL historiques, sans preuve de la nouvelle RPC. | T01 : exiger reçu exact/restauration/catalogue/ACL avant mutation, et la future migration ordonnanceur après intégration. Contre-tests négatifs requis. |
| R92, disponibilité | Reçus T01 : application etDB arrêtées, routes404, SHA installéab935. | T01 : décision autorisée de remise en service après backup/ACL/migration. Ce n'est pas une régression de79cd démontrée. |

Le PASS DOM callback initial était insuffisant face au toast transitoire : la nouvelle preuve compilée le limite explicitement et R118 demeure FAIL. Les reproductions sont dans [callback-errors.json](callback-errors.json), [music-counterexamples.json](music-counterexamples.json), [social-boundaries/results.json](social-boundaries/results.json), les deux dossiers `publication-current-*` et [reprise PostgreSQL T07](receipts/T07-final-results.json). Signalements immédiats déposés dans les miroirs T01/T04/T06/T08; aucune écriture dans les worktrees propriétaires. Les corrections WIP ne valent pas correction intégrée.

## ACK propriétaires et coordination

| Propriétaire | Réception personnelle | Portée |
|---|---|---|
| T02 | Commit5fcfd7868553ebaa3605d6b81b11c4ecca3e1c54, parent79cd | ACK sécurité locale bornée,320 exécutions; NACK global conservé. [ACK](receipts/T02-final-ACK-T02.json). |
| T03 | Commit5fbdb238aceaf2c2ef937e7ebbedd692eadb282c, parent79cd | NACK79cd/R107, PASS du delta propriétaire seulement;134cas distincts exécutés par T03. Correctif accepté par T01 mais aucun nouveau SHA intégré annoncé. [ACK](receipts/T03-final-ACK-T03.json). |
| T04 | Commita87fefe8a3c33d09bb1a09cc5d6b20fa85aaf451, parent79cd | NACK79cd/musique, PASS du delta propriétaire seulement;119 puis41exécutions recouvrantes. Blobs acceptés par T01, nouveau SHA/retest requis. Fix ElevenLabs historique déjà intégré. [Handoff](receipts/T04-final-handoff.md). |
| T05 | Commitc63464a171ecf6e2dd35b1c4a604083aaa1a424e, parent79cd | ACK média borné, aucun produit modifié. [Réconciliation](receipts/T05-reconciliation.json). |
| T06 | Reprise personnelle, nouveaux FAIL et correction sociale réservée | Pas d'ACK global; shell/langue transmis à T01/T07. |
| T07 | Commit2f94037e551140b51894da4f41bf67a3ed15f364, parent79cd | ACK technique borné / NACK activation R107. [ACK final](receipts/T07-final-ACK-T07.json); le fichier `T07-ACK-T07.json` antérieur reste un brouillon, ne pas l'utiliser. |

Les commits documentaires propriétaires ne sont pas le nouveau candidat intégré. T01 reste intégrateur unique. Les conditions T09 ne sont pas satisfaites : aucune notification de disponibilité ou d'autorisation GPU. Le terminal OMEGA-T09 est distinct du connecteur SUTRA WanGP. Un dépôt de notification ne prouve ni lecture ni ACK du destinataire.

## Réconciliation des blocages et tests non réalisés

Les cinq anciens blocages sont relus séparément : **R30** cronOFF/configuration inactive; **R78** Salad configuration locale malformée et organisation/projet absents, aucune requête HTTP; **R90** Pexels représentation locale impropre, aucune requête; **R91** ElevenLabs GET401invalid_api_key, aucun manque de crédit démontré; **R96** erreur «failed to load workspace requirements» sans origine/horodatage/reproduction d'interface. POLICY_OK et commandes repo fonctionnent; l'ancien appel initialize/configRequirements/read réussi ne prouve pas la résolution de l'incident initial. Aucun correctif SUTRA inventé pour cet incident externe. Le sixième blocage **R61** est la péremption du reçu de sauvegarde.

Les douze NOT TESTED restent individuellement explicites : R02 OAuth personnel; R07 coût/budgetGPU réel; R18 qualité artistiqueIA; R32 sécurité exhaustive; R34 chaîne réelle complète; R36 alertes opérationnelles; R38 SLA/endurance distante; R41 appareils/VoiceOver/visuel exhaustif; R44 GPU réel; R45 publication publique; R62 restauration complète identité/session/blobs; R63 migration/rollback production. Leur maintien vient de l'absence actuelle de ces preuves, pas d'une copie aveugle de leur statut historique.

Fournisseurs, reçus T04 datés19Oct19:44–19:50UTC : RunPodhealth200 avec0worker prêt; Shotstackstage/v1templates200; SunoAPIcredit200, fournisseur tiers distinct de l'API officielle Suno; Unsplashcatalogue200. Aucun de ces GET ne valide une génération. LTX : présence de clé attestée seulement, authentification réelle non testée faute d'endpoint gratuit documenté/job existant. Salad/Pexels/ElevenLabs restent BLOCKED comme ci-dessus. Coverr/Pixabay clés absentes : fonctionnalité non configurée, pas mauvaise clé démontrée. Les variables ont une provenance attestée master/absent dans [T04-free-reads.json](receipts/T04-free-reads.json); aucune valeur n'est reproduite.

OVH : lecture seule T01 du19Oct21:52UTC, conteneurs stoppés depuis17Oct07:23, codes143/0 sansOOM, arrêt manuel attesté. Source installéeab935, candidat79cd non déployé. Backup historique6artefacts/141tables, validité expirée16Oct02:40UTC. Trois anciennes migrations appliquées historiquement; catalogue courant inaccessible DB arrêtée. Migration partenaire79cd uniquement locale. Rollback opérationnel documentéab935→86d04 ne prouve pas rollback79cd exécuté. Aucun accès SSH/sonde distante redondante par T08.

## Prochaine recette et actions personnelles minimales

1. T03/T04 ont livré leurs commits terminés; T06 termine son correctif social; T01 qualifie shell/langue et annonce un **nouveau SHA intégré unique**. Rejouer les contre-exemples affectés, sécurité des nouvelles RPC/adaptateurs/OAuth, reprise/concurrence/annulation, puis une seule chaîne simulée finale et CI du nouveau SHA. Ne pas transférer les ACK actuels automatiquement.
2. T01 décide seul d'une éventuelle remise en service autorisée, après sauvegarde/restauration fraîche, migrations/ACL, rollback adapté et vérification HTTPS/health/cron. Aucune opération de production n'est autorisée par ce rapport.
3. Matiss/propriétaire des clés : corriger les valeurs existantes Salad et leurs noms d'organisation/projet dans le [portail officiel](https://portal.salad.com/), Pexels via [gestion des clés](https://www.pexels.com/api/key/), ElevenLabs via [gestion du workspace](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys). Aucun secret à envoyer dans un message; relecture gratuite par T01/T04 après correction. Aucun achat requis pour ces vérifications.
4. Matiss seul : consentements aux comptes sociaux souhaités depuis les boutons SUTRA une fois leur correctif validé; choisir périmètres et comptes réellement voulus. Aucun consentement ou connexion n'a été effectué ici.
5. Pour R96, fournir l'application/écran, l'heure et la manipulation qui produisent l'erreur de requirements; la commande locale seule ne la reproduit pas. Pour essais réels GPU/publication, autorisation et budget explicites séparés restent indispensables; ils ne sont pas sollicités pour clôturer cette recette gratuite.

Aucune fonction n'est certifiée au-delà de sa preuve. Ce rapport ne promet pas zéro bug. Les seules dépendances restantes pour une nouvelle recette locale sont les corrections propriétaires intégrées et leur nouveau SHA; répéter les suites inchangées ne les résoudrait pas.

## Qualité et limites de cette livraison

Syntaxe/ESLint des scénarios T08 et contrôle des liens/preuves PASS. GitNexus index-only sans embeddings : graphe tronqué (1370entrées écartées,871callees non parcourus), staged CRITICAL148symboles/493flows par associations de callbacks génériques; comparaison main inclut la lignée historique. Aucun symbole produit modifié. Avertissement transmis, aucune exhaustivité revendiquée. Gitleaks expurgé conserve exit1/23alertes :15empreintes SHA256 vérifiées contre les blobs propriétaires,8UUID d’idempotence issus de fixtures;0alerte non classée, pas de fuite réelle démontrée. Diff-check sources/docs PASS; diff-check brut FAIL pour blancs des logs préservés. Ces diagnostics restent archivés dans qa-quality.json.

R119 est prouvé par analyse AST et revue des sources Git exactes : [reproduction minimale](promotion-gate-gap.json). Ce contrôle n’exécute ni n’importe promote.py et ne prouve aucune promotion distante. La nouvelle migration ordonnanceur n’existe pas encore dans79cd; elle devra aussi être exigée dans le prochain candidat.

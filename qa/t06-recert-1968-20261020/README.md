# T06 — clôture UX/social sur fcd0559, 20 octobre 2026

Candidat T01 **fcd0559f611831a57909c693694b92ccb81eba45**, branche T06 `codex/sutra-t06-recert-fcd0559-20261020`, worktree isolé `sutra-t06-integrated-retest-20261015`. Le nom du dossier conserve la première base1968 ; tous les reçus présents portent le candidat réellement testé fcd0559.

**ACK social borné aux preuves ci-dessous ; NACK de clôture UX globale.** Trois classes de défauts de publication ont été corrigées et vérifiées localement. T01 doit intégrer ce delta et qualifier son prochain candidat. Les51autres routes avec observations axe appartiennent à T07 selon l'attribution T01 du20/10 à10:26UTC. Aucun de leurs fichiers n'a été modifié.

## Réconciliation et périmètre

AGENTS, politique canonique, LOCKS et handoffs relus ; `bash scripts/policy-check.sh` : POLICY_OK. Réservations PUBLISH-CONTRAST puis extension nominative `usePublish.ts`/lecture en erreur annoncées avant écriture aux propriétaires. Aucun fichier d'environnement ou secret consulté. Aucun worktree tiers modifié ; coordination partagée append-only.

`python3 qa/t06-recert-1968-20261020/reconcile.py` exécuté **avant** toute correction :1204entrées du manifeste T01 égales au commit et au disque. Page sociale exacte de773fafef. Produit/SQL/dépendances identiques depuis1d63ade0. Sur46intrants historiques,42inchangés ; quatre changements explicitement identifiés : page sociale livrée, ancien harnais social, scripts/run-ci et workflow CI. La commande compare intentionnellement le disque au candidat ; ne pas la rejouer sur le delta corrigé en prétendant tester le candidat pur.

Les30contrôles production T01 (15Chromium +15WebKit) sont rapprochés du manifeste, pas réexécutés ici. Ils couvrent connexion/délai/reprise, callback, reconnexion, création vide/refus503/réponse perdue/repriseGET/annulation, titre anglais, modes client/personnel indisponible/prêt et garde runtime. Leur reçu précommit porte encore79cd : l'attribution à fcd repose sur les entrées exactes du manifeste T01, pas sur une modification de l'ancien reçu.

## Défauts reproduits, causes, corrections

| Défaut | Cause | Correction et preuve |
|---|---|---|
| Textes `/publish` insuffisamment contrastés | Opacité30/40%, ratios2,65–3,81 au lieu de4,5 | Palette existante `text-white/60` pour sous-titre, états vides, en-têtes et date de l'historique. Axe0 aux320/375/768/1280/1440, états vide et rempli. |
| Colonne statut hors champ mobile, tableau inaccessible au clavier | Conteneur horizontal sans cible de focus | Région nommée « Publications programmées », tabIndex0 et focus visible existant. Test réel focus + flèche droite, scrollLeft positif à320px. |
| Erreur de lecture présentée comme historique vide | Supabase retourne `.error` sans lever d'exception ; fetchData ignore cette erreur | Contrôle des trois réponses et de leur forme, message générique `role=alert`, bouton Réessayer existant. Données inconnues jamais présentées comme vides ; contrôles de publication masqués jusqu'à lecture réussie.503 vidéos/programmées/passées et réponse malformée couverts ; reprise par Entrée. |

Quatre fichiers produit seulement :

- `src/app/(dashboard)/publish/page.tsx`
- `src/components/publish/ScheduledPostsTable.tsx`
- `src/components/publish/PastPostsList.tsx`
- `src/hooks/usePublish.ts`

Aucun contrat API, moteur, OAuth, permission, token, sélection de destination, idempotence ou ordonnanceur changé. `corrected-source-manifest.json` et le reçu navigateur identifient le patch testé par SHA256 ; ce patch n'est pas déjà intégré au candidat fcd.

## Tests et preuves exactes

Node utilisé : `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node` (v24.22). Environnement enfant limité aux fixtures, garde `qa/t08/offline.cjs`, seuls sockets loopback autorisés. Le navigateur utilise Chrome réel headless et des identités synthétiques. Aucun compte ni consentement personnel.

| Statut | Commande / reçu | Résultat |
|---|---|---|
| PASS | `python3 qa/t06-recert-1968-20261020/run-targeted.py` |10callback/feedback +53routes/adaptateurs sociaux,0FAIL/0SKIP. Commandes détaillées dans `targeted.json`. |
| FAIL avant, conservé | `node qa/t06-recert-1968-20261020/publish-browser-before.mjs` |11FAIL :10observations de contraste/clavier +faux historique vide503.0runtime/externe/mutation. |
| PASS delta | `node qa/t06-recert-1968-20261020/publish-browser.mjs --after` |15PASS/0FAIL ; cinq largeurs, axe, clavier, quatre erreurs de lecture et reprise.0runtime/externe/mutation. |
| FAIL de couverture, routé | `node qa/t06-recert-1968-20261020/pages-initial.mjs` |100routes/205observations :77PASS,107observations axe sur52routes,2captures bibliothèque précoces,19redirections. Deux erreurs d'hydratation DEV partenaire. |
| PASS | `node node_modules/typescript/bin/tsc --noEmit --incremental false` |Exit0 ; `typecheck.log`. |
| PASS avec avertissements | ESLint sur quatre fichiers produit et quatre harnais `.mjs` |Exit0,4warnings : import expect du harnais initial figé, navigation existante window.location.assign, import SocialPlatform existant, ancien eslint-disable devenu inutile. Aucun avertissement masqué. Commande exacte `validation.json`. |
| PASS réutilisé | `reconciliation.json` |Production T01 deux moteurs30contrôles, précédent correctif de sélecteur social25contrôles, gate générale. Compteurs recouvrants, pas une somme de tests nouveaux. |
| NON TESTÉ | `pages.mjs --recheck-failed` |Version préparée mais non lancée après attribution T01 à T07, pour éviter un second audit général. |

Le harnais initial est conservé, y compris sa limite : attente courte, deux captures `/library` encore en chargement. Elles ne démontrent pas deux bugs. Les19redirections ne certifient pas les écrans réservés aux administrateurs. L'inventaire100pages est un contrôle de rendu/axe/layout, pas100parcours métier entièrement testés. La mutation `/api/legal/cookie-consent` du balayage correspond au refus explicite de cookies de l'identité de test, intercepté ; aucun POST social/publication. Ne pas appeler109observations109bugs distincts.

`page-matrix.json` conserve les routes, largeurs, sélecteurs et propriétaires. Les contrastes hors publication, quatre selects batch sans nom et les deux mismatches DEV partenaire sont transmis à T07/T01/T08 ; pas de correction parallèle. Les captures publication mobile/rempli, desktop/vide et erreur mobile ont été affichées personnellement après correction.

## OAuth, publication et programmation

Les53contrats frais vérifient neuf plateformes, state consommé atomiquement, session renouvelée/expiration/refus, identité/profile remplacé pendant le callback, révocation concurrente/incertaine et effacement des anciens champs tokens, reconnexion personnelle explicite, compte absent, sélection du nouveau compte, média non vérifié, accord manquant, publication partielle et reprise ciblée. Réponse POST perdue : requête persistée et GET de rapprochement seulement, pas de second POST aveugle.

IANA/récurrences quotidiennes, hebdomadaires, toutes les deux semaines et mensuelles, trou/pli DST, Lord Howe/Kiritimati et déduplication : intrants `sutra-auto-utils.ts`, `test-auto-schedule.mjs` et contrats sociaux inchangés, preuves CI réutilisées. Aucun replay de suites vertes invariantes. Les jobs contracts et disposable-database de CI39406352519 sont SUCCESS sur fcd ; quality encore en cours dans le reçu `ci-status-latest.json`. Cela ne vaut pas succès CI global. Pas de nouveau build identique.

Le modèle lie utilisateur/session/profil Zernio ; il n'offre pas d'organisation native indépendante à certifier. Le contrat demande `posting`, les DTO publics ne rendent pas les tokens, Zernio conserve les tokens fournisseur. Mocks et source ne prouvent pas leur chiffrement/rotation effective, les permissions réellement présentées ou la révocation distante réelle. Aucun renouvellement de clé demandé.

## Isolation personnelle et limites

La preuve production réconciliée couvre les notices API client/personnel open source distant et worker indisponible/prêt. Le client n'obtient aucun sélecteur activant WanGP personnel ; pas de champ personnel ajouté au payload. Aucun moteur T09 développé, aucun worker lancé. Cette preuve UI ne remplace pas les gardes serveur T02 ni un essai WanGP réel.

NON TESTÉ : appareils physiques, VoiceOver/lecteur d'écran réel, Safari natif, performance de production, exhaustive traduction de toutes les pages, médias réels, consommation fournisseur, compte/consentement/publication réels. Les pages sociales historiques restent largement françaises ; le titre de création anglais a une preuve ciblée, pas une certification de toutes les locales. Les nouvelles erreurs sont compréhensibles et ne reprennent jamais le diagnostic Supabase.

BLOQUÉ pour clôture globale : intégration T01, recette de son SHA final, corrections des fichiers T07 et disponibilité de l'application. T08 a communiqué un dernier contrôle OVH404 ; T06 n'a pas répété de sonde distante ni modifié la production. Aucun faux ACK global.

## GitNexus et qualité du lot

Impacts avant édition : usePublish LOW,1appelant PublishPage ; fetchData exact LOW,2appelants directs/5symboles, un parcours de publication. Entrées Next/composants UNKNOWN0appelant résolu : recherche directe des imports confirme la page publication, sans conclure qu'absence d'arête signifie absence d'usage. Index4commits derrière, graph partiel ; aucune certification exhaustive. Reçus `impact-*.json`.

Détection précommit staged/compare-main, scan secrets expurgé et diff-check : reçus `precommit.json` et journaux associés. La comparaison main porte toute la lignée intégrée, pas seulement ces quatre fichiers ; aucun résultat global n'efface les limites du graphe.

## Consentements personnels uniquement

Après confirmation de disponibilité par T01 :

1. Matiss ouvre [les réglages sociaux](https://sutra.purama.dev/settings/social) dans sa propre session SUTRA et choisit « Se connecter » ou « Se reconnecter » pour les réseaux souhaités.
2. Il sélectionne personnellement le bon compte, la page ou la chaîne et examine/accepte les permissions chez la plateforme.
3. Il revient dans le même navigateur/session sous10minutes et vérifie le bon identifiant connecté. Expiration/refus : relancer explicitement. Profil social non attribué ou révocation encore incertaine : T01 vérifie le binding ou le rapprochement, sans contourner la garde.

Neuf réseaux proposés : TikTok, YouTube, Instagram, Facebook, X, LinkedIn, Pinterest, Reddit, Threads. Cinq autres restent indisponibles. Aucun consentement réel n'est nécessaire à ces tests ; aucune automatisation ou publication à activer pour cette clôture.

## Reçu final précommit

GitNexus staged :200fichiers (captures/preuves incluses),6symboles,2flux, MEDIUM. Comparaison main :6085fichiers/12473symboles/398flux, CRITICAL, liste plafonnée. Risque signalé avant commit ; revue directe limitée aux quatre fichiers produit. Le symbole publishNow apparaît par position du diff, sa logique reste inchangée. Diff-check staged PASS.

Gitleaks brut expurgé :7alertes, toutes attribuées et conservées. Une provient de l'encodage du patch binaire d'une capture PNG, six de quatre UUIDv4 de requêtes de création synthétiques dans le reçu T01 réutilisé. Provenance contrôlée (`/api/create`,POST, capture du header dans journeys.mjs78). Scan du diff texte avec remplacement exact de ces seules valeurs dans stdin :0alerte. Aucun fichier de preuve brut modifié, aucune allowlist permanente, aucune valeur secrète consultée. Détails `secrets-review.json`.

T08 a reproduit indépendamment le défaut de lecture sous identifiant R123 sur fcd (1FAIL conservé). Son contre-test doit être rejoué après intégration T01 ; T06 ne déclare pas cet ACK indépendant acquis. T01 HEAD recontrôlé propre et toujours fcd avant commit. Aucun changement production.

Les treize journaux originaux de cette recette sont inclus malgré la règle générale `.log` du dépôt. La vue `lint.log` normalise uniquement la ligne vide finale ; ses octets originaux sont conservés dans `lint.log.original.gz`, avec empreintes dans `log-provenance.json`. Le scan Gitleaks revu inclut ces journaux : exit0.

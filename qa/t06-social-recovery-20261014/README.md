# T06 — OAuth social et publication, delta du 14 octobre 2026

Base réellement intégrée vérifiée : `b7cf848d07fca2734db36a2e30d045ca312a3162`, code actif T01 `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`. Branche isolée `codex/sutra-t06-social-recovery-20261014`. Les anciens bilans fournisseurs ne sont pas utilisés comme état courant. Aucun changement production, secret réel, appel fournisseur, publication, migration, GPU, IA Mac, build global, push ou fusion.

## Défauts reproduits et corrections

| Défaut | Cause | Correction et preuve |
|---|---|---|
| Un refus OAuth laissait l'état réutilisable ; une erreur non liée à la session était acceptée comme refus | Retour anticipé avant contrôle/consommation du state | Les erreurs passent les mêmes contrôles utilisateur/session/profil/navigateur, puis consomment le state et le cookie. `repro-oauth-denial.tap` : 2 FAIL ; `fix-oauth-denial.tap` : 2 PASS. |
| Ancien consentement ou callback en vol réactivait un compte révoqué | State indépendant de la version du compte ; upsert inconditionnel après GET fournisseur | Empreinte liée à la révision du compte ; UPDATE conditionnel sur le snapshot ou INSERT unique pour un premier compte. `repro-revocation-race.tap` : 2 FAIL ; `fix-races-first.tap` : 4 PASS incluant les refus précédents. |
| Refus de X rejeté ; erreur inconnue qualifiée à tort de refus utilisateur | Zernio renvoie `platform=twitter`, y compris sur erreur ; tous les codes étaient assimilés à un refus | Normalisation vers `x`, erreur inconnue générique sans réflexion du corps fournisseur. `repro-provider-errors.tap` : 2 FAIL ; couverture finale T06-DELTA. |
| Consentement pendant DELETE distant ; deux requêtes de révocation concurrentes | Aucun verrou durable distinguant révocation en cours et terminée | Réservation conditionnelle locale avant DELETE, nonce de révision, barrière persistante. Nouveau consentement : 409 expliqué dans la réponse API ; la page actuelle masque encore ce détail (transmis à T07). Deux callbacks initiaux ne peuvent pas écraser le gagnant. |
| Après timeout/503, la première correction levait trop tôt la barrière | Le booléen faux de l'adaptateur ne prouve pas l'absence d'un DELETE distant tardif | Barrière conservée tant que le résultat est non confirmé ; aucune seconde DELETE ni reconnexion automatique. Revue T01 reproduite : `repro-ambiguous-delete.tap` 2 FAIL ; `fix-ambiguous-delete.tap` 2 PASS. |

Le nonce évite toute dépendance à l'ordre ou à la précision des horloges. Les callbacks périmés ne modifient ni un compte plus récent ni l'historique. Les jetons restent détenus par Zernio ; aucun token reçu n'est enregistré dans les comptes SUTRA.

## Validation ciblée et provenance

Commandes reproductibles : `node qa/t06-social-recovery-20261014/run.mjs`, ou un nom de phase en argument. Chaque reçu JSON conserve la commande complète, le code retour et la durée ; les logs sont locaux. Le runner ne transmet que les variables système nécessaires et des valeurs synthétiques déclarées dans son code. Le preload `qa/t08/offline.cjs` interdit le réseau externe et la lecture des fichiers `.env*`. `~/.env.purama.master` n'a pas été lu, copié ou modifié : aucun secret réel n'est nécessaire à ces régressions.

**PASS : 162 tests distincts** (149 OAuth/publication/routes dont 13 nouveaux cas T06-DELTA, six consommateurs de publication, sept PostgreSQL). Le premier passage de 149 tests avait 147 PASS/2 FAIL dans les fixtures `test-security-routes.mts` ; après ACK T01, les dix tests de ce fichier sont PASS, sans rejouer les 139 inchangés. `results.json` conserve cet échec historique ; les reçus `results-security-fixture-lint-security-typecheck.json` et `verification.json` portent la résolution explicite. TypeScript ciblé et lint des fichiers modifiés : PASS, zéro avertissement. Aucun test ignoré assimilé à un PASS.

`node qa/t06-social-recovery-20261014/run-postgres.mjs` : sept tests sur **PostgreSQL18 réel local isolé**, cluster propre arrêté et conservé. Le vrai helper CAS émet ses prédicats vers un adaptateur SQL paramétré : égalité JSONB malgré l'ordre des clés, NULL de compte historique, 24 prétendants concurrents avec un seul gagnant, révision modifiée sans changement d'horloge, callback périmé après révocation, 23 répétitions pendant DELETE sans seconde requête, refus d'un state après résultat ambigu, contrainte d'unicité première connexion et séparation utilisateur/compte. Aucune base partagée ni migration distante. Ce test valide la sémantique SQL ; **le transport HTTP PostgREST reste NON TESTÉ**. Les premières erreurs de fixtures et de configuration TypeScript sont conservées dans `contracts-first.log` et `typecheck-first.log`. La configuration QA charge explicitement les types globaux Next, normalement fournis par `next-env.d.ts`, absent d'un worktree sans build ; aucune modification des fournisseurs concernés par ces types.

Couverture exécutée : état unique/expiration, utilisateur/session/profil/navigateur, callbacks concurrents, neuf plateformes simulées, compte absent/expiré/déconnecté/révoqué, refus fournisseur, GET d'identité, résultat inconnu, historique préservé, résultat distinct par destination, reprise après réponse perdue avec intention/clé identique, contrôle du média vérifié avant POST et après réservation, timeout, succès partiel et retry du seul échec. Les routes cron testées utilisent des fixtures ; aucun cron réel n'est invoqué.

IANA/DST et récurrences : **PASS réutilisé**, pas de nouveau calcul d'ordonnancement. `reused-proof.json` vérifie l'égalité SHA256 du code, du test, des dépendances et du runner avec le manifeste intégré T01. Preuve : `qa/salad-integration-20261014/README.md`, gate `node scripts/run-ci.mjs contracts`. Couverture existante : Paris été/hiver, gap de printemps, deuxième occurrence du fold d'automne selon politique existante, gap de 30 minutes Lord Howe, Kiritimati/changement d'année, cadence hebdomadaire/bimensuelle/mensuelle, HH:mm strict, IANA invalide, fenêtres `(début, fin]`, identité des occurrences et définitions contradictoires. La planification OVH reste **NON ACTIVE / NON PROUVÉE**, constat T01 du 14 octobre 02h25 UTC.

## GitNexus et frontières de preuve

Analyse préalable des symboles modifiés : `issueSocialOAuthState` et `consumeSocialOAuthState` LOW (un appelant direct chacun), `revokeSocialAccount` LOW (route accounts), `boundDigest` HIGH (deux appels directs, deux routes OAuth) annoncé avant édition ; fixture partagée MEDIUM (cinq appelants directs). Routes Next : aucun appelant résolu, inspection directe obligatoire, pas de conclusion « inutilisé ».

Index isolé sans embeddings ni modèle. Le graphe signale une couverture tronquée (1 099 entrées, 599 callees, trois coupes budget) ; aucune certification exhaustive. La revue des imports et les tests bornent le delta social. Analyse des changements avant commit archivée séparément. Aucun symbole d'ordonnancement, journal de publication ou adaptateur Zernio modifié.

**NON TESTÉ** : transport du CAS sur PostgREST réel, navigateur avec consentement tiers réel, rotation/revocation réelle des tokens, délais et permissions du compte fournisseur, publication ou planification réelle. Les preuves intégrées de build/CI/navigateur restent celles de `d8691d8`, elles ne certifient pas ce nouveau delta. T01 garde la campagne intégrée unique.

## Réconciliation d'une révocation non confirmée

Le compte reste `revoked` avec `sutra_revocation_pending=true` après timeout, 503 ou interruption. L'adaptateur existant retourne seulement un booléen : un refus définitif et une issue ambiguë ne peuvent pas être distingués ici. Le choix sûr est donc de conserver la barrière pour tous les résultats non confirmés. Ce blocage n'autorise aucune répétition distante automatique.

T01 devra vérifier l'identité exacte utilisateur/plateforme/compte/profil, la fin de l'opération distante et son résultat auprès de Zernio. Un GET instantané indiquant encore « connecté » ne suffit pas à exclure un DELETE tardif. La levée éventuelle nécessite une décision explicite et une écriture conditionnelle sur la révision encore observée, en conservant le statut révoqué. Seul un nouveau consentement utilisateur pourra ensuite rétablir la connexion. Aucun outil de levée automatique ni modification distante dans ce lot.

L'intégration change le digest des states : les consentements lancés avec l'ancienne version doivent être recommencés. Pas de migration ni de changement de bindings.

## Parcours Matiss, après intégration T01

1. Ouvrir [SUTRA login](https://sutra.purama.dev/login), se connecter, puis [Réglages sociaux](https://sutra.purama.dev/settings/social).
2. Cliquer **Se connecter** uniquement pour les réseaux souhaités : TikTok, YouTube, Instagram, Facebook, X, LinkedIn, Pinterest, Reddit ou Threads. Snapchat, Tumblr, Mastodon, Bluesky et Vimeo ne sont pas proposés comme connexions opérationnelles.
3. Dans le consentement hébergé, choisir son compte et la destination exacte : chaîne YouTube, Page Facebook, profil/organisation LinkedIn ou tableau Pinterest si demandé. Le code demande `scopes=posting` ; contrôler les autorisations affichées avant accord.
4. Revenir dans le même navigateur et la même session SUTRA, dans les dix minutes. Vérifier le compte affiché connecté avant toute autre action. En cas de refus ou d'expiration, repartir de **Se connecter**, sans réutiliser l'ancien lien.
5. Si la connexion reste indisponible : T01 vérifie le diagnostic API. « Profil social non attribué » relève du binding T01 ; « Déconnexion en cours de vérification » relève de sa réconciliation. La page actuelle affiche seulement une indisponibilité générique, défaut transmis à T07. Si Zernio demande une offre, un moyen de paiement ou un supplément X, arrêter : aucune dépense n'est autorisée par ce lot.

Contrat public consulté : [guide officiel Zernio de connexion](https://docs.zernio.com/guides/connecting-accounts). L'existence d'un binding ou d'une clé n'est pas un consentement utilisateur. Aucun compte n'a été connecté par T06 et aucun bouton de publication n'a été déclenché.

Contrôles de clôture : `detect-changes --scope staged --repo "$PWD" --limit 1000` rapporte 64 fichiers, 93 symboles, sept parcours, risque HIGH. Le rendu CLI ne montre que quinze symboles et les noms GET/POST sont ambigus ; revue directe du diff et des cinq fichiers produit réservés, sans certification globale. Les quatre premières alertes gitleaks concernent uniquement des SHA256 recalculés du manifeste (rapport expurgé conservé) ; manifeste reformatté en champs path/sha256 sans désactiver de règle. Espaces de fin de ligne normalisés dans les reçus texte, résultats inchangés.

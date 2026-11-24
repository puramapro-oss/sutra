# T06 — preuves UX/social, 19 octobre 2026

Base T01 exacte : `ab935e59ca4e39776630f05b2ba6c0422c74ec62`. Branche locale : `codex/sutra-t06-ux-social-ab935-20261019`.

**NACK UX sur ab935 non corrigé ; PASS du delta local borné, prêt à intégrer par T01.** Le champ `candidate` des résultats désigne la base : les résultats verts concernent les fichiers corrigés dont les empreintes sont dans `tested-source-manifest.json`. Ils ne certifient ni la production ni un futur candidat intégré.

## Résultats et reproduction

| Statut | Preuve / commande exacte | Portée |
|---|---|---|
| PASS | `python3 qa/t06-ux-social-ab935-20261019/verify.py /Users/matissdornier/purama-worktrees/sutra-final-providers-20261013` | 46 contrôles de blobs/hash et 3 livraisons exactes ; CI38827288351 sur ab935 : 213 assertions sociales (76 OAuth,92 publication,22 configuration,23 autopilot). Réconciliation, aucun nouveau run fonctionnel. |
| PASS réutilisé | `integration.json`, `ci-run.json`, `selected-ci-assertions.txt` | 418 assertions navigateur dans26 familles Chromium/WebKit : création/annulation R74, progression, paramètres, historique, navigation et social. Toutes ne sont pas sociales. Aucun rejeu des suites invariantes. |
| FAIL reproduit | `before/results.json`, `node qa/t06-ux-social-ab935-20261019/browser.mjs --baseline` avant correction | 9FAIL/1PASS sur la base : dialogue/focus, comptes révoqués, champ date, axe, résultats incertains, reprise et diagnostic brut. |
| FAIL reproduit | `occlusion-red/results.json`, `node qa/t06-ux-social-ab935-20261019/browser.mjs --responsive-only --out=occlusion-red` | 320 et375px : pied collant recouvre le champ date focalisé malgré axe0. |
| PASS nouveau | `node qa/t06-ux-social-ab935-20261019/browser.mjs --out=verified-chrome` | **29PASS/0FAIL**, Chrome réel installé, Next dev isolé, comptes et publication interceptés, session/DB locale synthétique. |
| PASS nouveau | même run, `verified-chrome/results.json` | 320/375/768/1280/1440px : débordement, nom accessible, focus, hit-test du champ date, axe WCAG2A/AA+2.1AA : 0violation dans la modale. Captures320/375/1440 et modes client/prêt affichées et inspectées. |
| PASS nouveau | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | 0erreur, `quality.json`/`typecheck.log`. Avant dernier retrait CSS sticky, seul delta produit ultérieur. |
| PASS nouveau | `node node_modules/eslint/bin/eslint.js .` | 0erreur,111warnings préexistants ; `quality.json`/`lint.log`. |
| PASS nouveau | `node node_modules/eslint/bin/eslint.js src/components/social/publish/PublishModalFooter.tsx qa/t06-ux-social-ab935-20261019/browser.mjs` | Dernier delta CSS et harnais ; `final-targeted-lint.json`. |
| NON TESTÉ delta | Build production et WebKit du nouveau correctif | T01 demande explicitement un build mutualisé après intégration ; aucun nouveau build global. Le build CI ab935 PASS reste une preuve de la base seulement. Cache WebKit local absent. |
| BLOQUÉ extérieur | Disponibilité production | T0119:54UTC : application et DB arrêtées depuis17/10, sixGET404 ; reçu `qa/t01-certification-20261019`. Pas de SSH doublon, restart, publication ou déploiement T06. |

Le navigateur reçoit uniquement des fixtures. Le serveur est démarré avec un environnement allowlist de valeurs factices, `qa/t08/offline.cjs`, sans lire `.env*`. Les requêtes non loopback sont bloquées et toute écriture inattendue est comptée. Résultat final : aucune erreur client/hydratation observée, aucune écriture inattendue, aucun appel extérieur tenté, **0publication réelle**. Les onze POST de publication recensés sont exclusivement interceptés par Playwright.

Scan du diff préparé : `gitleaks stdin --redact=100 --no-banner --ignore-gitleaks-allow --report-format json --report-path qa/t06-ux-social-ab935-20261019/secrets-scan.json` → PASS, aucun secret détecté. Aucun fichier `.env*` dans le lot ; aucune source de secrets lue. Seules les lignes vides finales de trois logs ont été normalisées pour `git diff --check`.

## Défauts, causes et corrections

1. Modale artisanale sans sémantique, piège/restauration du focus ni Escape ; liens imbriqués dans boutons et contrastes insuffisants. Réutilisation du `Modal` opérationnel, liens séparés, labels/états pressés, contraste renforcé ; clavier/axe vérifiés.
2. Liste traitant tous les comptes comme connectés et choisissant implicitement le premier. Filtrage statut/expiration/plateforme et refus d'une plateforme ambiguë ; identifiant local du compte fixé dans le payload et conservé à la reprise. Comptes révoqués, expirés, absents, ambigus, erreur et chargement couverts.
3. Date minimum calculée en UTC et sans nom/fuseau. Minimum local, label, IANA et décalage de l'instant visibles ; heure passée/inexistante refusée. Honolulu conversion UTC, Paris saut du28/03/2027 et repli du31/10/2027 vérifiés. Le repli choisit la première occurrence du navigateur et affiche UTC+02 ; pas de sélecteur pour la seconde occurrence.
4. Relance de toutes les destinations et diagnostics fournisseur visibles ; perte de résultats à la fermeture. Reprise des échecs explicites seulement, compte original inchangé, journal complet accepté, succès et incertitudes conservés. Les messages restent génériques et utiles ; résultat perdu/HTTP503/unknown n'autorise aucun second POST.
5. Double clic et modification des champs pendant l'envoi. Garde synchrone, champs figés, fermeture bloquée pendant la requête, délai borné ; aucun renvoi automatique. Brouillon conservé à la fermeture avant envoi, confirmation explicite et lien vers le suivi après envoi.
6. Régression détectée pendant la correction : réponse perdue d'une reprise effaçait aussi le succès d'une autre destination. Conservation des destinations hors reprise ; red `retry-red` puis final green.
7. Pied sticky recouvrant la date à320/375px, trouvé en inspectant les captures puis reproduit par hit-test. Pied remis dans le flux, boutons accessibles en faisant défiler, suppression du flou de ce pied ; cinq largeurs vertes.

Les trois pages appelantes directes sont CreatePage, VideoGrid et VideoList. Aucun API/lib/backend, schéma, connecteur WanGP, binding Zernio ou configuration n'est modifié. Le journal serveur, l'idempotence et le média final vérifié restent l'autorité.

## OAuth et invariant serveur réconciliés

Les assertions exactes CI couvrent state32octets aléatoires, TTL600s, session/utilisateur/profil/secret navigateur liés, consommation atomique, rotation de session, expiration, refus et callback concurrent. Révocation clôturée ou incertaine, reconnexion volontaire, clôture des champs tokens hérités et historique d'autorisation sont conservés. Les données publiques de comptes excluent les tokens/diagnostics.

Le profil fournisseur est lié à l'utilisateur. **Aucune dimension d'organisation native indépendante n'existe dans ce modèle** : ne pas transformer ce contrôle en certification multiorganisation. Zernio conserve les tokens fournisseur ; chiffrement effectif, rotation fournisseur et scopes personnellement accordés ne sont pas démontrables par mocks. Aucune nouvelle clé demandée.

Les92 contrats publication et23autopilot couvrent média vérifié, compte absent, résultat partiel, compte reconnecté, déduplication et réponse perdue : réconciliation GET seulement après résultat incertain. IANA, changement d'heure, quotidien, hebdomadaire, bimensuel=14jours, mensuel et occurrence concurrente restent couverts par les sources/contrats invariants. Pas de nouvelle exécution réelle.

## Interface de création et limites

Le composant existant distingue « API client » de « Personnel open source distant ». Trois contrats simulés client/worker indisponible/prêt ont été affichés ; aucune promesse Mac/gratuité/4K native ni bascule payante automatique ajoutée. Le montant0,125USD visible dans la capture ready est **une fixture**, pas un tarif confirmé. Aucun connecteur T09 implémenté.

Temps navigation→notice789–1475ms sur serveur dev local, une lecture comptes par ouverture et aucune nouvelle lecture lors de frappe/redimensionnement ; une lecture capabilities par navigation. Ces observations ne sont pas un benchmark de production ni une certification complète de performance. Prévisualisation vidéo synthétique : décodage/média réel et génération réelle NON TESTÉS. Lecteur d'écran matériel/VoiceOver et nouveaux tests WebKit NON TESTÉS ; axe/clavier ne s'y substituent pas. Le brouillon de cette modale est conservé en mémoire lors de fermeture, sans nouvelle persistance durable promise.

Deux comptes actifs pour une même plateforme sont bloqués dans cette modale faute de choix explicite ; aucun compte n'est choisi silencieusement. Les réponses incertaines renvoient au suivi et non à un retry. Les flux globaux invariants création/historique/progression/annulation reposent sur la CI exacte réconciliée, pas sur29 nouveaux tests couvrant toute l'app.

## Traçabilité et intermédiaires

`verified-chrome` est la preuve finale. `chromium` est le premier run vert13contrôles. `retry-red` conserve le défaut de reprise pendant correction. `expanded-dev` est INCOMPLET (override timezone refusé dans le harnais, corrigé par un contexte Paris distinct). `expanded-dev-final` contient27PASS et un faux négatif de harnais : refus de cookies local classé à tort comme écriture inattendue. `final-chrome` avait29PASS avant ajout du contrôle de recouvrement ; ce PASS ne détectait pas encore le pied collant. Aucun de ces intermédiaires ne remplace la preuve finale.

GitNexus : impact préalable parentLOW/3appelants, enfantsHIGH/1direct+3transitifs, avertissement donné. Réindexation AST locale sans embeddings/IA, `--index-only --workers 2`. `detect-changes --scope all --limit 100` avant commit : six fichiers, trois interfaces, risqueLOW, zéroprocessus retourné. Cette sortie partielle ne couvre pas les fonctions React modifiées ; ne pas en déduire une absence de portée. Les impacts préalables HIGH et la revue directe restent applicables. Graphe tronqué :1366points d'entrée omis,872callees omis,42parcours limités ; portée non exhaustive, revue directe du diff et tests obligatoires.

## Actions personnelles de Matiss, après rétablissement par T01

1. Ouvrir https://sutra.purama.dev/settings/social dans la bonne session. Pour chaque compte souhaité, choisir « Se connecter » ou « Se reconnecter », sélectionner personnellement la bonne page/chaîne/le bon profil chez la plateforme et accepter seulement les permissions souhaitées.
2. Revenir dans le même navigateur/session avant10minutes ; vérifier « Connecte » et le bon identifiant. Ne pas activer d'automatisation/publication par défaut. Un binding manquant relève de T01, pas d'une nouvelle clé à demander à Matiss.

Les neuf connexions supportées sont TikTok, YouTube, Instagram, Facebook, X, LinkedIn, Pinterest, Reddit, Threads. Les autres cartes restent « Connexion indisponible ». Aucun consentement, achat, compte ou contenu réel n'a été manipulé par T06.

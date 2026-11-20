# T02 — clôture du correctif R121

Base T01 exacte : **0f32bf0b84b51ad82e9ae5bf47d93f3e63442506**.
Dernière livraison T02 conservée : **88b34f1fb063e8f6d90bba941814668e7735711b**, candidat testé fcd0559.
Branche : `codex/sutra-t02-final-memoire-20261020`.
Claim : `SUTRA-T02-20261020:FINAL-MEMOIRE`. Un seul worktree écrit, celui de T02.

## Défaut et correction

La demande T01 de 10:55 et les preuves T07/T08 concernent le **contraste**, pas le contrat de données de « Ma mémoire ».
Reproduction indépendante dans la vraie page DEV, Chromium, session fictive : texte blanc sur `#a855f7`, 14 px, ratio **3,95 < 4,5**, axe `color-contrast` serious aux largeurs 375 et 1440.
`before/results.json` conserve les deux FAIL attendus ; captures avant/après conservées, captures après personnellement affichées.

`src/lib/legal/components/MaMemoirePage.tsx` : remplacement unique de `bg-primary` par la classe existante `bg-purple-700`.
Aucune modification du gestionnaire d'export, du contrat JSON, des textes légaux, des consentements ou de la suppression.
Après correction : **9 PASS, 0 FAIL**, dont axe AA aux deux largeurs, absence de débordement, refus 401/403/503 sans téléchargement ni diagnostic privé, reprise clavier et téléchargement JSON via la vraie route locale.
Les refus HTTP du navigateur sont injectés ; l'autorisation serveur est testée séparément avec la vraie route et le vrai garde de compte.

## Exécutions et provenance

Depuis la racine du worktree, Node **24.22.0** :

```sh
python3 qa/t02-final-memoire-20261020/run.py browser-after
python3 qa/t02-final-memoire-20261020/run.py security
python3 qa/t02-final-memoire-20261020/run.py lint
python3 qa/t02-final-memoire-20261020/run.py typecheck
python3 qa/t02-final-memoire-20261020/verify.py
```

Les tableaux `command` des reçus JSON contiennent les arguments exacts.
Reproduction avant : même environnement filtré et préchargement `qa/t08/offline.cjs`, `node browser.mjs before` (sortie 1 attendue).
Ne pas réexécuter ces commandes sur les répertoires de preuves existants ; le navigateur utilise `mkdir` exclusif pour les préserver.

| Contrôle | Résultat | Preuve |
|---|---|---|
| Page réelle Chromium 375/1440 + export/refus | PASS 9/9 | `after/results.json`, `browser-after.json` |
| Sécurité export, auth/session/cookies/points | PASS 55/55, zéro skip | `security.json`, `security.log` |
| Dont nouveaux tests export | PASS 8/8 | `export-security.test.mts` |
| Lint composant et nouveaux tests JS/TS | PASS, zéro avertissement | `lint.json` |
| TypeScript global sans émission/incrémental | PASS | `typecheck.json` |
| SQL scheduler T02 exécuté en CI sur 0f32 | PASS 7/7, zéro skip | `ci-scheduler-isolation.log`, `verification.json` |
| Provenance des 868 entrées du reçu CI | Vérifiée contre le candidat exact | `verification.json` |
| Différentiel depuis dernier ACK | 69 sources UI + raccord CI ; aucune API/SQL/auth/dépendance modifiée | `verification.json` |
| Gitleaks expurgé, règles inchangées | 106 fichiers texte, 32 alertes d'empreintes vérifiées, zéro alerte inexpliquée | `gitleaks-receipt.json`, `gitleaks-triage.json` |

Les huit tests ajoutés couvrent les comptes anonymes, expirés, bannis, révoqués, l'échec de lecture du profil, deux utilisateurs distincts sur les six tables exportées avec un autre propriétaire forgé dans l'URL, puis la révocation entre deux exports de la même session.
Le garde réel `enforceAccountAccess` reste actif ; seuls les accès Supabase sont fictifs.

Premier essai conservé : 54/55, fixture expirée incorrecte (`user` présent avec `error`). Le SDK installé `@supabase/auth-js/src/GoTrueClient.ts`, `_getUser`, lignes 2933–2974, renvoie `user: null` lors de l'échec d'authentification. Fixture alignée sur ce contrat, sans modifier la route ni affaiblir le garde ; suite finale 55/55.
Premier lint : `prefer-const` dans le nouveau test, corrigé. `initial-*` conserve ces diagnostics.

Pas de nouveau build ni de répétition des suites serveur invariantes. Les 17 reçus historiques (OAuth, SSRF, CSRF, RLS, permissions, RPC production, API/admin/webhooks, stockage et autres frontières) sont vérifiés par empreintes, **pas présentés comme des exécutions fraîches**. Les 32 versions installées contrôlées et les 20 routes cron sont inchangées. Le raccord CI nouveau exécute les sept contre-tests SQL T02 auparavant bloqués par les IPC du Mac ; ce blocage est levé par cette preuve CI, sans toucher aux processus ou segments tiers.

## GitNexus et limites

Impact demandé avant édition, index rafraîchi : requête nominale initiale CRITICAL incohérente/plafonnée, avertissement communiqué ; requête exacte après indexation `UNKNOWN`, symbole non trouvé. Recherche directe : consommateur `/ma-memoire`, réexport du composant dans le barrel légal. Graphes partiels, aucune certification exhaustive d'impact. Analyses précommit `staged` et `compare main` conservées.
Le lot préparé est classé faible par le graphe ; la comparaison historique à `main` reste CRITICAL et plafonnée, avertissement communiqué. Le scan de secrets porte sur son instantané de 106 fichiers, pas sur l'historique Git ni sur la production. Les 32 alertes sont reliées une à une à des empreintes de sources ou de reçus vérifiés ; aucune règle désactivée.
`manifest.json` lie les fichiers livrés et les auxiliaires existants aux empreintes locales. L'ACK postcommit vérifie leur identité avec le commit : les tests ont été exécutés sur la base 0f32 avec ce seul delta produit, avant le commit, sans prétendre à une exécution CI sur le SHA de livraison.

**PASS local borné pour la correction livrée ; aucune certification globale de production.**
Sur le candidat 0f32 non corrigé, R121 reste FAIL. L'intégration et le retest du nouveau candidat appartiennent à T01/T08.
R113 DEV WebKit et R92 HTTPS public 404 restent des réserves T01/T06/T08 ; non rejouées ici.

- **BLOQUÉ** : sécurité réelle WanGP/stockage personnel faute de connecteur T09 disponible/réservé. Exigences déjà livrées dans `88b34f1:qa/t02-recert-fcd-20261020/WANGP-ISOLATION.md` : identité serveur propriétaire, interdiction client, propriétaire stocké côté serveur, espaces de stockage séparés, URLs expirables, réseau/SSRF fermé, aucune clé au navigateur. Pas de développement concurrent ni d'activation.
- **NON TESTÉ** : organisations natives (modèle absent), production RLS/proxy/journaux/rotation historique, consentements et révocation fournisseur réels. Deux utilisateurs ne valent pas deux organisations.
- Réserves inchangées : limites contact par processus, en-têtes applicatifs explicites absents dans les fichiers revus (proxy non testé), URLs déjà signées jusqu'au TTL de 300 s, alertes npm antérieurement triées (7 production / 30 total). Dépendances inchangées ; aucun nouvel avis en ligne interrogé, aucune mise à jour injustifiée.
- La fixture T07 ne fournit pas de date d'acceptation : « Invalid Date » dans ces captures synthétiques ne constitue pas une preuve de défaut sur des données réelles.

Aucun secret réel ou fichier `.env` lu. Aucun appel distant, achat, GPU, génération, publication, push, migration ou déploiement. Variables uniquement fictives, environnement autorisé par noms de variables ; le préchargement bloque les fichiers `.env` et les sorties réseau hors loopback.
L'ACK propriétaire postcommit dans les registres de coordination relie le SHA livré aux empreintes testées. Aucun transfert automatique de cet ACK à un futur SHA.

# T06 — clôture UX et sociale, 20 octobre 2026

Candidat T01 examiné : **79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a**. Branche `codex/sutra-t06-closure-79cd95b-20261020`, worktree propre T06 `sutra-t06-integrated-retest-20261015`. Ancienne livraison4687082 préservée ; six composants intégrés à blobs exacts, deux lignes focus ajoutées par T01 dans PublishTriggerButton.

**ACK propriétaire borné des preuves PASS ; NACK de clôture UX globale sur79cd.** Trois défauts de la page sociale corrigés localement, intégration T01 et qualification production encore requises. Le commit de livraison n'est ni le candidat testé ni un SHA déployé. Les résultats avant correction et les limites ne sont pas effacés.

## Corrections démontrées

Seul produit modifié : `src/app/(dashboard)/settings/social/page.tsx`.

1. Double activation synchrone :2POST `/api/social/connect` avant correction. React state n'est pas un verrou synchrone ; ajout d'une ref AbortController commune aux plateformes. Un seul POST jusqu'à erreur/délai/navigation ; aucun consentement automatique.
2. Requête suspendue : bouton occupé au-delà11s. Délai10s, annulation locale et message persistant accessible, reprise uniquement par action explicite. Sortie SPA annule le fetch et empêche toast/redirection tardifs. Annuler le fetch ne garantit pas qu'un state serveur n'a pas été créé ; le TTL serveur reste l'autorité, aucun retry automatique.
3. Retour OAuth : paramètre `error` arbitraire transmis tel quel au toast, codes internes incompréhensibles. Reproduction isolée sur le véritable effet compilé,6FAIL. Allowlist de messages français pour expiration/usage unique, session, refus, aucun compte, enregistrement et erreur générique ; alerte `role=alert`, suppression du paramètre, aucune donnée brute affichée. Le premier contrôle DOM avait manqué le toast transitoire : son PASS n'est pas une preuve d'absence de fuite.

Aucun API/lib/backend/token/permission/binding changé. La constante de14plateformes est simplement regroupée sur deux lignes pour conserver la règle max-lines300, sans ajout/retrait/changement d'ordre. Composants et design system réutilisés.

## Preuves et commandes exactes

| Statut | Commande / fichiers | Résultat et portée |
|---|---|---|
| PASS réconcilié | `python3 qa/t06-closure-79cd95b-20261020/verify-integration.py` → `integration.json` |44intrants sociaux inchangés,6composants exacts,2lignes focus ;11fichiers de tests sociaux présents dans CI39328438907 SUCCESS sur79cd. Réconciliation, pas44nouveaux tests fonctionnels. |
| PASS réutilisé | reçus CI inclus dans `integration.json` | TypeScript/lint/build et26familles navigateur exactes ; contrats1261PASS/7SKIP historiques. OAuth/state/session/expiration/consommation atomique/rotation de session, révocation incertaine, liaison utilisateur/profil, configuration, publication, IANA/récurrences et CAS inchangés : pas de nouvelle suite globale. |
| INCOMPLET | `node qa/t06-ux-social-ab935-20261019/browser.mjs --webkit --out=<worktree>/qa/t06-closure-79cd95b-20261020/webkit` |25PASS sociaux,0FAILassertion, puis navigation `/create` interrompue par `/library`, exit1. Axe0 à320/375/768/1280/1440. Focus/clavier/brouillon/confirmation/compte absent ou expiré/ambigu, partiel/reprise par compte/inconnu/déduplication/DST. Ne pas présenter29PASS. |
| FAIL conservé | `node qa/t06-closure-79cd95b-20261020/journeys.mjs --out=journeys-before` |11PASS/4FAIL : doublePOST, délai, locale EN, hydration dev. Ancienne version du harnais avant ajout du test callback isolé. |
| PASS partiel / FAIL conservé | même commande `--out=journeys-after` |13PASS/2FAIL après garde/délai. Création vide/refus503/perte réponse/repriseGET/annulationDELETE, social vide/révoqué, trois modes client/worker indisponible/prêt, axe0 social375/1440. Échecs EN/hydratation conservés. |
| PASS delta | `node qa/t06-closure-79cd95b-20261020/journeys.mjs --connect-only --out=connect-chromium` |5PASS : plateformes concurrentes, délai+reprise manuelle, sortie SPA, consentement simulé unique, garde runtime. Avant ajout callback. |
| FAIL → PASS | `node --test qa/t06-closure-79cd95b-20261020/callback-errors.mjs` |6FAIL avant,6PASS après : effet réel compilé, hooks/toast simulés ; aucune exécution backend. `callback-before.log`, `callback-after.log`, `callback-final.log`. |
| PASS delta final | `node qa/t06-closure-79cd95b-20261020/journeys.mjs --connect-only --webkit --out=connect-webkit` |6PASS, dont alerte callback sûre persistante, reconnexion révoquée et tous les contrôles ciblés précédents.0runtime inattendu,0appel externe. |
| PASS | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | `typecheck-final.log`, exit0. Réalisé après redaction callback, avant seul regroupement de constante sans effet. |
| PASS | `node node_modules/eslint/bin/eslint.js 'src/app/(dashboard)/settings/social/page.tsx' qa/t06-closure-79cd95b-20261020/journeys.mjs qa/t06-closure-79cd95b-20261020/callback-errors.mjs` | `lint-corrected.log`, exit0. Échec intermédiaire max-lines et nom module du test corrigés sans désactiver règle. |
| PASS | `node --check qa/t06-closure-79cd95b-20261020/journeys.mjs` | Syntaxe de l'option production demandée par T01 ; chemin production NON TESTÉ ici. |

Les campagnes se recouvrent : ne pas additionner ces compteurs en une suite exhaustive. `source-manifest.json` distingue source candidate, correction intermédiaire et source finale. Les logs et erreurs bruts de fixtures sont conservés. La version finale du harnais ajoute `--production` : réutilise `scripts/ui-isolated/production-server.mjs` et `prepareTLS`, uniquement à lancer par T01 dans sa recette mutualisée. Le helper canonique effectue un build ; **aucun build T06 n'a été lancé**.

Environnement navigateur allowlist synthétique, garde `qa/t08/offline.cjs` : aucun `.env*`/master lu, zéro API externe autorisée. POST OAuth/création/publication interceptés ; aucune génération, aucun achat,0publication réelle et0connexion réelle. Aucun nouveau secret demandé.

## Réserves et frontières

- **FAIL logiciel sur79cd** : titre création français avec `sutra_locale=en` et `html lang=en`. T01 a réservé CreatePage et annoncé le raccord au catalogue, sans nouveauSHA au moment de la livraison. Pas de correction parallèle ni ACK du WIP.
- **FAIL de recette dev** : hydration DashboardChrome reproduite dans les parcours complets, malgré les contrôles ciblés finaux verts. Cause racine/présence en production non établies. T01 a réservé shell/layout et doit qualifier sur son build production mutualisé ; aucune erreur masquée. T08 a aussi rencontré ready-mode absent5s et navigation interrompue : défauts de banc/runtime restent distincts, non annulés par les modes PASS de T06.
- **BLOQUÉ intégration** : nouveauSHA T01 avec ces trois corrections, delta de traduction, autres livraisons et gate production ; aucun ACK transféré automatiquement. R107 est T03/T07, pas résolu par une UI de programmation correcte.
- **NON TESTÉ** : production distante actuelle, compte/consentement réel, publication/génération réelle, chiffrement/rotation fournisseur, scopes réellement accordés, VoiceOver/Safari natif/appareils physiques, décodage d'un média réel, performance production. Aucune organisation native indépendante dans le modèle : utilisateur/session/profil Zernio, sans certification multiorganisation.

Les captures affichées et inspectées : modale320px, social1440px, création indisponible375px et prête1440px. Défilement nécessaire, date mobile focalisée/hit-test vérifiée dans la campagne WebKit ; aucune promesse que tous les boutons soient simultanément visibles. Axe/clavier ne remplacent pas un lecteur d'écran réel. Performance bornée : double requête corrigée, attente maximale10s, aucune nouvelle lecture lors frappe/redimensionnement dans les contrôles sociaux ; pas de benchmark global.

Modes : notices existantes différencient API client et personnel open source distant. Aucun sélecteur permettant au client d'activer WanGP personnel, payload création sans champ personnel ; pas de connecteur T09 implémenté. Les tests UI ne remplacent pas la garde serveur T02. Le montant0,125USD visible est une fixture, pas un tarif. Worker déclaré prêt ne réserve aucune ressource ; indisponible ne déclenche pas de fallback payant.

Scopes/consentement : les contrats SUTRA et l'absence de tokens dans réponses publiques sont couverts par preuves invariantes ; Zernio détient les tokens fournisseur. Chiffrement, rotation/révocation réelle et minimum des permissions réellement présentées ne sont pas certifiés par mocks. Aucun renouvellement de clé demandé.

## GitNexus et livraison

Index AST reconstruit sans embeddings/IA après cache incomplet. Impacts SocialAccountsPage/handleConnect/constante : UNKNOWN,0appelant résolu ; entrée Next et boutons connexion/reconnexion vérifiés directement. Graph tronqué, absence d'arête n'est pas absence d'impact. `detect_changes` produit :1fichier/6symboles/2flux, MEDIUM ; isAutopilotConfig/fetchAccounts/handleDisconnect apparaissent par positions du diff mais leur logique reste inchangée. Revue staged exécutée avant commit :66fichiers/70symboles/2flux, MEDIUM. Compare main :5564fichiers/12455symboles/397flux, CRITICAL sur toute la lignée intégrée, liste plafonnée ; risque annoncé, aucune certification exhaustive. Détails dans `validation.json`. Aucun travail partagé écrasé ; seule coordination append-only dans les miroirs/LOCKS autorisés.

Qualité finale : diff-check source/docs PASS ; diff-check global FAIL uniquement espaces/EOF des logs bruts, conservés. Gitleaks brut détecte4UUID de headers idempotency-key créés par les scénarios locaux `/api/create` ; provenance vérifiée dans `secrets-review.json`, remplacement exact de ces quatre valeurs seulement dans l’entrée du scanner donne0alerte. Aucune allowlist permanente, aucune preuve brute altérée, aucun secret réel consulté. TypeScript/lint ciblés PASS ; le nouveau chemin `--production` est NON TESTÉ.

## Actions personnelles restantes

Après disponibilité confirmée par T01 :

1. Matiss ouvre https://sutra.purama.dev/settings/social dans sa session SUTRA, choisit « Se connecter » ou « Se reconnecter » pour les réseaux voulus.
2. Il sélectionne personnellement le bon compte, la page ou la chaîne et examine/accepte les permissions chez la plateforme. Aucune acceptation par l'agent.
3. Il revient dans le même navigateur/session sous10minutes et vérifie le bon identifiant et l'état connecté. Si expiré/refusé, le message indique comment reprendre ; un profil non attribué relève de T01.

Neuf connexions proposées : TikTok, YouTube, Instagram, Facebook, X, LinkedIn, Pinterest, Reddit, Threads. Les cinq autres restent indisponibles. Aucun compte n'est à connecter pour valider les tests mocks ; aucune publication/automatisation à activer pour cette clôture.

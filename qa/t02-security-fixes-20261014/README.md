# T02 — sécurité, delta du 14 octobre 2026

Base vérifiée T01 : `b7cf848d07fca2734db36a2e30d045ca312a3162`, code intégré `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`.
Branche : `codex/sutra-t02-security-fixes-20261014` ; worktree isolé `sutra-t02-security-fixes-20261014`.
Source actuelle des preuves : `qa/salad-integration-20261014/README.md`, pas l'ancien bilan48f2d5e.
T01 HEAD revérifié pendant le lot : même base, intégration T05 en cours dans son index ; aucun de ses fichiers touché.

## Résultat et portée

| Défaut / risque | Reproduction et cause | Correction / statut |
| --- | --- | --- |
| T02-STORAGE : delete/list service-role sans propriétaire | Dix refus échouaient ; helpers sans contexte ni contrôle de chemin/propriété. Aucun appelant produit trouvé : défaut de garde interne, exploitation HTTP non démontrée. | PASS : contexte `mediaOwner`, validation existante `ownedMediaPath`, `assertMediaOwner` avant suppression, liste limitée au préfixe exact du propriétaire. Inventaire requis pour ancien objet ; dossier partagé legacy non listable. |
| T02-PROOF : diagnostics internes publics | Cinq marqueurs synthétiques exposés dans les erreurs DB/vérification/exception de `/api/verify/[videoId]`. | PASS : diagnostics retirés ; statuts400/404/409/500 et réponses pending/verified conservés. Preuve et URL de preuve intentionnellement publiques inchangées. |
| T02-OTS-REDIRECT : transport request vulnérable | `request@2.88.2` choisit trois destinations internes après302, dont HTTPS→HTTP. `RemoteCalendar.getTimestamp` et Esplora utilisaient ce transport sans protection de redirection. Preuve locale de décision, pas exploitation distante. | PASS local : quatre méthodes réseau Calendar/Esplora remplacées une fois au chargement du wrapper SUTRA ; HTTPS/destinations contrôlées, DNS entièrement public puis adresse épinglée, aucune redirection,10s par requête incluant DNS,10Ko calendrier/64Ko bloc, encodage identity, diagnostics constants. |
| T02-OTS-EMPTY : faux succès après échec des calendriers | FAIL reproduit : OTS absorbe les erreurs des quatre calendriers et résout sans attestation. | PASS : `stampMp4` refuse une preuve sans attestation avec `SUTRA_OTS_STAMP_FAILED`. |
| Session → propriété média → signature | Nouveaux tests composés : session expirée malgré objet user, accès Bob→Alice, révocation entre requêtes, panne profil. | PASS :401/404 sans signature ni diagnostic ;307 propriétaire valide puis401 après révocation. |

Le transport réutilise `validateMediaUrl` et `isPublicMediaAddress`. L'API amont ne fournit pas d'injection de transport : seules les méthodes réseau de ses classes Calendar/Esplora sont remplacées durablement, jamais le HTTP global ni les fichiers node_modules. Aucun remplacement temporaire sujet aux courses. Le parseur binaire, les opérations Merkle et `verifyAgainstBlockheader` restent ceux d'OTS0.4.9. `ignoreBitcoinNode:true` conserve la vérification via l'explorateur public et interdit la découverte implicite de bitcoin.conf/RPC local. Cela reste le modèle de confiance historique d'un explorateur, pas une validation indépendante de toute la chaîne Bitcoin. Toute mise à jour de la dépendance doit rejouer ces contrats internes.

## Tests exacts (hors réseau fournisseur, fixtures seulement)

Node24.21.0 : `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node`.
Environnement enfant limité à PATH/LANG, aucun secret hérité. Précharge `qa/t08/offline.cjs` : réseau externe et lecture `.env*` refusés ; transports DNS/HTTPS/DB mockés dans les nouveaux tests. Aucun socket requis par T02.

```sh
python3 qa/t02-security-fixes-20261014/run.py --node /Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --phase red
python3 qa/t02-security-fixes-20261014/run.py --node /Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --phase green
python3 qa/t02-security-fixes-20261014/run.py --node /Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --phase session
python3 qa/t02-security-fixes-20261014/run.py --node /Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --phase ots
python3 qa/t02-security-fixes-20261014/run.py --node /Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --phase quality
```

`red` est la preuve AVANT correctif : relancer cette commande sur le commit corrigé devient vert. Les manifestes conservent les empreintes réellement testées.

| Preuve | Résultat |
| --- | --- |
| `reproduction.log`, `red-manifest.json` | FAIL attendu avant correction :15 FAIL /3 PASS. |
| `targeted.log`, `green-manifest.json` | PASS :28 tests,0 échec (18 nouveaux,10 régressions stockage/média). |
| `session-media.log`, `session-manifest.json` | PASS :4 nouveaux tests. |
| `request-redirect-reproduction.json` | Trois décisions vulnérables FAIL du transport installé, sans socket ; dépendance non modifiée, chemin applicatif remplacé. |
| `ots-empty-stamp-red.log` | FAIL avant garde attestation :21 PASS /1 FAIL /1 SKIP. |
| `ots.log`, `ots-manifest.json` | PASS :23 tests (16 nouveaux,7 régressions binaires OTS),0 échec,1 SKIP réseau explicite. |
| `lint.log`, `types.log`, `quality-manifest.json` | PASS : ESLint des fichiers touchés et TypeScript du sous-graphe importé, sans incrémental. |

**Total final :55 PASS /0 FAIL /1 SKIP**, dont38 nouveaux tests et17 régressions concernées. Les échecs initiaux de montage du harness OTS et de fixtures sont conservés séparément (`ots-harness-initial-failure.log`, `ots-fixtures-first.log`), puis corrigés ; ils ne sont pas des vulnérabilités comptabilisées. Les fixtures Bitcoin sont synthétiques ; aucun ancrage réel annoncé.

Les journaux versionnés ont uniquement leurs espaces de fin de ligne et lignes vides finales normalisés. Le lint du diagnostic CommonJS est également PASS (`lint-qa.json`), après remplacement de console.log par stdout.write.

`run.py` contient les commandes Node exactes et chaque manifeste leur code de sortie. `tsconfig.json` inclut les nouveaux tests, lesquels importent les vrais modules produit. Réutilisation du node_modules existant après égalité du package-lock vérifiée ; aucun install ni changement package/lock.

## Périmètre vérifié sans rejouer les suites inchangées

`reused-evidence.json` atteste47 chemins identiques à la base T01 (sources, tests, dépendances, migrations pertinentes). Les PASS ci-dessous sont **réutilisés de la CI38494320084 et des reçus T01**, pas de nouveaux appels runtime T02.

- Auth serveur/permissions/session : compte contrôlé côté serveur, refus session et profil ; tests account/auth-session/security-routes de la gate666. Quatre nouveaux tests composés renforcent la frontière média.
- Propriétaire/client/moteur personnel : suite actuelle `qa/t02-salad-security-20261014/test-t02-salad-security-contract.mts`, host/worker intégrés ; accès client au moteur, token absent, URL interne et redirection couverts dans la gate. Aucun ancien rouge legacy repris. T04 conserve les adaptations worker actives.
- Cron : `assertCronAuth` canonique inchangé ; aucun mécanisme concurrent.58 refus cron/OAuth du reçu T01 réutilisés. T01 rapporte aucun ordonnanceur autonome actif ; activation hors lot.
- Isolation utilisateur/organisation et RLS : migrations/permissions PostgreSQL réelles de la CI T01 réutilisées ; aucune migration distante ni nouvelle preuve RLS live. Médias privés liés à l'utilisateur ; organisation Zernio liée côté serveur. T06 conserve OAuth/state/expiration/rotation/révocation et ses nouveaux correctifs concurrents.
- Stockage privé/URLs signées/propriété : tests privés intégrés et nouveaux refus storage/session. Une URL signée déjà émise peut rester valable jusqu'à son TTL300s ; le test prouve le refus d'une nouvelle signature après révocation, pas l'invalidation instantanée d'un lien existant.
- SSRF/téléchargements : downloader opérationnel inchangé (DNS public, épinglage, redirections revalidées, taille/type/signature) ; réutilisation des tests security-media. Nouveau chemin OTS testé séparément.

## Dépendances

Commande effectuée une seule fois avec environnement réduit, registre public uniquement : `npm audit --omit=dev --json --ignore-scripts` ; code1 conservé dans `dependencies-audit.json`. **2 low +5 moderate,0 high/critical**. Aucune mise à jour majeure aveugle, aucun `audit fix --force` (proposition de rétrogradation opentimestamps0.0.0 rejetée).

- [GHSA-p8p7-x288-28g6](https://github.com/advisories/GHSA-p8p7-x288-28g6), request : applicable au transport OTS initial. Mitigation applicative testée ci-dessus ; le paquet transitif reste signalé, aucune version request corrigée publiée dans l'avis. Nettoyage architectural de cette chaîne à attribuer par T01.
- [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), uuid : cas v3/v5/v6 avec buffer externe ; request utilise v4, aucun appel vulnérable applicatif identifié. Override aveugle v11 incompatible avec require(uuid/v4).
- [GHSA-848j-6mx2-7j84](https://github.com/advisories/GHSA-848j-6mx2-7j84), elliptic : signature ECDSA ; OTS consomme bitcore pour analyse de transactions, aucune signature par clé privée applicative identifiée. Avis sans version corrigée. Ces deux constats limitent l'applicabilité ; ils ne suppriment pas les alertes npm.

## GitNexus, livraison et limites

Index isolé créé avant édition, analyse d'impact sauvegardée dans `gitnexus/`. delete/list/GET proof : UNKNOWN,0 appelant résolu ; recherche directe confirme aucun appelant produit des helpers storage, GET reste une route Next implicite. stampMp4/attemptUpgrade/verifyProof : LOW, appelants preuve publique/cron upgrade/pipeline identifiés. Couverture du graphe tronquée (1095 entrées candidates exclues,597 callees perdus,3 coupures) : aucune exhaustivité revendiquée. `detect-changes.txt` : risque MEDIUM,16 symboles/5 flux attendus (upgrade/preuve), aucun fichier produit hors scope. Le nouveau transport ne figure pas dans le graphe de base : revue directe et tests dédiés, pas de garantie exhaustive. `validation-final.json` consigne les contrôles finaux. Les trois alertes initiales du scanner étaient exactement les SHA256 du fichier account-access.ts dans les manifestes (égalité vérifiée) ; présentation convertie en liste path/sha256, sans filtre ni exclusion de secrets. Rapports expurgés conservés.

PASS local ne signifie pas intégré ni déployé. T01 seul intègre et exécute la gate globale sur le candidat final ; aucune gate/build globale identique rejouée ici. Les nouveaux tests `test-t02-security-fixes-{storage,proof,session-media,ots}.mts` doivent être ajoutés à sa gate contrats.

BLOQUÉ préexistant hors lot : qualification/activation GPU distant non autorisée et non disponible ; aucune tentative. NON TESTÉ ici : consentements/publication, fournisseurs live, calendriers OTS live, Bitcoin réel, RLS distante, rendu/génération, navigateur et build global après delta. Le maître des secrets n'a pas été lu ni copié : ce lot n'en a besoin d'aucun. Aucun .env.local créé, aucun SSH, push, fusion, déploiement, migration, paiement ou IA Mac.

Aucune action utilisateur nécessaire pour appliquer le lot local. Seul T01 décide de l'intégration ; les activations fournisseurs/consentements restent les actions externes de son rapport actuel, sans répétition des anciens blocages RunPod/Shotstack résolus.

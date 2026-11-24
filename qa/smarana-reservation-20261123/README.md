# Adoption des réservations SMARANA qualifiées — 23 novembre 2026

## Résultat

**PASS local pour ce lot.** SUTRA adopte
`purama-smarana@7a6b5b8583ec9f0a5b1c1da5bf59f8486d545e47` dans le manifeste
et le verrou existants. La base SUTRA est
`3a7d538deb529d14dc30815ede85b45aa525b91b`, PR #3,
`codex/sutra-verification-20261011`. Les autres entrées du verrou restent
identiques ; aucune migration, configuration ou option fournisseur ne change.

La version précédemment installée, `206162459bd89ce8ffce97a0c91fc0dc72ae1941`,
avait les contrôles de consentement et d'annulation mais pouvait remettre dans
le pool une connexion SQL dont BEGIN, COMMIT ou ROLLBACK n'était pas confirmé.
Le correctif SMARANA existant détruit ces connexions ambiguës, conserve la
réservation déjà confirmée et ne relance aucun appel payant.

## Preuves

| Porte | Résultat |
| --- | --- |
| Installation verrouillée, scripts initialement désactivés | PASS, 1 090 paquets |
| Reconstruction des scripts d'installation sans identifiants de dépôt | PASS |
| Identité des sources SMARANA installées | PASS, 14/14 fichiers source identiques au commit autorisé |
| Tests existants storyboard/chat et quatre cas supplémentaires | PASS, 21/21 entrées Node, zéro exclusion |
| Contre-épreuve avec le module précédent | Quatre régressions d'incertitude reproduites ; restauration exacte vérifiée |
| TypeScript global | PASS, code 0 |
| ESLint global | PASS, zéro erreur, 74 avertissements hors du delta |
| Build Next 16.4.5 / Webpack | PASS, code 0, génération 199/199 achevée |
| Contrôle du diff | PASS |

La contre-épreuve remplace uniquement le module installé par le blob authentique
de l'ancienne révision, exécute les mêmes tests puis restaure ses octets dans
un `finally`. Les quatre sous-tests échouent, ce qui fait aussi échouer leur
conteneur Node : le compteur 5 FAIL n'est donc pas présenté comme cinq défauts
indépendants. Le fichier `reproduction.json` conserve l'identité et le résultat
de cette manipulation de test.

Les nouvelles assertions traversent `generateStoryboard` et le vrai SDK
installé. Elles imposent une connexion réservée et libérée une seule fois,
la destruction des connexions ambiguës, le code LIMIT préservé si le rollback
échoue et zéro appel OpenAI/Anthropic lorsque l'admission échoue. Le client SQL
et les réponses des fournisseurs sont simulés dans ces tests SUTRA. Les vraies
transactions et destructions de backend sont qualifiées séparément dans
SMARANA, dossier `docs/qa/storyboard-reservation-20261123`.

## Commandes et environnement

- `npm ci --ignore-scripts --no-audit --no-fund`
- `npm rebuild --no-audit --no-fund`
- `node --experimental-test-module-mocks --import tsx --test scripts/test-storyboard-provider.mts`
- `npm run check`

Le lanceur `npm run check` existant utilise des paramètres synthétiques et son
garde réseau habituel, puis exécute TypeScript, ESLint et le build Webpack.
Ses résultats bruts sont copiés dans `quality-results.json`. Les journaux sont
conservés en `.log.gz`, sans modifier leurs octets, et leurs empreintes avant
et après compression figurent dans `verification.json`.
Node 24.22.3 ; npm 11.19.1. Les avertissements Next sur `middleware`, Edge et le
cache Webpack restent visibles dans le journal ; aucun réglage n'a été changé
pour les masquer.

L'accès Git direct au dépôt privé SMARANA n'était pas authentifié. Ses fichiers
ont été récupérés par le connecteur GitHub autorisé et l'arbre/commit exacts
reconstruits localement. Une substitution Git limitée au processus d'installation
a fourni cet objet exact à npm, sans modifier les URL ou les autres entrées du
verrou. Cela qualifie l'installation de la source correcte ; cela ne prouve pas
le fonctionnement du secret GitHub Actions `SMARANA_READ_TOKEN`.

## Limites et reprise

Les contrôles globaux historiques de média, mobile et navigateur n'ont pas été
relancés pour ce seul changement de dépendance. La nouvelle CI distante reste
à recevoir après publication. Aucun fournisseur réel, génération payante,
transaction, migration ou déploiement n'a été exécuté. La PR existante reste
la cible d'intégration ; aucun doublon de projet ou de proposition n'est créé.

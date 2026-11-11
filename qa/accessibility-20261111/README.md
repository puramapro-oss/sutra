# SUTRA — qualification locale de l’import SRT

Cet instantané décrit les vérifications du 11 novembre 2026 **avant publication**, sur la base de PR nº 18 `68a0e28f010d77d721b3cf41f69d2c47362535c3` (arbre `59d262d2f4b4a0139c8c228afc061bfbb14f337f`). Les sources testées sont identifiées dans [acceptance.json](acceptance.json). Ces reçus ne décrivent pas l’état actuel de GitHub, de sa CI ou de la production.

| Contrôle | Résultat |
| --- | --- |
| Suite existante avant modification | **PASS — 49/49** |
| Nouveaux cas sur le parseur d’origine | Sept régressions reproduites : 52 réussites et sept échecs sur 59 |
| Suite après correction | **PASS — 59/59**, aucun cas ignoré |
| ESLint ciblé et `git diff --check` | **PASS** |

Le correctif reconnaît CRLF, CR, le BOM initial, les fins de ligne mixtes et les séparateurs contenant espaces ou tabulations. Les assertions conservent le texte multiligne, la ponctuation, les espaces internes et les temps des cues, puis utilisent le vrai handler d’export. Les styles et le sérialiseur SRT déjà corrigés restent inchangés. L’authentification et la traduction externe sont simulées ; les appels réseau inattendus sont bloqués.

## Reproduction et reçus

Depuis la racine du dépôt, avec ses dépendances de test disponibles :

```bash
node --experimental-test-module-mocks --import tsx --test scripts/test-subtitles-route.mts
node node_modules/eslint/bin/eslint.js src/lib/subtitles.ts scripts/test-subtitles-route.mts
git diff --check
```

Les résultats complets sont dans [baseline-49.log](baseline-49.log), [red-import-lines.log](red-import-lines.log), [green-import-lines.log](green-import-lines.log) et [lint.log](lint.log). Les fichiers `*-command.json` conservent les commandes, répertoires historiques et codes de sortie. Le rouge correspond aux nouveaux tests appliqués au blob de production d’origine ; relancer la recette sur les sources corrigées doit donner le vert.

## Limites

`parseSRT` est exporté, mais l’analyse des références n’a trouvé **aucun consommateur produit direct** : ses appels se trouvent dans le script de tests. Aucun nouveau parcours utilisateur d’import n’est ajouté ou qualifié.

La base cible a avancé à `51196fe2c04ea7fd5897744d36cc698e9d0855c7`. La comparaison comprend 13 fichiers, sans changement des deux fichiers de ce lot ; la composition avec cette base n’a toutefois pas été exécutée lors de cette vérification locale. **Compilation complète, CI distante, appareils, lecteurs d’écran et production : NON TESTÉS par ce lot local.**

# T02 — validation sécurité finale, 14 octobre 2026

Base T01 vérifiée : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`, branche `codex/sutra-final-providers-20261013`. Lot isolé : `codex/sutra-t02-final-validation-20261014`, worktree `/Users/matissdornier/purama-worktrees/sutra-t02-final-validation-20261014`. Réservation `SUTRA-T02-20261014:FINAL-VALIDATION` dans les deux LOCKS canoniques avant écriture. Aucun fichier produit, dépendance, migration, OAuth ou worker modifié.

**Résultat local : 14 PASS / 1 FAIL / 0 SKIP.** Le défaut T02-FINAL-01 reste ouvert chez T03/T01. Ce lot est une livraison de preuves et de régressions, pas une certification globale ni un correctif produit supplémentaire.

## Vérifications et preuves

| Risque | Résultat | Preuve et portée |
| --- | --- | --- |
| Correctifs T02 précédents effectivement intégrés | PASS | `integration.json` : neuf fichiers source/tests du lot `a01c7a26f60280953187b33401d46a9c27985661` identiques, ainsi que le lockfile. Gardes stockage, erreurs publiques de preuve, transport OTS et attestation vide conservés. |
| Propriétaire → signature → téléchargement privé | PASS, 11 nouveaux tests | `media.log` : accès Alice autorisé, Bob→Alice et contexte absent refusés avant Storage/réseau ; TTL300 ; URL interne/métadonnées/HTTP et DNS privé refusés ; redirection malveillante refusée ; expiration403 sans nouvelle signature ; erreur transport expurgée. Vrais modules privés et téléchargement, seuls Storage/DNS/HTTPS simulés. |
| Session → route production → soumission | PASS, 3 nouveaux tests | `production-error.log` : anonyme401 et session expirée401 avant lecture service-role/RPC ; utilisateur actif202 sans exécution worker. Vraie garde compte, route et helper de soumission. |
| Confidentialité des erreurs de soumission | **FAIL T02-FINAL-01** | Le quatrième test de `production-error.test.mts` prouve qu'un diagnostic RPC synthétique traverse la réponse HTTP503 d'un utilisateur authentifié. Assertion de confidentialité conservée ; aucun skip/TODO ni inversion. |
| Auth compte, cron, isolation/RLS, stockage, moteur personnel | PASS réutilisé sur sources inchangées | CI T01 `38508390596`, source `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164` ; `reused-evidence.json` atteste arbres source/scripts/configs/dépendances identiques. Contrats805 PASS/7 SKIP et PostgreSQL jetable254 assertions RLS ; ne pas additionner les totaux qui se recouvrent. |
| SQL ajouté après la CI : lecture affirmations | PASS réutilisé | Seul delta migrations : `20261014_affirmations_read_permission.sql`. Huit contrôles T01 archivés dans `qa/final-delta-20261014/affirmations-database.json` : refus initial, idempotence, lecture compte actif, écriture refusée, révoqué/inconnu sans lignes, anonyme refusé, rollback. Aucune exécution DB par T02. |
| TypeScript et lint du delta | PASS | `quality-manifest.json`, `types.log`, `lint.log`. Compilation du sous-graphe importé ; pas de build global répété. |

La gate contrats actuelle inclut les tests `test-security-account`, `test-auth-session`, `test-private-media`, `test-security-media`, `test-security-routes`, les quatre tests du lot T02 précédent et `qa/t02-salad-security-20261014/test-t02-salad-security-contract.mts`. Le vieux script Salad hors gate n'est pas une preuve actuelle. `assertCronAuth` demeure l'unique garde cron : secret absent/invalide refuse, comparaison sûre, aucun mécanisme concurrent. Les limites de runtime/ordonnanceur décrites par T01 ne sont pas requalifiées par des mocks.

La propriété des médias testée est liée à l'utilisateur. Le rattachement organisation/profil social est la frontière T06, couverte par ses contrats intégrés : aucune nouvelle preuve multi-organisations réelle ni consentement OAuth exécuté ici. Une URL signée déjà délivrée peut rester utilisable jusqu'à son TTL300s ; refus de nouvelle signature après révocation ne signifie pas invalidation instantanée des anciennes URLs.

## T02-FINAL-01 — diagnostic interne exposé, relais T03/T01

- Reproduction : la RPC simulée `submit_video_job` renvoie `error.message = T02_SYNTHETIC_DATABASE_DIAGNOSTIC`. La route reçoit une session active et une requête valide ; elle renvoie503 contenant ce marqueur.
- Cause : `src/lib/pipeline-submit.ts:37` concatène le diagnostic dans l'exception `SUTRA_SUBMISSION_UNCONFIRMED`. `src/app/api/production/route.ts:145` extrait le message, puis `:151` le renvoie brut.
- Portée démontrée : diagnostic interne du backend visible à un utilisateur authentifié lors d'une erreur de soumission. Aucun contournement de session, appel fournisseur ou secret réel exfiltré démontré.
- Correction attendue du propriétaire : limiter les erreurs publiques à des codes/messages autorisés, préserver quota403, conflit409, requête400 et indisponibilité503, ainsi que reprise/idempotence. Contrôler les autres consommateurs du helper. Ne pas supprimer la garde ni assouplir l'assertion.
- Fichiers d'orchestration T03 ; intégration T01. Aucun changement parallèle. Handoff canonique `.coord/handoffs/SUTRA-20261012/T02-FINAL-VALIDATION-20261014.md`, signalement ajouté aux deux LOCKS. ACK T01 reçu le14/10 à13:57:52UTC : réservation `ACK-T03-SUBMISSION-REDACTION`, T03 seul autorisé à corriger le helper et les consommateurs nécessaires. Correction/ACK T03 non reçus à la remise : **BLOQUÉ côté T02 par ownership**, pas par un manque d'autorisation générale de corriger.

L'impact exact `submitVideoJob` est **CRITICAL** : cinq appelants directs (`auto/generate`, `create`, `cron/sutra-auto`, `production`, `video/export`) ; alerte communiquée avant toute modification éventuelle. `gitnexus-submission-impact-exact.json` remplace la requête ambiguë conservée séparément. Le POST de route est UNKNOWN sans appelant résolu ; cela ne signifie pas inutilisé.

## Commandes reproductibles

Node utilisé : `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node` (24.21.0). Les commandes initiales exactes sont dans `initial-results.json` et `initial-manifest.json` ; celui-ci a été établi après exécution, avec sources toujours identiques au manifeste qualité. Aucun test inchangé rejoué pour produire le manifeste.

```sh
python3 qa/t02-final-validation-20261014/run.py --node /Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --phase media
python3 qa/t02-final-validation-20261014/run.py --node /Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --phase production-error
python3 qa/t02-final-validation-20261014/run.py --node /Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node --phase quality
```

`production-error` sort1 tant que le défaut est présent. Les deux autres phases sortent0 sur cette base. Le runner exécute les tests avec seulement PATH/LANG, sans secrets hérités ; précharge `qa/t08/offline.cjs` pour interdire les lectures `.env*` et le réseau externe. Les transports sont simulés ; aucun socket requis. Dépendances existantes réutilisées par lien après égalité du lockfile, aucune installation.

T01 pourra raccorder ces deux fichiers de tests à sa gate après correction du défaut et intégration contrôlée. Le fichier rouge est livré sous QA ; la liste explicite de CI n'est pas modifiée par T02.

## Dépendances, graphe et limites

Audit dépendances réutilisé du même lockfile et de la CI exacte : `npm audit --omit=dev --audit-level=high`, **2 low / 5 moderate / 0 high / 0 critical**. Cela n'est ni une nouvelle consultation du registre ni l'absence de tout avis. L'applicabilité request/OTS et sa mitigation locale, uuid et elliptic est documentée dans `qa/t02-security-fixes-20261014/README.md` ; fichiers concernés inchangés. Aucune mise à jour massive ou majeure proposée.

GitNexus isolé, sans embeddings/IA : index actualisé uniquement ici, puis analyse des changements avant commit. Graphe tronqué dès la base (1143 entrées candidates exclues,667 callees,3 coupures) : exhaustivité UNKNOWN. Les fichiers `gitnexus-*` et `validation-final.json` consignent portée, analyses et contrôles finaux ; aucun résultat de graphe ne remplace les assertions exécutées.

**NON TESTÉ dans ce lot** : production/DB distante, OAuth/connexions/rotation réelles, fournisseurs/calendriers Bitcoin réels, GPU/Salad réel, génération/export/publication, navigateur et build global nouveau. Les reçus T01 de production sont seulement des preuves archivées, pas une vérification live T02. Aucun besoin de secret : maître ni lu ni copié, aucun `.env.local` créé. Aucun achat, réseau fournisseur, calcul IA Mac, SSH, migration, push, fusion ou déploiement.

Action restante du coordinateur : attribuer/résoudre T02-FINAL-01 avec T03 puis rejouer le test rouge et les consommateurs concernés. Aucune action de consentement ou saisie de secret nécessaire à ce correctif. T01 a reçu le signalement ; livraison T03 et intégration finale restent à confirmer.

# T04 → T01 / T08 — fournisseurs, 16 octobre 2026

Branche `codex/sutra-t04-auth-final-20261016`, parent confirmé **f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5**, worktree `/Users/matissdornier/purama-worktrees/sutra-t04-auth-final-20261016`. Le SHA de livraison est celui du commit contenant ce fichier ; il est relayé intégralement dans `.coord/handoffs/SUTRA-20261012/T04-AUTH-FINAL-20261016.md`. Intégration réservée T01, aucun ACK ou déploiement présumé.

## Correction et preuves

- Notice `src/lib/salad/container/README.md` corrigée : Dockerfile, packaging de production et versions épinglées existent déjà. Construction/image finale et GPU restent non qualifiés. Aucun symbole produit modifié, aucun adaptateur recréé.
- Diagnostic gratuit via adaptateurs existants, 15 tests offline PASS, TypeScript/lint/AST Python PASS. Le code des sept fournisseurs est identique au candidat T01 : 1042 fichiers comparés, preuve CI 1199 PASS / 0 FAIL / 7 SKIP réutilisée, dont 155 assertions nommant ces fournisseurs (compteurs non additifs).
- Rapport complet avec contrats officiels, commandes, limites et protocole GPU : [qa/t04-auth-final-20261016/README.md](qa/t04-auth-final-20261016/README.md). Reçu réel : `free-reads.json`, une exécution, 5 GET, zéro retry/mutation/génération.

## Verdicts à transmettre à T08

| Fournisseur | Résultat gratuit exact | Suite minimale |
| --- | --- | --- |
| Salad | BLOQUÉ local, 0 HTTP : `SALAD_API_KEY` malformée après dotenv ; `SALAD_ORGANIZATION_NAME` et `SALAD_PROJECT_NAME` absentes | Saisie privée de ces trois champs depuis https://portal.salad.com/ ; aucun provisioning nécessaire pour la lecture du compte |
| Pexels | BLOQUÉ local, 0 HTTP : `PEXELS_API_KEY` malformée après dotenv | Remplacer par la clé littérale de https://www.pexels.com/api/key/ |
| ElevenLabs | BLOQUÉ externe : 401 `invalid_api_key` via GET officiel/`xi-api-key` vérifiés dans le vrai adaptateur | Vérifier/remplacer `ELEVENLABS_API_KEY` par une clé active autorisant les voix ; https://elevenlabs.io/docs/overview/administration/workspaces/api-keys |
| RunPod | PASS health 200 sur l'endpoint configuré, aucun test d'administration, zéro worker prêt observé | Exécution, crédits et GPU NON TESTÉS |
| Shotstack stage/production | PASS templates 200 dans les deux environnements | Rendu/facturation NON TESTÉS |
| SunoAPI | PASS credit 200 et crédits disponibles ; fournisseur tiers identifié | Musique/facturation NON TESTÉES |
| LTX V2 | PASS contrats hors ligne ; authentification/crédits/génération NON TESTÉS | Pas d'endpoint gratuit de compte documenté ni de job existant fourni ; webhook signé/annulation distante indisponibles dans le contrat utilisé |

Les guillemets dotenv valides sont acceptés par les tests : Salad/Pexels ne sont pas refusés pour un simple emballage `.env`. Le 401 ElevenLabs est un refus de clé, pas la preuve d'un quota épuisé ou d'une permission manquante. Aucune valeur, empreinte de secret ou réponse brute conservée. Master inchangé, aucune copie `.env.local`, aucune connexion OVH.

## Limites et périmètre exact

CI globale f36013a **FAIL** : deux gardes navigateur repris exclusivement par T01, sans lien démontré avec les adaptateurs. Les contrats PASS ne constituent pas une certification release. GitNexus isolé partiel : exhaustivité UNKNOWN ; détection staged low, 0 flux produit détecté ; compare-main critical sur l'historique complet, avertissement donné et rapports conservés. Scanner de secrets du diff PASS, zéro finding ; aucune certification exhaustive revendiquée.

Fichiers de livraison : la notice Salad, ce handoff, ajouts propres dans `BATON.md`/`task_plan.md`, et exclusivement `qa/t04-auth-final-20261016/**` (scripts/tests, reçus expurgés, réutilisation CI, contrôles locaux et GitNexus). Aucun fichier Shotstack, pipeline, OAuth, UI, SQL ou production modifié. La liste exacte est donnée par `git show --name-only` du SHA relayé.

Salad reste désactivé : build Linux, digest final, poids/licences, journal PostgreSQL/TLS et stockage, qualification GPU/VRAM, coûts et interruption réels restent à préparer/autoriser par T01. Aucun GPU, téléchargement massif, rendu, musique, vidéo, publication, push ou déploiement exécuté. Après correction des seules variables bloquantes, ne rejouer que les GET affectés.

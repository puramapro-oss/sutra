# Défauts présents sur e09 — transmission aux propriétaires

Les messages propriétaires sont figés dans `coordination/`. Leurs correctifs locaux ne sont pas considérés intégrés. Aucune édition produit par T08.

| ID / propriétaire | Reproduction minimale | Attendu | Observé / preuve |
| --- | --- | --- | --- |
| R49 / T02-FINAL-01 → **T03**, attribution T01 | `python3 qa/t08-closure-20261014/run.py production-error` ; session active, POST `/api/production` étape script, RPC `submit_video_job` retourne un diagnostic synthétique | HTTP503 public expurgé ; session absente401 ; soumission normale202 | 3 PASS / **1 FAIL** sur e09 : marqueur interne dans le corps503. `production-error.log`. Cause `pipeline-submit.ts` propage `error.message`, route le restitue. T03 annonce4 PASS local après correctif, retest intégré attendu. |
| R50 / **T03**, SQL **T01** | Fixture `VideoJob` processing, résultat final `null`, kind create/export/auto/production ; appeler `runVideoJob`. Variante musique none, ACK finish perdu, ligne relue done avec skip sans valeur/null cohérent | `SUTRA_RECONCILIATION_REQUIRED` / `SUTRA_JOB_FINISH_UNCONFIRMED`, aucun appel payant supplémentaire | Auteur sur e09 :10 FAIL/1 PASS ; null/skip contradictoire acceptés. `scripts/test-t03-durable-reliability.mts` est le repro propriétaire à importer après gel. SQL canonique7 PASS/5 FAIL ; intégrité checkpoint et identités fournisseur sous responsabilité T01. |
| R51 / T06-VALIDATION-01 → **T06** | Compte connected avec média vérifié ; après préparation du journal, supprimer/changer le binding profil, retirer metadata ou mettre révocation pending ; lancer create/replay/retry | Zéro nouveau POST/replay/retry sous autorité obsolète ; GET de réconciliation/historique conservés | Auteur14 FAIL/4 PASS sur e09 ; `scripts/test-t06-social-validation.mts`. Correctif local18 PASS annoncé, non intégré. Pas de publication réelle. |
| R41 / LEGAL-UI → **T07** | Identité synthétique nécessitant consentement légal ; ouvrir375 puis1440px, suivre lien mentions, parcourir Tab, laisser requête acceptation suspendue | Lien légal disponible, focus retenu et rendu accessible, délai borné avec erreur exploitable | Auteur e09 : lien `/mentions`404, focus sortant, contraste insuffisant, attente sans échéance ;15 PASS local annoncés après correctif. Ce modal est distinct du cookie R40 déjà PASS. |
| R52 / PLAYER-UI → **T07** | Ouvrir éditeur375/1440px avec vidéo failed sans fichier ; puis vidéo ready avec reçu URL/SHA valide | État failed honnête ; commandes inactives sans média ; téléchargement possible uniquement pour média vérifié | Auteur e09 : génération affichée à tort, commandes sans effet, lien absent. `qa/t07-frontend-journey-20261014/run.mjs --journeys`, après livraison gelée. |

## Anciens échecs clos

- R15 Suno :19 PASS, taskId/reprise GET ; preuve simulée.
- R22 OAuth courses :38 PASS et9 routes PASS ; aucun consentement personnel.
- R23 stockage/preuve :18 PASS ; aucun service distant.
- R40 bibliothèque/cookie :25 assertions navigateur PASS ; captures conservées.

## Blocages distincts du code

- **R30 — configuration inactive** : ordonnanceur autonome/cron OVH non activé ; T01 seul possède ce périmètre. Préparer un observer n'est pas prouver sa mise en service.
- **R47 — candidat absent** : T01 confirme le prochain SHA après gel T03/T06/T07 et migration validée. L'ancienne attente d'intégration des sept lots est close, la nouvelle ne l'est pas.
- **Consentement personnel** : OAuth réel/legal/social, aucune connexion ni acceptation personnelle effectuée par T08. Le défaut clavier légal doit d'abord être intégré/corrigé.
- **Budget/qualification absents** : Salad désactivé et aucune génération/rendu facturé autorisé. GPU et publication réelle demeurent NON TESTÉS.
- **Couverture non exécutée** : parcours continu DB réelle/rendu/publication, alertes live, SLA distant et lecteur d'écran complet. Aucun besoin d'un nouvel audit général pour rappeler ces limites.

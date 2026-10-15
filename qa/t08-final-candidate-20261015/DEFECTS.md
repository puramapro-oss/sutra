# Défauts à intégrer avant retest T08

Base produit commune3855665 ;49c166d ajoute uniquement des preuves. Aucune correction produit T08.

| Défaut | Reproduction minimale | Attendu / observé | Responsable |
|---|---|---|---|
| T08-CANCEL-01 / R54 |`python3 qa/t08-final-candidate-20261015/run.py cancellation` ; C04 session valide, POST production step cancel/targetStep video/requestId UUID, RPC cancel_video_job injecte une erreur synthétique|Attendu5xx expurgé. Observé503 avec `Annulation impossible : T08_SYNTHETIC_PRIVATE_SQL_DIAGNOSTIC`.3PASS/1FAIL, aucun skip ; aucun secret réel.|T03, intégration T01|
| T02-CAP-01 / R55 |Worktree T02, `python3 qa/t02-final-security-20261015/run.py --phase red` ; capacité déjà émise puis revoke pending, profil absent/changé ou provenance invalide|Refus sans signature attendu ;307/signature obtenus dans9 cas. Log original10PASS/9FAIL conservé ; helper T02 en correction.|T02, intégration T01|
| T06 autorité / R56 |`scripts/test-t06-final-social.mts` : binding réaffecté/retiré pendant GET callback ; revoke avec autorité courante invalide|Refus/aucun DELETE attendu ; liaison ou DELETE accepté.9 défauts produit signalés ; rouge brut10FAIL/1PASS incluant1artefact de projection fixture distinct.|T06, intégration T01|
| T06 revoke idempotent / R64 |Même test auteur : répéter revoke après confirmation|Aucun second DELETE attendu ; un second DELETE observé par l'auteur.|T06, intégration T01|
| T06 purge tokens / R65 |Même test auteur : anciens champs tokens synthétiques présents, revoke confirmé ou non|Champs historiques purgés attendu ; valeurs persistantes observées dans2 nouveaux rouges auteur.|T06, intégration T01|

Cause T08-CANCEL-01 : `src/lib/video-queue.ts:cancelJobByKey` inclut `error.message` dans l'exception ; catch de `src/app/api/production/route.ts:POST` la renvoie telle quelle. Le correctif du diagnostic de soumission ne couvre pas l'annulation. Risque moyen d'exposition d'informations internes à une session authentifiée en cas de panne ; aucune exposition de véritable clé n'est démontrée. Les refus session/identité et l'isolation de clé utilisateur passent.

Les propriétaires conservent leurs fichiers et scénarios. Un vert dans leur worktree ne ferme pas ce tableau : T01 doit intégrer, fournir le SHA exact, puis T08 reteste. Les nouveaux problèmes signalés par d'autres lots après ce snapshot doivent être inclus au manifeste T01 ; ce rapport ne certifie pas leurs changements futurs.


## Compléments propriétaires au snapshot final

Ces défauts sont transmis par leurs propriétaires via les locks/handoffs datés et reçus copiés. Aucun test auteur modifié ni duplication T08.

| ID | Reproduction minimale / attendu / observé | Responsable |
|---|---|---|
| R66 T01-SQL-01 |Copie privée restaurée, transaction synthétique authenticated : modifier commission amount/status, referral level/processed, concours score/votes/status. Attendu refus ; trois mutations acceptées, rollback total. `rls-write-probe.py` auteur, reçu `t01-rls-write-red.json`. Périmètre schéma runtime observé, pas prétendu SQL385. |T01 SQL|
| R67 T06-HISTORY-01 |`node24 qa/t06-final-social-20261015/run.mjs history-contract` dans WT T06. Connexion→revoke→reconnexion ; attendu historique conservé, observé première autorisation perdue.0PASS/1FAIL. Dépend du contrat SQL atomique T01. |T06/T01|
| R68 bornes CPU |`run-targeted.mjs resources/limits/media` auteur T05 ; concurrence observée2 pour1slot, minimum fractionnaire0, attente/download/découverte encodeur sans deadline. Attendu slot et délai total bornés.44cbbab corrige localement,34PASS/17exports CPU, pas intégré. |T05/T01|
| R69 panne sociale |T07 `social-before-chromium` à375/1440 : API503 ou suspendue. Attendu erreur persistante/retry/délai ; observé faux0compte et attente sans borne,5FAIL. |T07/T01|
| R70 dialogue révocation |T07 `dialog-before-chromium` : ouvrir le dialogue puis navigation clavier. Attendu nom et focus initial ; observé nom vide/focus absent,2FAIL. |T07/T01|
| R71 auth UI |T07 `before-chromium` à375/1440 : double submit login/signup puis Tab sur visibilité mot de passe. Attendu1requête et bouton accessible ; observé2requêtes et bouton signup hors Tab,6FAIL. |T07/T01|
| R72 reprise durable |`node --experimental-test-module-mocks --import tsx --test scripts/test-t03-final-durable.mts` auteur T03. Résultat terminal non nul invalide/voix corrompue doivent être refusés, pending doit être promu ; inverse observé. Reçu before-new exit1, hashes de la base. |T03/T01|

Le nombre de lignes FAIL exprime des exigences, pas un total de tests rouges. Le schéma runtime, la configuration, les consentements personnels et le budget sont des dépendances distinctes. T01 doit fournir le manifeste complet des corrections intégrées avant la recette finale ; ce snapshot ne prétend pas suivre des WIP postérieurs.

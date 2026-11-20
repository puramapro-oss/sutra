# HANDOFF SUTRA T07 — FINAL-TWO — 2026-10-15

Branche `codex/sutra-t07-final-two-20261015`, base T01 `cb3f893c35599a6c9c50a4d23c82013c10c5f3ae`. SHA final : commit contenant ce fichier, à relever avec `git log -1` puis communiqué dans `.coord/handoffs/SUTRA-20261012/T07-SCHEDULER-CANCEL-20261015.md`.

Deux sources : `src/app/(dashboard)/auto/schedules/page.tsx`, nouveau `src/lib/auto-schedule-client.ts`. Création/édition/pause/reprise et fuseau IANA ; intention figée, verrou synchrone, GET avant PATCH/retry, ACK strict, conflit distant visible, champs opaques conservés. Aucun backend changé. Le précédent483d197 est déjà intégré à blobs exacts ; ne pas le réimporter.

Preuves : [README](qa/t07-final-two-20261015/README.md), manifestes, captures affichées, résultats avant/après. Repro3PASS6FAIL →9PASS0FAIL ; helper/moteur8PASS ; complément15PASS2FAIL contraste pendant transition, puis retest ciblé3PASS0FAIL après opacité1. TypeScript séquentiel/lint PASS. Les compteurs se recouvrent. Mesure requêtes perdue-ACK :2PATCH→1PATCH+GET, aucune promesse de latence. Raw FAIL conservés.

T01 : adapter son test de retry suppression au bouton « Vérifier et réessayer », et les jours à leurs noms français complets. Pas d'écriture concurrente chez T07 sur ce harnais. Importer ce lot puis fournir SHA final pour retest ciblé ; build/gates globales centralisées T01, pas relancées ici. T08 : conserver les verdicts bornés du README, ne pas convertir preuve simulée en validation runtime.

BLOQUÉ système : runtime autonome désactivé/absence statut vérifiable ; CAS manquant pour écritures concurrentes auto/config ; contrats complets cascade /create, audit et récupération après fermeture d'onglet non reçus. T03 vérifie actuellement frontière cancellation/reconciliation API/SQL ; moteur/SQL de sa preuve6fe4085 identiques vérifiés. Pause de planning ne signifie pas annulation des jobs existants. Quota applicatif ne signifie pas remboursement fournisseur. Aucune publication/appel payant/déploiement.


## Addendum attendu avec contrat CAS T01

Le premier commit est4c856aee34d23717c9aa2ca0be441dafefa9bdfc, reçu T01 à20:33UTC. Le commit contenant cet addendum lui succède : `saveSchedules` envoie expectedSchedules du GET frais et réconcilie409 par GET sans retry écriture ; `auto/settings.handleSave` envoie uniquement neuf préférences éditables. Aucun backend copié/modifié. Importer avec la route CAS de T01 ;4c seul n'est pas compatible au428 obligatoire. Le SHA40 additionnel est transmis après commit dans le miroir partagé T07-SCHEDULER-CANCEL-20261015.md.

Preuves ciblées : cas-before1PASS10FAIL → cas-after11PASS0FAIL ; cas-regressions17PASS0FAIL ; TS/lintPASS, manifestes et captures dans le même dossier QA. Contrat backend simulé, pas preuve SQL/live ; retest du SHA intégré encore requis. GitNexus impact avant édition saveSchedulesUNKNOWN et handleSaveCRITICAL489/257directs avec homonymes étrangers, avertissement transmis et revue directe bornée aux deux fonctions. Les garanties runtime/audit/reprise hors session restent explicitement limitées dans README. Aucun build global, fournisseur, publication ou changement production.

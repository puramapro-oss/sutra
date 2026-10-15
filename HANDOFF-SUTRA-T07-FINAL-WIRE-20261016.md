# T07 → T01 / T03 / T08 — ordonnanceur et annulation, contre-preuve finale

Branche `codex/sutra-t07-final-wire-20261016`, base exacte T01 `f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5`, worktree `sutra-t07-final-two-20261015`. QA/docs uniquement : `qa/t07-final-wire-20261016/**`, présent handoff, append BATON/task_plan. Aucun backend ni produit modifié. Commit local indiqué dans le miroir de coordination après création.

**PASS** : 12 scénarios Chromium375/1440 UI → vrais handlers → PostgreSQL18 privé ; quatre fréquences/IANA/DST, erreur/retry, double clic, ACK perdus, GET de reprise, quatre redémarrages réels PG, quotas et tâche fournisseur simulée déjà lancée, fin tardive refusée, cron canonique deux ticks/une occurrence. Zéro appel externe/publication. Six vérifications syntaxiques et lint ciblé PASS. Captures finales affichées. Trois blobs produit finaux T07 identiques à03de132 ; 14 invariants T03 identiques. Route CAS T01 actualisée réellement traversée.

**FAIL restant — backend propriétaire** : `audit-final-browser/results.json`, 1PASS état/quota et1FAIL AUDIT_GAP. Cancel valide répond200 et libère quota, mais aucun événement dans activity_logs. Fonction SQL chargée et reproduction conservées. T01/T03 seuls corrigent le contrat d'audit transactionnel/idempotent ; aucune imitation frontend. Première transmission de ce défaut dans le miroir T07-SCHEDULER-CANCEL.

**BLOQUÉ** : nouveau SHA propriétaire après correction audit/intégration. T01 reprend aussi deux FAIL de CI38809803219 hors ce lot. R30 dispatch réel OFF, R74 `/create` sans annulation UI ; aucun PASS de parcours réel complet. Le cron testé est invoqué manuellement, l'annulation UI concerne une tâche `/production`, pas une cascade de projet.

**NON TESTÉ** : transport PostgREST/RLS distant (session/transport simulés), routage complet des API Next (handlers relayés), arrêt/remboursement fournisseur réel, reprise multiappareil/fermeture onglet, worker/cron de production après crash, Safari natif/appareil physique/lecteur d'écran et audit déployé.

Commandes finales : `node qa/t07-final-wire-20261016/run.mjs final-` →12PASS ; `node qa/t07-final-wire-20261016/run.mjs audit-final- --audit` →exit1, défaut ci-dessus ; chaque préfixe doit être neuf au retest. Détails, corrections du banc et hashes : `qa/t07-final-wire-20261016/README.md`, `*-execution.json`, `integration-manifest.json`. Aucun rouge historique effacé. Les preuves de restart de `first-` sont invalidées explicitement ; utiliser `final-`.

Mesure sauvegarde UI/SQL locale : avant109–139ms, final110–148ms, médianes110,5/114ms ; produit inchangé, pas d'amélioration revendiquée. Aucun défaut frontend nouveau démontré, aucun correctif esthétique ou optimisation spéculative.

À réception du prochain SHA T01 : comparer les empreintes ; rejouer l'audit propriétaire corrigé et les seules frontières affectées, puis adresser PASS/FAIL à T08. Ne pas réimporter les anciens commits T07 ni relancer les gates globales inchangées. Aucun push/fusion/déploiement effectué par T07.

Reçu audit final : `audit-final-execution.json` lie la reproduction FAIL aux cinq sources QA du parcours audit figées, dont `wire.mjs` et `checks.mjs` actualisés. Nouveau passage demandé par T08 pour éliminer la dérive des hashes de la preuve précédente. T01 a pris AUDIT_GAP le 2026-10-15 à22:36UTC, scope SQL réservé `SUTRA-T01-20261016:CANCEL-AUDIT`; aucun correctif parallèle T07.

Gates de livraison : hashes `final-execution` et `audit-final-execution` tous conformes aux sources figées (20/20 chacun); gitleaks diff indexé zéro finding; syntaxe6PASS/lintPASS. `git diff --cached --check -- . :!*.log` PASS. Les huit avertissements de ligne vide finale des logs bruts sont conservés pour ne pas réécrire les preuves. GitNexus `detect_changes --scope staged` CRITICAL/159flux liés à des homonymes `output`; `--scope compare --base-ref main` exécuté. Index tronqué :1350points/834callees/43walks, revue directe QA/docs uniquement, aucun certificat exhaustif.


## Addendum QA audit — 2026-10-15T22:43:45.975144+00:00

À la demande T0122:39, la fixture crée désormais la table canonique activity_logs avant les scénarios navigateur. Filtre `--cancel-only` : deux familles annulation sur375/1440 + garde réseau, aucun replay planning inchangé. Assertions ajoutées : un événement par tâche/acteur, reçu dans progress.effects, marqueur provider_submitted exact; scénario API audit prolongé par restart réel, second cancel sans doublon et GET de réconciliation. `--candidate=<SHA40>` enregistre le candidat et vérifie30sources produit/dépendances contre ses blobs, avec exit1 si dérive. Aucune modification produit.

**Avant correctif T01 :1PASS/4FAIL** `node qa/t07-final-wire-20261016/run.mjs audit-before-owner- --cancel-only --candidate=f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5`. Quatre rouges uniquement sur événement absent; autres assertions UI/quota/reprise exécutées avec succès avant cette assertion. Aucun réseau/JS inattendu,30/30blobs candidat conformes, cluster arrêté. Reçu exact `audit-before-owner-execution.json`; ancien checkpoint6dec16c conserve sources et preuves initiales. Syntaxe des4fichiers modifiés PASS, lint6PASS. Après correctif : NON TESTÉ tant que SHA40 T01 absent. Nouveau SQL WIP non importé.

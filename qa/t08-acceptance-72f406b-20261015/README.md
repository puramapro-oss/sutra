# T08 — recette indépendante du candidat72f

SHA exact : `72f406b940b7e3cdfb27873751a4059375646f25`. Branche de preuves : `codex/sutra-t08-acceptance-72f406b-20261015`. Ce lot remplace le verdict d21, sans réécrire ses rouges.

**Verdict : NON PRÊT.** CI exacte38745298450 FAIL dans la garde runtime WebKit/social :283 assertions navigateur PASS/1FAIL. Les contrats990PASS/0FAIL/7SKIP et PostgreSQL passent ; cela ne ferme pas le rouge navigateur. Matrice74 exigences :57PASS,2FAIL (une même cause CI),2BLOQUÉS,13NONTESTÉS. T01 a reçu la reproduction et maintient le gel de promotion. Aucun ACK global.

Les quatre causes antérieures reproductibles signalées T02/T06/T01 sont corrigées et retestées sur le SHA intégré : fuite RPC, confirmation de révocation avec trigger SQL, révocation legacy et qualification trop large des erreurs du harnais navigateur. [DEFECTS.md](DEFECTS.md) conserve attendu/observé, propriétaires, rouges et preuves de fermeture. Aucun fichier produit propriétaire modifié par T08.

Preuves directes T08 :

- `python3 qa/t08-acceptance-72f406b-20261015/run.py harness rpc history-routes history-sql cancellation capabilities social-authority journey` : **112 PASS,0 FAIL,0 SKIP**. Détail :6 harnais,19 RPC,9 routes+PostgreSQL18,27 SQL historique/apply/replay/rollback,4 annulation,19 capacités privées,15 autorité sociale,13 parcours final. Aucun test échoué ignoré.
- Le parcours indépendant utilise routes/file/worker/pipeline/contrat export/journal social réels, avec session/DB/fournisseurs/stockage simulés. Il couvre création, budget autorisé, checkpoint/reprise, export/bibliothèque, planification/publication simulées, doubles clics, concurrence12, erreurs réseau/SQL/stockage partielles et isolation. Il ne certifie pas une chaîne continue avec fournisseur ou DB distante.
- `verify_sources.py` :1188 contrôles de provenance PASS,1061sources et blobs exacts. Deux fichiers produit et une migration sont les seuls deltas applicatifs depuis d21 ; dépendances inchangées. Patches T02/T06 identiques aux commits auteurs. Sources T03/T05/T07 vérifiées ;3MP4 CPU4K T05 conservés/hashés, pas de réencodage identique. Les contrôles de provenance ne sont pas des tests fonctionnels.
- `verify_receipts.py` :15 contrôles de reçus T01 PASS. Trois migrations exactes appliquées/rejouées/rollback sur copies privées ; image OVH exacte isolée sans réseau,5smokes+FFmpeg ; backup13:21UTC restauré141tables. Ce sont des exécutions T01 dont T08 vérifie les reçus. Auth complet/sessions et cohérence atomique blobs exclus.

`verify_ci.py` vérifie les artefacts du run exact et termine volontairement exit1 :70contrôles de preuve PASS/3FAIL (job global et deux vérifications liées à la même garde sociale).20familles,17exportsCPU réels hashés/décodés. Aucun statut échoué transformé en skip ; les étapes quality ultérieures non exécutées restent identifiées.

Preuves réutilisées sans duplication : T03 `6fe4085`,29scénarios distincts de reprise PostgreSQL ; T05 `f0bb470`,5tests et3exports4K synthétiques réels (native160x90→source320x180→upscale4K) ; T07 `cbcf174`,142assertions Chromium375/1440,39axe sans violation. Sources et dépendances invariantes vérifiées. Les tests CI recouvrants ne sont pas additionnés à ces totaux.

Les13 absences de preuve réelle restent NON TESTÉES, chacune réévaluée dans [MATRIX.md](MATRIX.md) : login/consentements personnels, dépense et solde réel, qualité média IA, sécurité exhaustive, chaîne distante continue, alertes exploitation, SLA distant, lecteur écran/appareil physique, nouvelle authentification fournisseur sur candidat, GPU réel, publication publique, restauration complète et migration production. Configuration inactive, consentement personnel et budget absent sont distingués.

Deux limites de parcours sont explicites : ordonnanceur autonome/cron inactif (R30) et commande UI `/create` non reliée à l'annulation durable serveur (R74, dépendance T01/T03/T07 déjà signalée par T07). Le PASS API R57 ne signifie pas arrêt du fournisseur depuis l'écran. L'observateur T01 préparé est lecture seule, sans dispatch.

Risques résiduels documentés :7alertes npm production (2low/5moderate) et30totales dont1critical/17high de développement dans la qualification T02, sans ajout de dépendance ni exploit nouveau démontré. Aucun zéro-bug ni sécurité exhaustive promis. Mesures développement DCL54–713ms et concurrence isolée ne sont pas un SLA de production.

Qualité du delta : `quality.json`, scan secrets avant commit, diff-check sources/docs ; les logs bruts conservent leurs espaces d'assertion. GitNexus index22 020nœuds/42 757relations/363flux, couverture TRUNCATED (1201résolutions interlangage,1276entrées et678callees hors couverture,3walks limités). Delta QA LOW/0processus produit ; comparaison main historique3926fichiers/9965symboles/228processus CRITICAL plafonnée. Aucune certification exhaustive du graphe.

Secrets : aucun master/.env lu/copié, aucune valeur affichée ; tests sous allowlist synthétique et preload bloquant I/O externe. Aucun GPU/IA Mac, génération facturée, publication, migration production, déploiement, push ou fusion T08. [SMOKE-T01.md](SMOKE-T01.md) contient les seules actions personnelles et conditions de reprise en cas de vrai delta.

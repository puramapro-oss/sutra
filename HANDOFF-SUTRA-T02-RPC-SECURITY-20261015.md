# T02 → T01 : fuite RPC corrigée, sécurité ciblée et npm

Branche `codex/sutra-t02-rpc-security-20261015` ; base exacte `56754679abed9aa1e51323c29aed5bef38bc17d0` (produit T01 d21b7b4). Le SHA du commit contenant ce handoff est enregistré dans le miroir canonique `.coord/handoffs/SUTRA-20261012/T02-RPC-SECURITY-20261015.md` après commit.

**PASS local** : T02-RPC-02, diagnostic claim RPC/profil/worker exposé par `/api/production` et dans last_error.12PASS/7FAIL avant,19PASS après. Liste exacte de codes publics au catch avant réponse/persistance ; seul fichier produit `src/app/api/production/route.ts`. Identité/plan serveur, refus401, codes400/403/409 et write_unconfirmed503 préservés. Deux nouveaux scripts `scripts/test-t02-rpc-security-production.mts` et `scripts/test-t02-rpc-security-dependencies.mts` ; QA nouvelle uniquement, append BATON/task_plan/ERRORS. Aucun helper T03/OAuth T06/médias T05/package/SQL T01 modifié.

**PASS ciblé** :252tests sécurité+21cron+261assertionsRLS+30permissions+23historique =587contrôles distincts,0FAIL/0SKIP. TypeScript ciblé PASS, lint0erreur/1warning préexistant. Refus anonymes/expirés/révoqués, deux utilisateurs, ownership/projets/privé, deux bindings Zernio, stateOAuth/expiration/usageunique, SSRF/DNS/redirections, moteur owner-only. Organisations natives distinctes NON TESTÉES (modèle non trouvé), pas de faux PASS. Preuves et commandes détaillées : [QA](qa/t02-rpc-security-20261015/README.md).

**npm non clean** : production7alertes (2low5moderate) ; total30 (4low8moderate17high1critical), aucune addition des deux. Aucun nouveau chemin API SUTRA exploitable démontré. OTS protections intégrées vérifiées et tripwires request/ECDSA/BitcoinRPC0appels. Alertes supplémentaires via LHCI et ESLint ; conditions précisées dans QA. T01 seul package/lock : pins étroits proxy-addr2.0.8/compression1.8.2 à considérer avant usage du serveur LHCI optionnel exposé, ou retrait de cet outil inutilisé. Pas de mise à jour massive ni downgrade aveugle.

**FAIL candidat sous ownership T06/T01** : reçu T06 15oct13:17UTC, T06-INTEGRATED-01 horodatage CAS remplacé par trigger, T06-INTEGRATED-02 anciens comptes Zernio sans revision non révocables. Ne pas déclarer révocation intégrée PASS ; T06 corrige helper, T01 corrige SQL. Aucun fichier concurrent modifié.

**BLOQUÉ après intégration** : T01 doit intégrer ce commit isolé puis fournir SHA exact. Retest minimal : `python3 qa/t02-rpc-security-20261015/run.py production typecheck lint`, plus les corrections intégrées T06/SQL selon delta. Aucun ACK d'intégration supposé. Ce lot ne modifie pas la production et ne remplace pas le verdict T08.

GitNexus préalable UNKNOWN sur appels HTTP, graphe TRUNCATED déclaré ; diff local POST/quatre flux risque moyen. Comparaison main historique CRITICAL tronquée, non utilisée comme certification. Analyse staged finale jointe. Aucun secret lu/affiché, fournisseur payant, GPU/IA Mac, push, déploiement ou publication.

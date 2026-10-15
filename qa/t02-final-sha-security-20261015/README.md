# T02 → T01/T08 — sécurité du candidat final

Base exclusivement auditée : **cb3f893c35599a6c9c50a4d23c82013c10c5f3ae**. Branche isolée `codex/sutra-t02-final-sha-security-20261015`. Aucun changement dans le worktree T01, les fichiers OAuth T06, les médias T05 ou le worker T04.

**FAIL sur le candidat cb3 pour les diagnostics admin/webhook ci-dessous. PASS local après correction.** Le verdict intégré reste **BLOQUÉ jusqu'à intégration par T01 et retest sur son nouveau SHA**. Ce rapport ne constitue pas une preuve de production.

Le correctif RPC précédent `8c416290ebdabe9b0e8a1fa9708f537c8c0a45f5` a déjà été reçu et intégré via `72f406b940b7e3cdfb27873751a4059375646f25`. Les preuves de révocation intégrée `e63aedd946cde9f207350d27fab9ed4422b43ebf` sont importées dans f29bce5, ancêtre de cb3. Ne pas réappliquer ces lots.

## Défaut nouveau reproduit et corrigé

**T02-FINAL-DIAG-01** : les catch des GET admin utilisateurs/détail/statistiques et POST statistiques renvoyaient `Error.message`. Une exception avant authentification pouvait donc également exposer son diagnostic. La sonde santé renvoyait les 120 premiers caractères de l'exception réseau. Le webhook Stripe signé renvoyait le diagnostic de dispatch en réponse500.

La vraie route, le vrai contrôle de révocation de compte et le vrai vérificateur de signature Stripe sont exercés. Seuls Supabase, le réseau et le dispatch métier sont simulés. Marqueur entièrement synthétique, aucune clé réelle. Le test rouge comporte **28 PASS / 10 FAIL** : huit chemins auth/service admin, une sonde, un dispatch. Ce sont dix cas de reproduction d'une même classe de fuite, pas dix compromissions réelles établies.

Correction minimale de cinq fichiers : messages publics constants sans `details`; health conserve le motif borné `timeout`. Statuts HTTP, garde de session/admin, authentification webhook et comportement retry500 inchangés. Aucun système d'auth parallèle. Après correction : **38 PASS / 0 FAIL / 0 SKIP**. Succès admin, refus anonyme/membre/session expirée/révoquée, zéro I/O privilégiée avant refus, secret/signature absents, signature fausse/expirée/payload altéré et dispatch valide sont contrôlés.

| Commande exécutée | Preuve | Résultat |
|---|---|---|
| `python3 qa/t02-final-sha-security-20261015/run.py delta` | delta.json/log, sur cb3 exact | 70 PASS : RPC19, lookup production29, auto/config22 |
| `python3 qa/t02-final-sha-security-20261015/run.py admin-webhook` avant correction | admin-webhook-red.json/log | 28 PASS / 10 FAIL conservés |
| Même commande après correction | admin-webhook.json/log | 38 PASS |
| `python3 qa/t02-final-sha-security-20261015/run.py routes typecheck lint` | routes/typecheck/lint.json/log | routes10 PASS, TS PASS, lint0erreur0warning |

Les reçus distinguent HEAD de base et arbre corrigé non encore commité. `tested-product-manifest.json` fige les cinq blobs et le banc effectivement testés. Node24.22.0, environnement synthétique reconstruit sans HOME/master/.env, preload `qa/t08/offline.cjs` bloquant réseau externe. Aucun secret nécessaire ni lu; les noms d'environnement du runner désignent uniquement des fixtures. Aucun appel fournisseur réel, aucune facturation.

## Couverture réutilisée, sans rejouer les suites inchangées

`source-reuse.json` compare845 entrées au précédent retest intégré d5d49a4 :836 identiques et9 changées. Les deux deltas API T01 sont couverts par les70 tests directs; le frontend appartient à T07/T01/T08. Depuis cb3, seules les cinq routes de diagnostic de ce lot changent. `source-manifest.json` permet le contrôle d'intégration final.

CI exacte T01 **38797929920** sur cb3 : contrats1054PASS/0FAIL/**7SKIP historiques**, durable18PASS, PostgreSQL RLS261assertions, droits30, historique social27, CAS7 et autres groupes16/46 PASS. Les groupes se recouvrent, ne pas les additionner. `ci-reuse.json` référence les reçus T01 et vérifie les empreintes des logs disponibles; `ci-security-extract.txt` donne163 lignes de cas de sécurité PASS extraites du log contrats exact. Ce ne sont pas163 nouvelles exécutions T02. CI navigateur globale n'est pas certifiée par ce rapport.

| Risque précis | Verdict borné et preuve |
|---|---|
| Cron secret absent/invalide/rotation | PASS local réutilisé :21 tests incluant les20 routes réelles, `assertCronAuth` canonique; helper/routes inchangés, cas présents en CI cb3 |
| Auth, sessions et accès Alice/Bob | PASS :70 tests delta +38 nouveaux +10 régressions; preuves précédentes auth/privé76 inchangées et contrats CI |
| RLS/ownership, argent/permissions | PASS SQL local jetable261assertions/30contrôles; CI PostgreSQL exacte cb3; aucun accès base distante |
| OAuth state/session/utilisateur/profil, usage unique, expiration/révocation | PASS réutilisé :76 tests OAuth, publication92, vrais triggers locaux9, CAS7, historique27; correction T06 et SQL canonique inchangés. T06 garde l'ownership et la recette fournisseur réelle reste NON TESTÉE |
| Médias privés/capacités signées/expiry/croisés | PASS local réutilisé : tests private-media et t02-final-security-grants; références propriétaire, secret absent, faux tenant, révocation pending et expiry refusés. URLs de stockage déjà émises valides jusqu'au TTL300s |
| SSRF/IP privées et réservées/DNS rebinding/redirections | PASS local réutilisé : transport HTTPS épinglé, DNS mixtes refusés, redirections metadata refusées, délais/tailles/annulation;61 tests SSRF/OTS/worker précédents, contrats CI exacts |
| MIME/signatures/tailles/médias malformés | PASS local/CI synthétique : test-auth-session, security-media et preuves T05 exactes; aucune nouvelle génération média/IA lancée T02 |
| CSRF/origin/open redirect | PASS contrats CI : origine canonique des mutations, JSON requis pour routes de génération, chemins de retour sûrs; middleware inchangé |
| Admin/webhook/validation/rate limits | PASS correction locale38 +routes10; schémas Zod production/social et validation des identités testés; limiteur mémoire par utilisateur testé, sans promesse de quota distribué |
| Secrets dans réponses | Ancienne fuite RPC PASS19; nouvelle fuite admin/webhook FAIL sur cb3 puis PASS38 corrigée. Pas d'exposition réelle de secret utilisée pour la preuve |
| Code/logs/artefacts du lot | Scan Gitleaks du diff avec règles par défaut et redaction100 avant commit; résultat joint. Aucune certification de tous les artefacts distants |
| Dépendances | Audit npm **NON CLEAN** inchangé :7 production (2low/5moderate),30 totales (4low/8moderate/17high/1critical). Triage détaillé dans qa/t02-rpc-security-20261015/README.md et dependency-reachability.json. Aucun nouveau chemin API exploitable démontré, tripwires request/ECDSA/BitcoinRPC0appel. Pas de mise à jour aveugle |

## Risques résiduels et limites

- **NON TESTÉ : organisations natives distinctes**. Le modèle examiné ne contient pas cette dimension; deux utilisateurs et deux profils fournisseurs ne constituent pas une preuve multi-organisation.
- **NON TESTÉ : runtime de production** (T01 rapporte86d04c8, différent de cb3), ACL/stockage réellement déployés, consentements et rotation/révocation auprès des réseaux sociaux réels. Aucune action distante effectuée T02.
- **En-têtes de durcissement absents** sur `/` et `/login` runtime selon reçu T08; candidate next.config/middleware n'en ajoutent pas non plus. HSTS/CSP/nosniff/frame-options ne sont pas déclarés PASS. Absence seule ne démontre pas une exploitation; CSP nécessite étude des sources/scripts. Configuration/proxy réservés T01, observation transmise sans édition concurrente.
- **Dépendances dev conditionnelles** : serveur LHCI optionnel avec compression/proxy-addr vulnérables si exposé. Non utilisé dans les flux SUTRA examinés; pins étroits2.0.8/1.8.2 ou retrait à T01 avant usage exposé. Risques d'outillage/archives non fiables demeurent distincts de l'API.
- **Rate limits mémoire** : bornent un processus, pas plusieurs instances; aucune protection distribuée prétendue.
- **GitNexus partiel** : impact probe LOW,1appelant/1processus; handlers HTTP UNKNOWN, usages directs admin/Stripe relus. `detect_changes` all :5fichiers,7symboles incluant reason,6flux, **HIGH**; comparaison historique main :4364fichiers/10536symboles/236flux, **CRITICAL**, liste plafonnée. Signalements utilisateur effectués. Aucun certificat exhaustif déduit du graphe. Les nouveaux tests hors index sont exécutés directement.

T01 doit intégrer uniquement ce commit local après FIN_ECRITURE puis annoncer le SHA exact. Retest minimal sur cet arbre : `python3 qa/t02-final-sha-security-20261015/run.py admin-webhook routes`; comparer manifeste et étendre uniquement aux deltas supplémentaires. RPC/OAuth n'ayant pas changé dans ce correctif, réutiliser leurs preuves exactes sauf delta d'intégration. Transmettre résultat à T08 avant tout ACK final. Aucun push/fusion/déploiement T02.

## Frontière T06 reçue pendant clôture

T06 signale le15oct20:23UTC un défaut distinct dans `/api/social/autopilot` :23tests/12PASS11FAIL (dix diagnostics et doublon plateforme). Correction et réservation restent exclusivement T06. Cette information n'invalide pas les76 tests de state/révocation inchangés, mais interdit un PASS social global du candidat cb3. T01 doit aussi intégrer sa livraison puis faire retester ce delta. Contrat UI autopilot transmis T07 par T06; aucun de ces fichiers touché T02.

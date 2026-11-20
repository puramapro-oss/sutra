# Matrice indépendante T08 — base1461733 / code e3b1711

PASS = exigence prouvée dans la limite indiquée ; FAIL = contre-exemple ; BLOQUE = dépendance manquante ; NON TESTE = absence de preuve. Les preuves héritées sont hashées dans `reused-evidence.json` et leurs sources comparées dans `source-equivalence.json`. Un PASS de fixture n'est pas un PASS production. Les lignes de modes Salad doivent être réévaluées sur le futur candidat exact T01.

Références : **C** = `../final-integration-20261013/gates/contracts-results.json` et scripts listés dans ce reçu ; **PG** = `../final-integration-20261013/postgres-{pipeline,rls,migration}.json` ; **UI** = gates `browser-results.json`, `browser-redteam-result.json`, `browser-extra.json` ; **RT** = `redteam-result.json`/`redteam-output.txt` ; **OVH** = `../ovh-final-providers-20261014/README.md` et reçus associés ; **P** = `t01-provider-receipt.json`. Aucun ancien verdict global48f2d5e adopté.

| Exigence | Statut | Preuve / limite actuelle |
| --- | --- | --- |
| MODE-01 client interdit au routage propriétaire | PASS | Test T08 réel route/dispatch, session cliente contre corps/header forgés ; schéma refuse engine owner. Limité au contrat de base. |
| MODE-02 API normale cliente préservée | PASS | T08 : deux HTTP200, WAN explicite simulé avec worker on/off, zéro appel worker. |
| MODE-03 sur base1461733 : indisponibilité explicitement restituée | FAIL | T08 : HTTP503 générique masque LOCAL_NOT_CONFIGURED ; contre-test rouge conservé sur cette base. |
| MODE-03 correctif T01 livré42b03ba | PASS | Reçu immuable T01 : quatre tests T08 PASS ; empreinte du test identique vérifiée par T08, diff create limité à codes/messages publics sûrs. Pas de fusion T08 ; pas une preuve Salad intégré. |
| MODE-04 aucune API payante de repli owner | PASS | T08 : worker désactivé, HTTP503 et timeout ; compteurs API/externe nuls. Aucun worker/GPU réel. |
| Salad désactivé / capabilities / séparation API-owner intégrés | BLOQUE | Adaptateur absent de1461733, contrat T04 en cours ; test de l'ancien local-engine insuffisant pour Salad. |
| Salad désactivé dans le vrai module T04 | PASS | T02-C01 réutilisé : capabilities disabled, submit refuse SALAD_DISABLED, zéro réseau. Module WIP exact hashé, journal double ; test déjà couvert par T02, non dupliqué. |
| Connexion/session et refus non authentifié | PASS | C auth-session ; UI login fixture ; OVH routes privées/connexion négative. Aucun nouveau login T08. |
| Création authentifiée et réponse202 | PASS | C pipeline-submit et production-queue ; T08 MODE-01 vraie route, file simulée. |
| Quota, réservation atomique, acquittement durable | PASS | C pipeline-submit et PG local jetable ; absence de reçu refuse travail payant. |
| Budget financier complet, approbation de dépense Salad | NON TESTE | Quota n'est pas budget monétaire. Aucun coût, budget ou consentement de dépense inventé ; candidat à qualifier par T01. |
| Génération simulée / suivi asynchrone | PASS | C fournisseurs/pipeline ; pas de génération GPU, musique ni rendu externe. |
| Checkpoints, interruption, reprise, identité fournisseur | PASS | C pipeline-interruptions/provider-safety, PG concurrence ; réutilisation intégrée T03. |
| Reprise Salad simulée après reçu perdu / lease expiré | PASS | T03 9/9 sur vrais client/worker T04 WIP +16/16 pipeline ; reçus et six empreintes exactes vérifiés. Journal/bridge simulés ; aucun second POST/calcul dans ces fixtures. |
| Reprise Salad avec persistance applicative réelle | BLOQUE | Raccord durable T04/T01 absent de la base ; aucun journal mémoire assimilé à SQL. |
| Montage et validation technique synthétiques | PASS | Gate media : local-engine +31 tests FFmpeg/média ; décodeurs réels, assets synthétiques. Aucun rerun T05. |
| Garantie de montage final distinct avec sous-titres requis | FAIL | T05-MEDIA-01 : URL différente avec mêmes octets source acceptée ; 24 PASS/1 FAIL livrés au SHA cca76a2. Correctif attribué à T05 par T01, pas encore prouvé ici. |
| Export durable et stockage fail-closed, cas existants | PASS | C export-integration/editor-export/queue ; ne couvre pas le nouveau contre-exemple T05 ci-dessus. |
| Validation manuelle avant publication et concurrence | PASS | C T06-social-autonomy/routes : approbation retirée, claim/CAS, média changé refusés. |
| Planification, fuseau/DST, unicité occurrence | PASS | C schedule/publication/auto-export ; cron simulé/local uniquement. |
| Publication simulée, destinations, erreurs partielles | PASS | C T06 : journal par destination, succès conservé, reprise ciblée, aucune publication réelle. |
| Parcours continu connecté DB réelle → publication simulée | BLOQUE | Preuves segmentées ; candidat/identité de recette isolée et scénario continu T01 requis. |
| Pannes DB / écriture non confirmée / refus faux succès | PASS | C pipeline-submit/queue/social-routes + PG local ; aucune panne de production provoquée. |
| Timeouts / résultat ambigu / double soumission | PASS | C provider-safety/pipeline-interruptions, PG ; MODE-04 couvre seulement dispatch HTTP. |
| Concurrence / doublons backend / redémarrage | PASS | PG 12 tests concurrence + C interruptions ; SQL local jetable. Nouveau raccord Salad séparément BLOQUE. |
| Charge raisonnable locale | PASS | RT : 8 workers,32 séquences,288 opérations ; journaux32/64 destinations. Modèles mémoire, aucun SLA réel. |
| Isolation utilisateurs et RLS | PASS | C sécurité T02 + PG254 assertions ; OVH120 droits/36 GET bornés, preuves T01 reprises. |
| IDOR média/comptes/statuts | PASS | C private-media/security-account/routes ; OVH contrôles médias négatifs. Nouveau worker distant non couvert. |
| SSRF téléchargement / redirections / bornes | PASS | C security-media/storage/provider-safety, transport/DNS simulés. |
| Auth wrapper Salad / URL stricte / liaison résultat-job en fixtures | PASS | T02 31/31 sur six vrais modules T04 WIP hashés : authentification avant dépendances, credentials distincts, scope/fingerprint/id/hash, routes privées inaccessibles. |
| Isolation du nouveau worker Salad en réseau/DB réels | BLOQUE | Modules WIP non raccordés/activés ; preuve mémoire ne certifie ni déploiement, ni segmentation, ni persistance/organisation en base. |
| DNS rebinding réel / segmentation réseau production | NON TESTE | Pas d'accès ou de modification réseau T08 ; simulation distincte. |
| CSRF middleware / origines / callback OAuth | PASS | C integration et OAuth ; OVH28 assertions d'origine/58 contrôles négatifs. |
| CSRF navigateur hostile domaine réel | NON TESTE | Pas de scénario intersite réel sur session utilisateur. |
| XSS éditeur/erreurs fournisseur | PASS | UI adversarial + C : canaris et sorties expurgées ; aucune certification XSS exhaustive. |
| Cron authentification fail-closed | PASS | C T06 routes + OVH58 contrôles négatifs ; aucun cron valide déclenché. |
| Cron effectif / récurrence production / SLA | NON TESTE | Aucun déclenchement distant T08. |
| OAuth state unique, TTL, session/utilisateur/profil | PASS | C zernio-oauth-contracts/T02/release-oauth sur code corrigé e3b1711 ; aucun ancien Z01–Z04 rouge repris. |
| Révocation serveur / absence de replay après retrait | PASS | C T06 autonomie/routes ; callbacks et transports simulés, révocation réelle non effectuée T08. |
| Reconnexion utilisateur après révocation | FAIL | T06 commit48c3191 : ligne revoked conservée affichée Connecté, bouton consentement absent ; correctif attribué à T07 par T01, sans preuve finale à cette photographie. |
| Secrets expurgés des réponses / fichiers QA | PASS | C provider-safety + refus de lecture env dans harnais ; scan propre à ce lot consigné à la clôture. Aucun audit exhaustif du maître revendiqué. |
| Provenance RunPod/Shotstack/config Mac-OVH | PASS | P : maître0600, égalité sélectionnée Mac/runtime ; preuve opaque T01, aucun secret lu par T08. |
| RunPod authentification / lecture endpoint | PASS | P : HTTP200/contrat health ; soumission, modèle et GPU NON TESTE. |
| Shotstack authentification stage/v1 | PASS | P : HTTP200/templates, environnements distingués ; aucun rendu. |
| SunoAPI tiers auth / contrat corrigé | PASS | Reçus finaux T01 + C suno/provider-redteam ; génération réelle NON TESTE. |
| Zernio API/binding serveur autorisé | PASS | P : profils/utilisateur/comptes200, ownership/binding confirmé ; zéro compte connecté. |
| Comptes sociaux / consentements réels | BLOQUE | Connexions manuelles utilisateur requises après correction reconnexion ; aucun compte connecté automatiquement. |
| Observabilité jobs / états ambigus / journaux | PASS | C provider-safety/T06/pipeline ; OVH logs/santé sans erreur fatale au reçu T01. |
| Alertes bout en bout / corrélation globale / SLA | NON TESTE | Logs disponibles ne prouvent pas livraison d'alertes ni SLO. |
| Accessibilité automatisée de base / responsive | PASS | UI210 +7 scénarios/165 audits axe sans violation sur base ; contrôle humain des captures attribué à T01, pas T08. |
| Accessibilité du nouveau parcours modes T07 | BLOQUE | Delta T07 en cours, contraste signalé puis correctif réservé ; preuve cible attendue, pas de rerun UI global T08. |
| Clavier complet / lecteur d'écran / WCAG exhaustive | NON TESTE | Axe n'est pas certification exhaustive. |
| Performance production / CWV / charge DB distante | NON TESTE | Aucun trafic de charge production. |
| TypeScript/lint du lot T08 | PASS | typecheck.json/lint.json ; portée ciblée, aucune gate globale. |
| CI/build de la base e3b1711 | PASS | OVH CI38475022601/artefacts ; preuve historique exacte réutilisée, zéro exécution T08. |
| CI/build du candidat final Salad | BLOQUE | Candidat T01 pas encore livré ; ne pas lancer CI globale avant sa collecte. |
| GPU réel / RunPod-Salad / génération / publication réelle | NON TESTE | Exclus de ce mandat gratuit. HTTP200 et tests mock ne constituent jamais une preuve GPU. |
| Certification release finale Salad | BLOQUE | MODE-03 corrigé sur42b03ba, mais T05/T06 défauts ouverts, raccord et tests Salad/candidat attendus. Aucun CERTIFIED.md écrit. |

Les nouveaux signalements propriétaires sont des preuves datées de leurs périmètres, pas des tests T08 exécutés. Une résolution ultérieure doit citer le SHA correctif et le contre-test ciblé vert ; ne pas réétiqueter ces lignes sans preuve.

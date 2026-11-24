# T01 — coordination Salad / configuration OVH, 14 octobre

T01 seul intégration, config OVH/Zernio. Les sept propriétaires restent ceux du mandat utilisateur 01h42. Aucun autre worker créé ; aucun GPU, provisioning, publication ou appel payant autorisé.

## Configuration terminée et preuve réutilisable
`/Users/matissdornier/purama-worktrees/sutra-final-providers-20261013/qa/provider-activation-20261014/activate.json` : runtime applicatif e3b1711 inchangé, quatre variables RunPod/Shotstack du master vérifiées, binding Zernio de l’identité serveur confirmée vers le profil existant appartenant au propriétaire courant. Profil existant nommé Default, organisation PURAMA autorisée par utilisateur ; aucun profil créé/renommé. GET health RunPod200/contrat conforme, templates Shotstack stage/v1200/contrats conformes, Zernio profils/utilisateur/comptes200, zéro compte connecté. Sauvegarde privée vérifiée, seul SUTRA recréé, autres conteneurs inchangés, dix smokes PASS. Aucun nouveau test live par les ouvriers.

## ACK T01 de périmètre T04
T04 reste propriétaire unique de l’adaptateur. Pour livrer un raccord utilisable et non une bibliothèque isolée, ACK explicite aux éditions minimales justifiées de `src/lib/local-engine.ts`, `src/lib/ltx.ts`, `src/lib/ltx-types.ts`, `src/lib/ltx-workflow.ts` et nouveau GET authentifié `src/app/api/video/capabilities/route.ts`, après impact GitNexus. Réutiliser le checkpoint durable transmis par `durableLtxJob`/les leases existantes ; ne pas modifier SQL ou la file partagée sans décrire le besoin à T01. Client API inchangé, propriétaire seul, pas de repli API ni confusion checkpoint LTX/Salad. Interdiction d’activer Salad ou d’introduire de ressource GPU.

T04 : publier dès que stabilisé le contrat public pour T07/T08 et interfaces de persistance pour T02/T03/T05. La responsabilité worker comprend l’authentification, le raccord applicatif ci-dessus, l’intention persistée avant soumission, la réconciliation GET et des erreurs expurgées ; T01 vérifie/intègre, ne redéveloppe pas l’adaptateur. Signaler immédiatement tout verrou contraire.

T07 : réserver vos seuls fichiers UI déjà annoncés. Consommer GET `/api/video/capabilities` si retenu T04 ; statut inconnu/indisponible si absent. Ne pas déduire disponibilité depuis HTTP200 fournisseur. Attendre schéma T04 ou fixtures explicites ; aucun backend parallèle.

T02/T03/T05/T08 : assertions sur le contrat réel T04 ; pas de réimplémentation du produit dans les tests. T06 conserve uniquement nouveaux tests OAuth/consentements hors réseau. Remettre SHA complet, chemins, commandes, résultats et limites ; laisser WIP et terminaux ouverts.

## Prix vérifié, aucune autorisation de dépense
https://salad.com/pricing/ consulté : RTX3090 24Go Lowest0.090USD/h, Low0.117, Medium0.143, High0.170. Lowest x720h=64.80USD ; page x730h=65.70USD. Prix à l’usage, interruptible, disponibilité non garantie. Aucun abonnement/solde/ressource actif démontré ; aucun achat ou création.

## Point complémentaire T01

Configuration/proof commit57e40428124850cbd1463538e7d9673069ceed64. Six GET authentifiés sur URL publique passent maintenant (dashboard/create/production/settings-social/accounts/points), session de recette seule révoquée. Master présence seulement : aucune variable contenant SALAD, SALAD_API_KEY absent. Aucun worker endpoint/token/qualification/budget ne doit être inventé. T04 : livrer raccord concret ou identifier précisément le port de persistance encore à réaliser ; un journal en mémoire de test ne constitue pas la persistance en production. ACK backend ci-dessus actif ; T01 attend contrat final avant intervention pour éviter doublon.

## Correctifs reproductibles — attribution unique 02h00

T07 : ACK extension UI exclusive sur `src/components/settings/social/PlatformGrid.tsx` et `src/app/(dashboard)/settings/social/page.tsx`, après impact. Corriger le défaut T06 documenté dans T06-SOCIAL-FINAL-20261014.md : une ligne revoked/expired/error ne doit jamais être comptée ni affichée comme connectée, et doit permettre de reconnecter. Préserver affichage historique pertinent et sécurité backend. T06 garde tests seuls ; T01 ne modifie pas ces fichiers.

T01 prend seul `src/app/api/create/route.ts` pour MODE-03 T08 : code sûr explicite d’indisponibilité du mode propriétaire au lieu de SUTRA_GENERATION_FAILED. Aucun changement parallèle de local-engine/ltx réservés T04. T08 : conserver le test rouge pour vérification après commit T01.

T04 : le contrat privé livré ne suffit pas au raccord autorisé. ACK précédent couvre bien le DTO public GET capabilities et les quatre modules de routage/checkpoint, responsabilité T04 unique. T07 attend ce DTO pour terminer. Merci d'accuser lecture et préciser maintenant les ports de persistance réellement manquants (fonctions/SQL exacts) si le raccord exige T01 ; ne pas renvoyer silencieusement l'intégration applicative entière à T01. Aucun store mémoire accepté comme persistance production.

## ACK T05 correctif média après livraison cca76a2

Défaut T05-MEDIA-01 accepté comme reproductible : octets source inchangés sous URL différente, sous-titres requis mais faux succès. T05, votre lot de tests est livré ; T01 vous attribue maintenant exclusivement le correctif minimal dans `src/lib/media-validation.ts`, `src/lib/pipeline-state.ts` et, seulement si nécessaire, `src/lib/export-pipeline.ts`, après impact GitNexus et avertissement risque HIGH/CRITICAL. Aucun autre propriétaire sur ces trois fichiers. Refuser la substitution du brut quand une transformation obligatoire est attendue ; conserver les exports légitimes sans transformation. Compléter les tests exacts et remettre second commit séparé. Ne pas lancer gate globale ni modifier lib/salad, config, OVH. T01 intégrera tests puis correctif après revue. Ce nouvel ACK remplace seulement la limite tests seuls de votre réservation.

MODE-03 T08 corrigé en WIP T01 : quatre cas existants T08 exécutés sur le vrai code T01 via compilation en mémoire et environnement fixtures/offline, 4 PASS. Liste fermée de codes/messages ; aucune erreur fournisseur brute reflétée. TypeScript/lint ciblés en cours.

## Livraison T01 MODE-03

Commit `42b03ba` sur branche intégration (base57e4042), uniquement route create et preuves de recette. Quatre cas T08 PASS sur ce code ; TypeScript et lint PASS. T08 peut intégrer ce commit ou tester le candidat final après livraison. T01 importe maintenant les tests T05 cca76a2 et T06 48c3191 (tests valides avec défauts rouges explicitement ouverts), sans déclarer intégration finale prête avant correctifs T05/T07.

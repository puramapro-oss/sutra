# SUTRA T08 — revue indépendante du candidat ab935, 19 octobre 2026

**NON PRÊT aux essais réels** sur `ab935e59ca4e39776630f05b2ba6c0422c74ec62`.
**79 PASS / 12 FAIL / 6 BLOQUÉS / 12 NON TESTÉS**, 109 exigences. Voir [matrice complète](MATRIX.md) et [données structurées](matrix.json).

La CI verte n'empêche pas des défauts hors de sa couverture. Les nouveaux contre-exemples T02/T04/T06 et l'indisponibilité actuelle OVH invalident le maintien de « 0 FAIL ». Aucun correctif propriétaire local ne clôt un défaut sur ce candidat tant que T01 ne l'a pas intégré et fait retester. Le présent lot T08 ne modifie aucun produit, SQL, configuration ou dépendance.

## Candidat, CI et preuves invariantes

T01 a confirmé personnellement le SHA dans `T01-CERTIFICATION-20261019.md`, puis l'a reconfirmé à 19:54 UTC. La branche distante porte le même SHA. Le worktree T08 a un HEAD QA descendant `5b68618ea1384f40d71f2033b41622ba75117fc3`, avec **1160 fichiers manifestés identiques** au candidat : produit, configuration, tests et dépendances. [Identité et hashes](candidate-identity.json).

[CI 38827288351](https://github.com/puramapro-oss/sutra/actions/runs/38827288351) : SHA exact, trois jobs SUCCESS, exécutés le 16 octobre, état relu via API le 19 octobre. [Reçu actuel](ci-current.json). Installation propre, lint, TypeScript et build restent des preuves de cette CI ; aucun build/install global identique relancé. Lint historique : zéro erreur, 111 avertissements. Contrats : 1227 PASS, 7 SKIP explicites ; Chromium/WebKit : 418 PASS ; red team : 210 PASS, 165 contrôles axe ; legacy : 1022 PASS, 25 SKIP. Ces groupes se recouvrent : **ne pas additionner ces nombres**. Les SKIP ne deviennent pas des PASS.

Les 17 phases directes historiques T08, leurs reçus/logs, les quatre provenances navigateur et les 17 MP4 CI ont été rapprochés par empreintes. Les **241 assertions historiques** ne sont pas présentées comme réexécutées aujourd'hui. Le parcours intégré simulé J01–J13 a été exécuté sur ab935 le 16 octobre ; sa portée reste valide sur ces fichiers invariants. [Intégrité des preuves](proof-integrity.json). Les nouveaux cas ci-dessous exposent ses limites de couverture.

## ACK individuels

Les handoffs personnels sont figés dans [owner-evidence](owner-evidence-index.json), avec chemin original, horodatage de revue et SHA256. Une attestation T01 ne remplace pas un ACK propriétaire.

| Propriétaire | État sur ab935 | Preuves et limite |
|---|---|---|
| T02 | NACK sécurité | Diagnostics 8 FAIL/1 PASS ; contact 4 FAIL/1 PASS. Source contact et log vérifiés par T08. Correctif local `2b69a8feabb0e82e34939d96cb5176116baa244d` :19tests PASS; complément partenaire3PASS/5FAIL. Aucun correctif intégré au candidat. |
| T03 | ACK technique borné | Commit `fd8c92837b595cc51d60bb8ef74ff8ada565b4b8`, 211 cas distincts PASS/0 FAIL/0 SKIP, quatre répétitions migration non additionnées. 885 puis 887 hashes de sources rapprochés au manifeste T08 ; 326 chemins QA hors manifeste non assimilés à du produit. Backup/restore/replay/rollback PostgreSQL synthétique. Nouvelle limite cron R107 transmise ensuite pour qualification. |
| T04 | NACK stock / diagnostic fournisseurs | Contre-tests T08 D102/D103 FAIL ; reçus gratuits expurgés du master. Correctif local `62bb57f94525e6e4063d2209436da911c6f96d8b` :20tests PASS, non intégré; aucun ACK global supposé. |
| T05 | ACK média synthétique | Commit `b18360607df42fee24c048d554054681199a720d`, 26 tests frais PASS, 17 MP4 CI rehashés/redécodés, deux nouveaux exports transition CPU. Manifeste de livraison 45 fichiers vérifié. 4K mesurée = upscale synthétique, aucune IA native 4K. |
| T06 | NACK publication UI | T08 rejoue un snapshot figé du nouveau scénario T06 sur produit ab935 : 10 FAIL/1 PASS. Correctif local `46870824d434dfbfc8d7c87e899e7e57ae0a9d9a` :29contrôles Chrome PASS; ne vaut pas intégration. |
| T07 | ACK local avec réserves | Commit `8becf38d5f5c35b706eee9061d47bf16d679c838`, 32 contrôles frais PASS (11 create/annulation, 12 UI, 9 continuité), Chromium375/1440, huit redémarrages PostgreSQL privés. 308 invocations manuelles, 16 occurrences, aucun moteur autonome réel. Un cas de caractérisation confirme R107, il ne satisfait pas l'exigence de reprise sans perte. |

## Défauts reproductibles et corrections minimales attendues

| Exigence | Gravité / propriétaire | Reproduction minimale, attendu → observé | Correction minimale à intégrer puis retester |
|---|---|---|---|
| R100 | Majeur T02 | D100, GET setup sans session : 401 avant service-role → 200 et création d'un client privilégié. Middleware laisse les routes `/api/` s'autoriser elles-mêmes. | Auth serveur propriétaire existante avant DB, no-store. |
| R101 | Majeur T02 | D101, exception DB synthétique health : 503 expurgé → 503 contenant le marqueur privé. | Statut panne préservé, diagnostic public fixe. |
| R106 | Majeur T02 | Contact : 25 requêtes anonymes mocked non plafonnées, HTML arbitraire au mail, diagnostic brut et refus fournisseur traduit en succès200. | Plafond existant, texte/échappement, erreur fournisseur honnête et expurgée. |
| R80 | Majeur T04 | D102, tous les fournisseurs stock répondent500 : erreur distinguable de zéro résultat → succès `[]`. | Propager un échec explicite sûr dans le consommateur stock. |
| R102 | Majeur T04 | D103, résultat Pixabay avec URL `javascript:` : rejet → URL retournée. Aucun XSS réellement exécuté prétendu. | Validation de schéma et d'URL avant retour. |
| R103 | Majeur T06 | Ouvrir dialogue publication320/768 : rôle dialog absent, date sans nom accessible, liens interactifs imbriqués, contraste insuffisant768. | Réutiliser Modal, noms accessibles, liens séparés, contraste. |
| R104 | Majeur T06 | Mock réponse unknown/perdue/erreur : bouton de soumission réactivé ; partiel affiche diagnostic synthétique brut ; reprise fait disparaître le succès précédent. | États incertains persistants, réconciliation, conservation des destinations réussies et reprise sûre ciblée. |
| R105 | Modéré T06 | Compte X révoqué synthétique : bouton attendu non sélectionnable → enabled. | Désactiver sélection et offrir reconnexion explicite. Pas de contournement serveur démontré. |
| R107 | Majeur T03/T01 | Planning UTC12h, ticks00h puis20h le06/11 simulé : occurrence durable ou signalement explicite attendu pour reprise sans perte → aucune occurrence12h. Fenêtre code−1h/+3h. | Contrat de reprise à préciser : rattrapage durable borné/idempotent ou signalement durable des occurrences manquées. Aucun déclenchement payant automatique. |
| R108 | Majeur T02 | Routes partenaires : erreurs SQL QR/scan divulguées, contrôle quota continue en erreur, cookie posé malgré échec insertion. Reçu propriétaire3PASS/5FAIL, blobs comparés par T08. | Erreurs fixes et refus503 sur panne de lecture/écriture. Atomicité/IP proxy restent à qualifier. |
| R109 | Modéré T01/T04 | D104, configuration Coverr sans clé : attendu false+clé manquante → true/aucun manque. | Registre et sonde Bearer conditionnelle alignés sur adaptateur. |
| R92 | Majeur exploitation T01 | GET publics `/login` et `/api/social/accounts` : attendus200/401 →404/404. Application et DB arrêtées depuis17/10 selon reçu T01. | Diagnostiquer cause et dépendances ; restauration de service seulement sous autorisation de production distincte. |

Les transmissions immédiates sont dans le miroir canonique `T08-PROOF-REVIEW-20261019.md`. T08 n'a édité aucun de ces fichiers produit. La sûreté serveur déjà prouvée reste distincte des défauts UI : aucune double publication réelle, fuite de secret réel ou exploitation effective n'est prétendue.

## Exécution indépendante nouvelle

Dans le worktree T08, Node26 existant, aucune lecture `.env` :

```sh
node qa/t08-proof-review-20261019/counterexamples.mjs ab935e59ca4e39776630f05b2ba6c0422c74ec62
node --require ./qa/t08/offline.cjs qa/t08-proof-review-20261019/publication-browser.mjs --baseline
python3 qa/t08-proof-review-20261019/build_report.py
```

- Contre-exemples : exit1, **0 PASS/5 FAIL**, neuf requêtes synthétiques, zéro requête native. Sources exactes lues par `git show`, transpilation TypeScript puis VM ; DB/auth/fournisseurs simulés. [Reçu](counterexamples.json).
- Chromium publication : exit1, **1 PASS/10 FAIL**, réseau extérieur bloqué, requêtes de publication entièrement interceptées, zéro publication réelle. Scénario T06 réutilisé pour éviter duplication, exécution T08 indépendante sur produit invariant. [Provenance](publication-test-provenance.json), [résultat](publication/before/results.json), [320px](publication/before/publish-320.png), [768px](publication/before/publish-768.png). Les deux captures ont été affichées. Un test s'arrête à sa première assertion échouée : les assertions suivantes de focus/Escape/fuseau ne sont pas déclarées exécutées. WebKit nouveau dialogue NON TESTÉ ; CI WebKit historique distincte.
- Deux GET publics sans session : **2 FAIL**, TLS vérifié, aucun corps/cookie conservé. [Reçu](runtime-independent.json).
- Le premier essai VM utilisait deux classes Error de domaines différents : résultat invalidé, reçu conservé [ici](counterexamples-first-harness-invalid.json). Le VM a été corrigé puis les quatre défauts reproduits. Deux erreurs lint propres au harness (nom module et console.log) corrigées, puis cinq cas rejoués après ajout Coverr :0PASS/5FAIL; ancien reçu quatre cas conservé. Aucun PASS de cet essai invalide retenu. Une préparation du snapshot navigateur a aussi été interrompue car le propriétaire modifiait son harness ; aucun test n'avait démarré, snapshot final figé et hashé.

Ces nombres d'assertions ne sont pas le nombre d'exigences FAIL de la matrice. Les cas contact, partenaire et rattrapage sont des exécutions propriétaires relues et rapprochées, pas des exécutions T08 inventées.

## Blocages distincts

- **R30 — configuration inactive : BLOQUÉ.** Observateur OVH actif en lecture seule, dispatch OFF ; aujourd'hui observer UNAVAILABLE avec application/DB arrêtées. Ne prouve pas un ordonnanceur autonome. R107 est un défaut de reprise séparé.
- **R78 — Salad : BLOQUÉ.** Reçu T04 master19/10 19:44UTC : format local invalide, scopes organisation/projet absents, zéro GET. Ni refus HTTP, ni worker/GPU validé. Groupe/gateway/worker/qualification/devis également non configurés dans cette source. Ne pas activer pour obtenir une preuve.
- **R90 — Pexels : BLOQUÉ.** Clé présente mais format local invalide, zéro GET image/vidéo. Aucune conclusion de mauvaise clé distante ou restriction de compte. Défaut code stock R80/R102 indépendant.
- **R91 — ElevenLabs : BLOQUÉ.** GET401 `invalid_api_key`, transport local valide. Vérification de credential/droits par titulaire nécessaire ; cause administrative non prouvée.
- **R61 — sauvegarde actuelle : BLOQUÉ.** Ancien reçu restauré141tables valide historiquement, expiration16/10 02:40UTC. Six artefacts et trois scripts rollback encore intègres19/10, mais aucun reçu frais de restauration. Image rollback présente, pas de rollback production exécuté.
- **R96 — workspace requirements : BLOQUÉ.** Incident original sans contexte reproductible. Le précédent succès initialize/configRequirements/read ne résout pas rétroactivement un incident non identifié ; aucun correctif produit inventé.

Provenance des variables : source T04 `~/.env.purama.master` seulement, valeurs non présentes dans le reçu expurgé. T08 n'a ni ouvert les secrets ni recopié un `.env.local`. Les GET master RunPodhealth200, Shotstackstage/v1templates200 et Sunocrédit200 sont des preuves d'accès en lecture seulement. Runtime OVH arrêté, LTX auth sans endpoint gratuit ou job existant NON TESTÉ, aucun budget/GPU consommé. [Reçu T04](owner-evidence/T04-free-reads.json).

## Exploitation, migration, rollback

Le runtime identifié porte ab935 et l'image `sha256:a6f8c93f40fdf5ac9e21b4a62269da9b6bc795001f93f6ff9b7e41ae208a9ff5`, mais est **exited** depuis17/10 07:23:14UTC (143, pasOOM). La DB est exited depuis07:23:17UTC (0, pasOOM). `health=starting` résiduel n'est pas un PASS. T01 a effectué les lectures SSH ; T08 n'a pas doublonné ces opérations. HTTPS reste valide, cela ne prouve pas disponibilité applicative.

Les trois migrations du16/10 ont des reçus PASS et empreintes exactes : durable `925fa5d28ee1724226fe7793767f409af85efe7a392d4991365284107d4ccccf`, permissions `3776c0c57fb83523c83a6ba4ada5d8cc55ccab8205765743bc527126ad340e6c`, historique social `d2f6a9cb380a15285759085cdf602701f0d9d785d4a7f76f2061438d38ab9ddc`. Catalogue actuel non accessible, aucune nouvelle migration faite T08. Rollback SQL isolé conservant les écritures post-migration PASS T03 ; **rollback production et restauration complète identités/sessions/blobs NON TESTÉS**.

## Suite minimale et limites

T01 doit intégrer uniquement les corrections propriétaires prouvées puis annoncer un nouveau SHA exact. Retester alors les contre-exemples affectés, diagnostics/contact/partenaires, stock et sa route, registre/sonde Coverr, publication UI Chromium/WebKit, reprise longue panne si modifiée, puis le parcours complet simulé auth→projet→budget→file/reprise/annulation→montage/export→bibliothèque→planning/publication simulée. Réutiliser les preuves invariantes après comparaison, mutualiser la gate globale T01. Ne pas certifier implicitement le SHA futur.

Actions personnelles externes : corriger les credentials/configurations Salad/Pexels/ElevenLabs dans la source master avec T01/T04 ; fournir le contexte original workspace si toujours concerné ; consentir personnellement aux connexions sociales seulement après recette ; fournir une autorisation et un budget distincts pour d'éventuels futurs essais réels. Aucun achat ou consentement n'a été effectué ici. Liens de configuration vérifiés par T04 dans son rapport : [Salad](https://portal.salad.com/), [Pexels](https://www.pexels.com/api/key/), [ElevenLabs](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys). Les valeurs ne doivent jamais être transmises dans le handoff.

Générations GPU/IA payantes, qualité réelle des médias IA, facturation/remboursement, posts publics, consentements personnels, SLA/charge production, VoiceOver/appareil réel et DR complet restent **NON TESTÉS**. Les douze lignes NON TESTÉ de la matrice les détaillent. Aucun zéro bug garanti, aucune certification GPU, aucun feu vert WanGP.

## Qualité de la livraison QA

Syntaxe des deux harnais, lint ciblé0warning, compilation Python en mémoire, cohérence109lignes/liens et hashes des snapshots PASS : `quality.json`. GitNexus stagedLOW/0flux; comparaison historique mainHIGH/liste plafonnée, graphe partiel et cible QA nouvelle absente, aucune certification exhaustive : `gitnexus-review.json`. Revue directe: produit/config/dépendances/SQL inchangés; journaux append-only : `scope-review.json`.

Gitleaks brut exit1/48détections : les48 sont des SHA256 de fichiers sources, recalculés indépendamment depuis les blobs Git; zéro secret réel démontré, aucune exclusion globale ajoutée. Rapports expurgés `gitleaks.json` et `gitleaks-triage.json`. Diff-check brut signale huit lignes de blanc dans le log propriétaire immuable; source/docs PASS, log conservé byte-for-byte pour son hash : `diff-check.json`. Ce ne sont pas des tests produit verts inventés.

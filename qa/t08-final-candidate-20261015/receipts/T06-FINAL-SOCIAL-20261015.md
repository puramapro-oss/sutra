# T06 — final social 2026-10-15

EN COURS. Base T01 49c166d ; application3855665, ancien lot74655b1 integre identique. Preuves finales T01 reutilisees par egalite de blobs ; ancienne fixture T08 corrigee et integree.

T02 : je reserve les tests sociaux nouveaux, OAuth et autorite sociale exclusivement apres reproduction. Aucun helper securite transversal modifie. T07 : lecture UI pour parcours exact seulement, aucune UI modifiee. T03 : aucune execution durable modifiee. T01 : aucun binding, SQL, config ou production. Tout defaut hors lot sera transmis ici, pas corrige en parallele.

## Extension exacte T01/T02/T07

| SUTRA-T06-20261015:FINAL-SOCIAL:OAUTH-REVOCATION | 2026-10-15T01:06:25.278406+00:00 — Defauts reproduits sur49c166d : callback accepte reaffectation/retrait binding pendant GET provider; revoke DELETE hors autorite courante (9FAIL/2PASS). Reserve exactement src/app/api/social/callback/route.ts et src/lib/social-account-revocation.ts, aucun helper T02 ni UI T07. GitNexus GET UNKNOWN0appelant, revoke LOW2appelants dont routeDELETE et fixturePG; graphe partiel, usages directs revus. Correction garde apres attente/claim, blocage local revocation conserve. | ACTIF T06 |

T02-CAP-01 lu : private-media demeure T02, aucun doublon. T06 corrige seulement callback et revoke. UI/reconciliation 202 conservee, T07 informe via ce relais. Historique des consentements : aucun journal durable atomique OAuth observe, seuls connected_at/revision courants; evaluation precise en cours.

| SUTRA-T06-20261015:FINAL-SOCIAL:FIXTURES | 2026-10-15T01:07:59.121873+00:00 — Reserve scripts/test-t06-social-routes.mts (mock getAuthorizedProfileId manquant) et qa/t06-social-recovery-20261014/test-postgres.mts (provenance synthetique explicite pour trois cas revoke uniquement). Assertions existantes preservees, fixture CAS legacy nullable conservee. Impact File UNKNOWN complete par revue directe des runners. Rouge brut10FAIL/1PASS dont1artefact projection mock;9defauts produit comme annonce. Nouvelle fixture locale corrigera projection/typecheck. Aucun fichier T02/T07 modifie. | ACTIF T06 |

## Deux ecarts supplementaires reproduits dans revoke deja reserve
Repetition apres confirmation envoie un second DELETE; champs tokens historiques restent en base apres revoke. Trois nouveaux cas rouges (fixtures uniquement). Correction locale meme fichier, purge atomique des trois champs et retour confirme idempotent sans nouvel appel distant. Table SQL existante dispose de ces colonnes; ajout seulement au schema jetable du test PG, aucune migration.

## T06-HISTORY-01 — FAIL reproduit, dependance T01 SQL (demande concrete)

Commande locale `node24 qa/t06-final-social-20261015/run.mjs history-contract` dans le worktree T06 : **0PASS/1FAIL** attendu, message `First authorization is lost after reconnect: only current account revision remains`. Test reel des routes, transport et base simules, reseau externe bloque. Connexion → revoke confirme → reconnexion : une seule ligne courante, aucun state restant, revision de la premiere autorisation perdue. Ce resultat n est PAS inclus dans les PASS. Connexion personnelle reste distincte de ce defaut logiciel.

T01, merci de fournir/reserver le contrat SQL canonique pour mutation compte + evenement d autorisation atomiques (ou journal sur table existante choisie par vous). `sutra.activity_logs` existe mais son helper best-effort ne garantit ni atomicite ni conservation; T02 signale aussi ses ACL/RLS a qualifier. Aucun SQL/migration touche par T06. Contrat minimal : acteur user UUID, compte/plateforme, profil Zernio serveur, evenement connexion/reconnexion/revocation demandee/confirmee/incertaine, revision/operation unique, horodatage serveur; scopes **demandes** `posting` distingues des grants effectivement attestes. Aucun token, state brut, session_id, cle ou erreur provider brute. Transactions atomiques avec CAS existant, refus sans mutation si audit indisponible, unicite evenement pour repetition, aucune suppression lors de reconnexion, lecture limitee au proprietaire; T01 definit ACL/RLS et format. Le stockage illimite dans metadata est exclu car le CAS transporte metadata dans les filtres URL.

T06 peut adapter ses routes au contrat livre; tant que ce contrat n est pas attribue/disponible, correction complete **BLOQUEE par frontiere SQL T01**. Les quatre corrections locales independantes sont vertes : nouveaux15, OAuth47, consommateurs securite, PostgreSQL7 dont concurrence24sessions, TypeScript/lint cibles. Aucun appel fournisseur reel, aucun consentement, aucune publication. T07 : pas de modification UI; un historique visible fiable depend d abord de ce contrat.

# SUTRA — consolidation T01 du 14 octobre 2026

**INTEGRE / TESTE CI ; promotion BLOQUEE par la recette indépendante finale T08 absente.** Ce dossier ne vaut pas ACK T08 et ne certifie aucune génération ou publication réelle.

- Candidat applicatif exact : `3855665fa79e3cc2171124d864a834214d6ac617`, branche `codex/sutra-final-providers-20261013`.
- [CI 38598361267](https://github.com/puramapro-oss/sutra/actions/runs/38598361267) : **SUCCESS**, trois jobs, même SHA. Les échecs antérieurs restent archivés ; aucune assertion auteur retirée.
- Production OVH constatée à 16:41 UTC : **`86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164`**, saine, zéro redémarrage. Le candidat385 n'est pas déployé et la nouvelle migration n'est pas appliquée.
- Réconciliation T01 des53 exigences : **41 PASS /0 FAIL /2 BLOQUE /10 NON TESTE**. Les PASS ont un périmètre explicite (simulation, CPU, copie DB ou runtime antérieur). Voir [matrice](FINAL-MATRIX.md), [JSON](matrix-3855665.json) et [16 points historiques](reconciliation-16-3855665.json).
- Commit documentaire ultérieur : reçus uniquement ; il ne remplace pas le SHA applicatif testé ci-dessus.

## Corrections et réception des sept lots

Toutes les livraisons ont pour base `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`. Import par chemins/empreintes et dépendances, sans fusion aveugle. Les66 fichiers du manifeste correspondent au commit et au worktree ; les7 WIP étrangers sont inchangés. Les worktrees auteurs restent propres aux SHA livrés, sans fermeture.

| Responsable | Livraison | Résultat intégré et limite |
| --- | --- | --- |
| T02 | `56c0ca82afa41dbfdd59f889b9b39b4149850f15` | Contrats sécurité/médias et reproduction RPC ; correctif produit détenu par T03. Lot intégré/testé/préservé. |
| T03 | `47f689602d8a68be1c5d25c85c000eb921ee97ea` + `bfe5a0a01b5cb8cec64826f94e1ea327dd5b2588` | Résultat null/reprise/ACK perdu, expurgation RPC, intégrité durable ; SQL canonique intégré par T01. Production non migrée. |
| T04 | `64d2cf8ebcb8d4e06ede66484924fc3f3cbf37c4` | Authentification gratuite et contrats fournisseurs ; aucune preuve de génération. Lot intégré/testé/préservé. |
| T05 | `2da10b34a1715a6f33b1087f8c53480353727f56` |37 exports MP4 CPU synthétiques vérifiés ; qualité d'un rendu IA distant non testée. Lot intégré/testé/préservé. |
| T06 | `74655b154ccca6cfc4016f9bcca5c0b6f96e7cc5` | Autorité profil Zernio/provenance/révocation contrôlée avant/après claim ; fixtures coordonnées T08. Lot intégré/testé/préservé. |
| T07 | `a01c44da31470e7d51764f09ae80a33142a2573d` | Consentement modal/focus/contraste/deadline, états lecteur et téléchargement privé SHA. Lecteur écran/Safari/gros médias distants non testés. Lot intégré/testé/préservé. |
| T08 | `5bd8128ebfeb776d015f356757e602afa8155c09` | Recette historique,13 parcours et fixtures intégrés ; **avis indépendant final sur3855665 encore absent**. |

Les quatre FAIL historiques (Suno, course OAuth, stockage/preuve, bibliothèque) sont clos par preuves propriétaires et retests T08 conservés. Sur les cinq FAIL de son dernier candidat e09 : RPC R49, durable R50, autorité sociale R51 et lecteur R52 passent dans la CI exacte. Les défauts clavier/modal/contraste de R41 sont corrigés et testés ; l'exigence complète demeure NON TESTEE car elle inclut le lecteur écran manuel. Aucun FAIL logiciel connu du périmètre testé n'est masqué par cette requalification.

Le delta T01 après intégration corrige seulement le harnais CI : environnement propre aux fixtures durables, attente DOMContentLoaded avec assertions inchangées et une seule construction production pour trois contextes navigateur isolés. La cause précise des anciens échecs légaux en mode dev n'est pas démontrée ; leurs journaux restent conservés. Le produit et SQL de3855665 sont identiques à `ca8470b41c3d698f15a43260c03829ae63d35d18`.

## Campagne finale exacte

Reçus : [commandes et résultats](ci-3855665-tests.json), [jobs GitHub](ci-3855665-final.json), [contrôles navigateur](ci-3855665-browser-checks.json). **Ne pas additionner ces familles, les assertions RLS, les suites auteurs et leurs rejeux : ils se recouvrent.**

| Commande exacte | Résultat sur3855665 |
| --- | --- |
| `npm run check` | TypeScript, lint et build PASS ; commandes internes dans le reçu. |
| `npm run test:contracts` |870 PASS,0 FAIL,7 SKIP ; sous-commandes schedule/composition/publication PASS, non additionnées. |
| `npm run test:media` |120 PASS,0 FAIL ; média synthétique/CPU seulement. |
| `node qa/t08/run.mjs redteam` |14 PASS. |
| `node qa/t08/run.mjs browser-redteam` |210+7 contrôles PASS ;165 audits axe,0 violation,0 erreur navigateur. |
| `node qa/t07-frontend-fixes-20261014/browser.mjs --production` |25 PASS. |
| `node qa/t07-frontend-journey-20261014/run.mjs --production-suite` |Légal15 / parcours34 / privé9 PASS ; une construction, trois sessions distinctes,0 erreur ou mutation imprévue. |
| `node scripts/run-ci.mjs legacy` |1022 PASS,25 SKIP,0 FAIL,0 flaky. |
| `npm run test:migration-local` |PASS, PostgreSQL jetable. |
| `node --import tsx --test scripts/test-pipeline-postgres.mts` |16 PASS. |
| `node --import tsx --test scripts/test-salad-persistence.mts` |7 PASS. |
| `node --import tsx --test --test-concurrency=1 qa/t03-orchestration-fixes-20261014/finish-postgres.test.mts qa/t03-durable-reliability-20261014/postgres.test.mts qa/t06-social-recovery-20261014/test-postgres.mts` |26 PASS. |
| `SUTRA_TEST_PG_BIN="$(pg_config --bindir)" node scripts/test-security-rls.mjs` |259 assertions RLS PASS. |
| `python3 -m unittest discover -s deploy -p 'test_*.py'` |34 PASS. |
| `python3 -m unittest discover -s qa/t01-consolidation-20261014 -p 'test_*.py'` |16 PASS. |
| Étape CI `Exact candidate promotion and rollback simulations`, SOURCE=`qa/t01-consolidation-20261014` |7 PASS ; commande complète dans `.github/workflows/web-ci.yml`. |
| `npm audit --omit=dev --audit-level=high` |PASS :0 élevée/critique ;5 modérées et2 faibles conservées. |

Les7 SKIP contrats concernent4 appels INSEE,2 contrôles de DB distante et1 réseau OpenTimestamps. Les25 SKIP legacy restent des SKIP, jamais des PASS. Identités/consentements navigateur et médias de fixture seulement. Captures fraîches CI mobile légal375 et téléchargement desktop1440 effectivement affichées/examinées ; cela ne valide pas tous les parcours visuels ni un lecteur écran.

## OVH, SQL, sauvegarde et cron

- Image exacte préparée : `sha256:4d8f5358f6eaa2785028cf6cce20122e7225060a66ff89f777b24da3b2a76407`. Construction isolée sans réseau,5 smokes HTTP et FFmpeg/ffprobe PASS, conteneur candidat arrêté. [Reçu](candidate-3855665.json).
- Production inchangée : [runtime](runtime-3855665-prepared.json), [URL/DNS/TLS](public-final-readonly.json). Accueil/login200, API non authentifiée401, bibliothèque/social redirigent vers login. TLSv1.3 vérifié, certificat valable jusqu'au10 janvier2027. Cloudflare DNS-only inféré depuis l'IP publique ; configuration API Cloudflare non fraîchement auditée, aucune modification.
- Sauvegarde protégée du14 octobre14:03 UTC :141 tables restaurées et comptages comparés,6 artefacts hashés,4 schémas/contrats vérifiés ; [limites exactes](backup-restore.json) (auth limitée aux identifiants de fixture, archive blobs non transactionnelle). Fraîcheur maximale4h avant promotion : **à renouveler automatiquement si expirée**, sans nouvelle demande d'autorisation.
- Migration canonique `migrations/20261014_durable_checkpoint_integrity.sql`, SHA256 `93b96256c604baaa857efe8064519ad552ccaaff2305628c139294f34579882c` :3 fonctions remplacées, pas de réécriture de données historiques. PG16/19, RLS,138 tables inchangées sur copie restaurée, ACL et rollback exact vérifiés. Deux sessions : DDL concurrent bloqué55P03. [Restauration](checkpoint-restore.json), [concurrence](checkpoint-concurrency.json). **Non appliquée en production**.
- Ordonnanceur : aucune entrée cron hôte/systemd/pg_cron SUTRA ; `CRON_SECRET` présent,0 job/lease expiré/configuration auto/publication auto à l'inventaire. **Infrastructure d'exécution absente**, pas un secret manquant. Les routes exécutantes peuvent générer/publier : maintien volontaire inactif pour respecter l'interdiction d'effets facturés/publics. [Inventaire](scheduler-inventory.json).
- Observateur uniquement SQL lecture seule :10 tests et unité systemd transitoire PASS, mauvais SHA refusé avant accès DB. Aucun timer persistant ni worker activé. Il ne réalise pas la reprise autonome. [Preuve](observer-systemd-proof.json).

## Fonctions disponibles et limites

[Connexion](https://sutra.purama.dev/login), [bibliothèque](https://sutra.purama.dev/library), [réseaux sociaux](https://sutra.purama.dev/settings/social). Le runtime86d conserve les preuves antérieures de GET authentifiés, média privé/Range/propriétaire, sous-titres et export SRT CPU ; ce sont des preuves bornées, pas un nouveau parcours connecté intégral. Les nouveaux correctifs légaux/lecteur/durables385 attendent la promotion.

RunPod : accès endpoint health200 et0 worker prêt ; ne pas élargir la clé pour une route d'administration. Shotstack stage/v1 templates200 ; SunoAPI crédit200 et contrat compatible tiers, ce n'est pas une API officielle Suno. Ces reçus T04 prouvent l'accès gratuit et le contrat lu, aucune vidéo/musique/rendu. Pas de nouveau défaut401/403 à contourner ni rotation requise.

Zernio : binding unique propriétaire Matiss/profil PURAMA conservé,0 compte social connecté au reçu. Consentements et publication réels non effectués. Salad reste désactivé :14 variables de préparation absentes dans le maître au contrôle, aucune ressource/budget/modèle24Go qualifiés. Le mode est **GPU distant open source**, pas local Mac ni gratuit. Mode API clients conservé en simulation. Aucun modèle lancé sur Mac, génération facturée, publication ou dépense.

Autres NON TESTES : OAuth navigateur personnel, coût consommé/qualité IA réelle, pipeline continu DB→rendu→publication, alertes réelles, SLA/charge distante, lecteur écran complet, sécurité exhaustive. Le graphe GitNexus partiel/stale ne prouve pas l'exhaustivité ; revue bornée et tests concrets uniquement.

## Reprise minimale

1. **T08 original** : avis ACK/FAIL/BLOQUE sur3855665, selon `qa/t08-closure-20261014/SMOKE-T01.md`, en réutilisant cette CI et la réconciliation. Aucun build global supplémentaire. Reprise MacDevBridge indisponible (`-32603` observé) ; fournir le lien/identifiant de sa session uniquement si nécessaire pour la joindre. Aucun autre agent ne remplace son avis.
2. Après ACK : T01 revalide préconditions/backup frais et ancienne image, applique la migration compatible puis promeut le candidat exact. Scripts préparés, **non exécutés** : `python3 qa/t01-consolidation-20261014/checkpoint-transition.py apply --source-ref 3855665fa79e3cc2171124d864a834214d6ac617 --ci-run 38598361267`, puis `python3 qa/t01-consolidation-20261014/promote.py --source-ref 3855665fa79e3cc2171124d864a834214d6ac617 --ci-run 38598361267`. Smokes gratuits et rollback automatique gardés. Ne jamais réessayer aveuglément après réponse SSH ambiguë.
3. Rollback applicatif préparé : `python3 deploy/ovh.py rollback --source-ref 3855665fa79e3cc2171124d864a834214d6ac617`. Rollback SQL distinct et gardé : `python3 qa/t01-consolidation-20261014/checkpoint-transition.py rollback --source-ref 3855665fa79e3cc2171124d864a834214d6ac617 --ci-run 38598361267`. Aucune restauration ancienne au-dessus de nouvelles écritures.
4. Utilisateur seulement : effectuer soi-même le consentement légal à la connexion puis les consentements des réseaux souhaités dans les paramètres ; [guide officiel Zernio](https://docs.zernio.com/guides/connecting-accounts). Pour un futur essai GPU, autoriser d'abord la ressource et un budget chiffré après qualification ([Salad développeurs](https://salad.com/developers/), [tarifs officiels](https://salad.com/pricing/)). Aucun achat nécessaire pour terminer la recette gratuite actuelle.

T01 : dossier final livré, promotion en attente de T08. T02–T07 : livrés/intégrés/testés/préservés, lot SUTRA fermable sans supprimer leurs worktrees ni affecter d'autres missions. T08 : lot livré/préservé, recette finale encore ouverte. **Aucun terminal fermé.**

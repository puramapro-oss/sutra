# T07 → T04 / T01 : contrat capabilities UI, 14 octobre

Mandat Matiss 01h40 ; base 1461733, code e3b1711. Scope UI réservé dans les deux LOCKS. T01 seul config/OVH/Zernio/intégration ; aucun backend modifié par T07.

T04 : merci de déposer le contrat capabilities retenu (chemin GET éventuel, schéma public sans secret, état personnel distant disponible/indisponible/inconnu, mode API client, disponibilité worker distincte de l’auth fournisseur, contraintes de budget/qualité et raisons sûres). Aucun statut « prêt », gratuité, GPU Mac ou 4K native ne sera déduit d’un HTTP health 200. Aucun basculement payant automatique proposé par T07.

T07 réserve create/page.tsx, production/page.tsx, AutoForm.tsx, wizard/ManualFormStep4.tsx, production/IdeaStep.tsx et un nouveau composant create/ExecutionModeNotice.tsx. Les APIs/lib/backend restent lecture seule. Les tests UI utiliseront uniquement des fixtures ; génération/achat bloqués au réseau. Les adaptations concrètes et limites d’intégration seront consignées ici ou dans le handoff final T07.

## Avancement T07 après ACK T01

GET /api/video/capabilities retenu côté UI, en attente du schéma T04 exact (champs, valeurs, version et erreurs). Le premier passage navigateur couvre déjà les deux pages, les cinq largeurs et l'erreur Création initialement invisible. Aucun endpoint concurrent créé. Merci de déposer le schéma public au handoff T04 ; fallback UI inconnu sur route absente/erreur, aucune inférence par plan ou profil client.

T07 : UI commune prête, 15 cas responsive/axe PASS sur 320/375/768/1280/1440. Contraste loading corrigé après reproduction. Pour finaliser le fetch unique sans poll/retry automatique, le schéma PUBLIC de GET capabilities est le seul élément en attente (le capabilitiesSchema worker est interne et ne sera pas importé dans le navigateur). Un schéma provisoire explicite suffit pour figer les fixtures ; aucun ready/coût ne sera inventé.

## Contrat privé reçu à 01h54

T04-SALAD-20261014-CONTRACT.md lu : contrat worker privé, aucun DTO public fourni. T01-SALAD-COORDINATION-20261014.md autorise pourtant T04 seul sur GET /api/video/capabilities. T07 ne crée ni API ni contrat concurrent ; tant que le DTO public filtré et lié à l’identité serveur n’est pas déposé, état UI explicitement non vérifié, aucun GET worker, aucune inférence ready. Déposer le DTO public ici ou au handoff T04 dès disponible pour le raccord UI.

T07 ACK MODE-DEFECTS reçu : prise exclusive des deux fichiers UI sociaux, tests navigateur en cours. Reconnexion/comptage et réponse202 traités sans API/OAuth. Modes responsive final22/22 PASS,23 audits axe sans violation ; aucun fetch capabilities ajouté tant que DTO public absent.

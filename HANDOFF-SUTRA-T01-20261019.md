# T01 → T02–T08 / T09 — nouveau candidat, certification bloquée

Le commit contenant ce handoff remplace ab935 comme candidat local de correction. Branche `codex/sutra-certification-integration-20261019`, worktree isolé du même nom. Le SHA40 post-commit, la CI exacte et les demandes personnelles d'ACK sont publiés dans `/Users/matissdornier/purama/.coord/handoffs/SUTRA-20261012/T01-CERTIFICATION-20261019.md` ; ne pas créer de nouvel ACK au nom d'un autre terminal.

Rapport, preuves, livraisons exactes, tests rouges/verts, manifeste et rollback : [qa/t01-certification-20261019/README.md](qa/t01-certification-20261019/README.md).

Les 1160 blobs de référence ont été vérifiés, les 3108 chemins WIP T01 historique préservés. Intégration des correctifs T02/T04/T06, raccord SQL atomique partenaire, configuration Coverr et focus WebKit ; aucun produit T03/T05/T07 réécrit. Leurs preuves invariantes sont conservées mais leurs ACK ab935 ne sont pas transférés au nouveau SHA.

OVH : ab935 toujours identifié mais app et DB arrêtées, URL404, catalogue SQL inaccessible. Trois migrations historiques prouvées ; migration partenaire additive locale seulement, testée sur PostgreSQL privé avec backup/restore/rollback. Backup production intègre mais périmé pour une promotion. Aucune mutation distante ni redéploiement autorisé implicitement par ce handoff.

Prochaine étape non vérifiée : ACK personnels T02–T08 sur le SHA exact et qualification R107 par T03. T09 reste BLOQUÉ. Ne pas relancer de build global concurrent ; limiter les retests aux deltas et aux contre-preuves, réutiliser les preuves invariantes après comparaison.

Correctif QA post-CI f953 : voir qa/t01-certification-20261019/ci-legal-read-sequencing/README.md. Produit inchangé ; nouveau SHA et CI/ACK exacts dans registre partagé.

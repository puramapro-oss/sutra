# Déploiement OVH SUTRA — procédure et état observé le 14 octobre 2026

Production **`86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164`**, https://sutra.purama.dev, promue le 14 octobre à04:13UTC. [CI exacte38508390596](https://github.com/puramapro-oss/sutra/actions/runs/38508390596) : trois jobs PASS. [Preuves finales](../qa/final-delta-20261014/README.md), reçus deployment/promotion, manifeste895 empreintes. Les sept deltas T02–T08 sont intégrés ; runtime identique, Salad désactivé et71 autres conteneurs inchangés.

Migration distincte **`6800a8de49080157b487eec1119d2fb49c194afe`** appliquée à04:31UTC : SELECT authenticated sur sutra.affirmations, après8 contrôles sur copie restaurée et sauvegarde table/ACL/politiques0600. Données, RLS, anonymes et écritures inchangés ; deux vues navigateur corrigées. Backup/rollback SQL privé : `/opt/purama/apps/sutra/backup-affirmations-6800a8de4908/rollback.sql`. Rollback SQL = REVOKE SELECT uniquement, testé ; rollback image séparé ci-dessous. Aucun nouveau bundle n’est nécessaire pour ce seul privilège DB.

Procédure, après tous les prérequis prouvés (remplacer les paramètres par les valeurs vérifiées) :

```sh
python3 deploy/candidate.py --source-ref SHA40
python3 qa/final-delta-20261014/promote.py --source-ref SHA40 --ci-run CI_RUN_ID
python3 deploy/ovh.py rollback --source-ref SHA40
```

`promote.py` exige les reçus `candidate.json`, `backup-restore.json`, `ovh-preflight.json` dans son dossier et une CI verte exactement au même SHA. Il vérifie le manifeste versionné, la restauration, l'image et la configuration sauvegardées, lance les smokes gratuits et restaure automatiquement l'image/configuration précédentes en cas d'échec après remplacement. Le rollback manuel conserve les données courantes ; ne jamais restaurer un ancien dump au-dessus de nouvelles écritures. Les snapshots exclusifs et scripts de promotion historiques ne sont pas à rejouer. Ne pas utiliser aveuglément `ovh.py deploy` : l'écart Upstash du helper partagé reste documenté, la promotion conserve les octets du runtime.

La sauvegarde de cette promotion a restauré 141 tables SUTRA et les tables sociales référencées, avec comparaison des comptes. Auth est sauvegardé comme ID référencés seulement, sans constituer une sauvegarde Supabase globale ; les blobs ne sont pas gelés transactionnellement. Les images, sauvegardes et WIP restent préservés.

Contrôles gratuits runtime déjà prouvés : santé applicative et sessions ; RunPod `/v2/{endpoint}/health` authentifié, zéro worker prêt observé ; Shotstack templates stage/v1 authentifiés ; profil Zernio existant lié à l'identité serveur autorisée, zéro compte social connecté. Les anciens 401 global RunPod et 403 Shotstack ne décrivent plus cette configuration. Aucune génération ou publication réelle n'est démontrée.

Aucun ordonnanceur autonome SUTRA trouvé dans cron/systemd/pg_cron ; les premiers traitements restent déclenchés par les requêtes applicatives. La reprise automatique et la publication planifiée sont NON ACTIVES/NON PROUVÉES. Ne pas activer un cron susceptible de générer ou publier pendant cette recette sans dépenses ni publications.

Cloudflare DNS-only inféré des réponses DNS vers OVH, TLSv1.3 Let's Encrypt valide jusqu'au 10 janvier 2027 lors du dernier contrôle. API Cloudflare non vérifiée faute de credential, aucun DNS modifié. Contrôle après promotion effectué : quatre résolveurs concordants et TLS valide.

La route `/api/health` contacte des fournisseurs : ne pas l'utiliser pour une vérification gratuite. Authentification fournisseur, contrat simulé et génération effective sont trois preuves distinctes. Salad nécessite encore ressource, budget et qualification GPU autorisés ; les consentements sociaux appartiennent à l'utilisateur.

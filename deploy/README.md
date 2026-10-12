# Déploiement OVH SUTRA — recette conditionnelle

**2026-10-12 : RELEASE_BLOCKED. Ne pas exécuter le déploiement avec l’état constaté.** Le code média privé durable et les migrations sont prêts et testés ; la CI reste bloquée par le secret readonly SMARANA absent. Le schéma de production et le bucket ne sont pas encore basculés. Le domaine public répond HTTP 402 depuis Vercel. Preuves : `qa/release-20261012/ovh-schema.json`, `ovh-http-cloudflare.json`, `ovh-origin-tls.log`.

Après résolution des contrôles critiques, depuis le checkout du commit final poussé :

```sh
SUTRA_RELEASE_SHA="$(git rev-parse HEAD)"
python3 deploy/ovh.py deploy --source-ref "$SUTRA_RELEASE_SHA" --schema-ready
# Retour à la configuration et à l’image précédentes :
python3 deploy/ovh.py rollback --source-ref "$SUTRA_RELEASE_SHA"
```

`--schema-ready` est une attestation opérateur, pas un contournement du précontrôle. Ordre des migrations vérifié sur PostgreSQL local jetable : `v10_durable_jobs_quota.sql`, `v11_pipeline_checkpoints.sql`, `20261012_social_publication_journals.sql`, `20261012_private_media.sql`, `20261012_t02_account_permissions.sql`, puis **en dernier** `20261012_t02_final_permissions.sql`. Aucune migration de production effectuée. Le contrôle local n'atteste pas les données, grants ou compatibilités de production.

Le wrapper impose un SHA40 disponible et le hash du helper canonique `purama/.coord/handoffs/OVH-MIGRATION-20261005/deploy_next.py`. Les sources proviennent de `git archive`, ESLint du même commit et SMARANA du commit verrouillé. Une nouvelle image est construite avant remplacement de SUTRA. Le helper restaure automatiquement Compose si le remplacement échoue au contrôle de santé ; ce mécanisme n'est pas une preuve de rollback réel, ni une qualification des parcours métier. La route `/api/health` contacte des fournisseurs : ne pas l'utiliser pour une recette sans fournisseur.

Avant remplacement, Compose et le runtime sont copiés de façon opaque dans `/opt/purama/apps/sutra/rollback-<SHA40>/` ; la création refuse tout écrasement. Le rollback explicite restaure les deux fichiers, ne redémarre que SUTRA et attend son état healthy. Les anciennes images doivent rester disponibles. Aucune annulation SQL automatique. Un smoke applicatif ou public en échec après remplacement impose d'exécuter ce rollback avant toute autre action ; ne pas se fier au seul healthcheck du conteneur.

Sauvegarde cohérente dans `/opt/purama/apps/sutra/backup-t01-coherent-l01juhcq/` : SUTRA et trois tables publiques sociales partagent le même snapshot PostgreSQL. Dépendance trigger, métadonnées Storage et archive des blobs incluses. Restore réel136 tables avec comptages identiques ; six migrations appliquées deux fois sur une base privée PostgreSQL15.8. Auth est une fixture ID-only ; ce n’est pas une restauration complète Supabase. Les blobs ne sont pas gelés transactionnellement. Preuve : `qa/production-20261012/backup-restore.json`.

Le cutover `deploy/private-media-cutover.sql` doit être appliqué avec le remplacement compatible. Il ferme le bucket et bloque les rôles anon/authenticated, y compris sous politiques globales permissives. Ne jamais rouvrir le bucket pour revenir à l’ancienne image ; un retour à celle-ci exige de garder les médias indisponibles jusqu’à correction compatible. Aucun objet orphelin supprimé ni propriétaire inventé.

Construction préalable isolée, sans changement de service :

```sh
python3 deploy/candidate.py --source-ref "$SUTRA_RELEASE_SHA"
```

Le candidat Linux démarre sans réseau externe, reçoit le runtime existant de façon opaque, vérifie cinq GET gratuits et FFmpeg puis s’arrête. Le conteneur arrêté, l’image et le log privé sont conservés. Un PASS de ce candidat n’atteste ni DNS/TLS, ni Supabase live, ni fournisseur payant.

Conteneur en place : `purama/sutra:35c137fc0bc0-9d0c6671-envn1`, healthy ; GET locaux `/` et `/login` →200, `/api/points` sans session →401. Aucun remplacement, migration de production, changement DNS ou rollback dans cette reprise. Cloudflare accessible par session authentifiée ; wildcard DNS only vers Vercel402. TLS direct OVH non qualifié.

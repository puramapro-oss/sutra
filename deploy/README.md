# Déploiement OVH SUTRA — recette conditionnelle

**2026-10-12 : RELEASE_BLOCKED. Ne pas exécuter le déploiement avec l’état constaté.** Trois tables et quinze fonctions requises sont absentes du schéma OVH ; `sutra-assets` est public et le contrat de référence média privée durable reste à terminer. Le domaine public répond HTTP 402 depuis Vercel. Preuves : `qa/release-20261012/ovh-schema.json`, `ovh-http-cloudflare.json`, `ovh-origin-tls.log`.

Après résolution des contrôles critiques, depuis le checkout du commit final poussé :

```sh
SUTRA_RELEASE_SHA="$(git rev-parse HEAD)"
python3 deploy/ovh.py deploy --source-ref "$SUTRA_RELEASE_SHA" --schema-ready
# Retour à la configuration et à l’image précédentes :
python3 deploy/ovh.py rollback --source-ref "$SUTRA_RELEASE_SHA"
```

`--schema-ready` est une attestation opérateur, pas un contournement du précontrôle. Ordre des migrations vérifié sur PostgreSQL local jetable : `v10_durable_jobs_quota.sql`, `v11_pipeline_checkpoints.sql`, `20261012_social_publication_journals.sql`, `20261012_t02_account_permissions.sql`, puis **en dernier** `20261012_t02_final_permissions.sql`. Aucune migration de production effectuée. Le contrôle local n'atteste pas les données, grants ou compatibilités de production.

Le wrapper impose un SHA40 disponible et le hash du helper canonique `purama/.coord/handoffs/OVH-MIGRATION-20261005/deploy_next.py`. Les sources proviennent de `git archive`, ESLint du même commit et SMARANA du commit verrouillé. Une nouvelle image est construite avant remplacement de SUTRA. Le helper restaure automatiquement Compose si le remplacement échoue au contrôle de santé ; ce mécanisme n'est pas une preuve de rollback réel, ni une qualification des parcours métier. La route `/api/health` contacte des fournisseurs : ne pas l'utiliser pour une recette sans fournisseur.

Avant remplacement, Compose et le runtime sont copiés de façon opaque dans `/opt/purama/apps/sutra/rollback-<SHA40>/` ; la création refuse tout écrasement. Le rollback explicite restaure les deux fichiers, ne redémarre que SUTRA et attend son état healthy. Les anciennes images doivent rester disponibles. Aucune annulation SQL automatique. Un smoke applicatif ou public en échec après remplacement impose d'exécuter ce rollback avant toute autre action ; ne pas se fier au seul healthcheck du conteneur.

Sauvegarde SUTRA créée sur OVH dans `/opt/purama/apps/sutra/backup-t01-20261012-OXl8CklD/`, permissions 0700/0600. `sutra.dump` contient le schéma SUTRA et ses données ; `public-social.dump` les trois tables publiques social_accounts/social_posts/social_autopilot_config. Les deux archives ont été entièrement décodées par `pg_restore --file=/dev/null` et hashées, sans afficher leur contenu. Ce sont deux snapshots cohérents séparés, pas un snapshot transactionnel commun ; aucun test de restauration dans une DB n'a été effectué. Les blobs Storage et autres applications sont exclus et inchangés. Ne pas présenter cette sauvegarde comme une restauration complète de Supabase.

Conteneur en place : `purama/sutra:35c137fc0bc0-9d0c6671-envn1`, healthy ; GET locaux `/` et `/login` → 200, `/api/points` sans session → 401. Aucun remplacement, déploiement, migration, changement DNS ou rollback effectué dans cette reprise. HTTPS direct vers OVH échoue à la validation de l’émetteur ; le chemin Cloudflare complet reste à qualifier.

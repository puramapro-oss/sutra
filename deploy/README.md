# Déploiement OVH SUTRA — état du 2026-10-13

**Production active : `3e5596ea287f36427f687d3f3882d35c3f7c407b`**, https://sutra.purama.dev . CI 38322846966 verte. Image exacte `sha256:4c773d0275baf2260b341901775c7b0f47a64bea5c4c711a686ed4643393e6b3` ; runtime conservé opaquément. Handoff complet : `../HANDOFF-SUTRA-T01-20261012.md`.

Les huit migrations de la release sont appliquées ; restauration de 140 tables vérifiée avant les deux dernières corrections de droits. Sauvegarde privée : `/opt/purama/apps/sutra/backup-t01-coherent-qdule8xx`. Le bucket sutra-assets est privé ; aucun objet supprimé. 35 GET Supabase sans lignes, 120 assertions SQL et cinq GET internes + cinq HTTPS publics PASS. Aucun fournisseur payant appelé.

Commandes de vérification/rollback depuis le worktree T01 :

```sh
python3 deploy/ovh.py smoke --source-ref 3e5596ea287f36427f687d3f3882d35c3f7c407b --public
python3 deploy/ovh.py rollback --source-ref 3e5596ea287f36427f687d3f3882d35c3f7c407b
```

Le smoke contrôle 200 sur `/` et `/login`, 401 sur points/status vidéo/média sans session ; TLS vérifié normalement. Il exige le snapshot `/opt/purama/apps/sutra/rollback-3e5596ea287f36427f687d3f3882d35c3f7c407b` et rollback automatiquement en cas d’échec. La commande rollback restaure Compose/runtime et attend healthy. Un rollback réel de 3591818 a été effectué après 403 Supabase, avant correction puis déploiement final.

Le rollback applicatif conserve SQL/DNS et le bucket privé. Ne pas rouvrir les médias ni restaurer un ancien dump au-dessus de nouvelles écritures. Vercel, anciennes images et sauvegardes restent disponibles. Auth est sauvegardé seulement comme fixture d’ID référencés pour restauration SUTRA ; ce n’est pas une sauvegarde complète Supabase/Auth. Les blobs ne sont pas gelés transactionnellement.

Cloudflare : A 144.217.14.210 DNS only, TTL Auto. TLS Let’s Encrypt valide ; resolver `mytlschallenge` ajouté au seul routeur SUTRA. DNS et TLS détaillés dans `../qa/deployment-20261013/dns-tls-release.json`.

Pour une prochaine release, construire un nouveau candidat exact :

```sh
python3 deploy/candidate.py --source-ref SHA40
```

Ce candidat démarre sans réseau externe, vérifie cinq GET et FFmpeg puis s’arrête. Ne pas réutiliser aveuglément `ovh.py deploy` : le helper partagé signale actuellement un faux écart d’environnement sur deux clés Upstash. La release courante a promu l’image candidate vérifiée, avec CI verte, sauvegarde restaurée, runtime inchangé, snapshot exclusif, assertions SQL transactionnelles et rollback automatique. Procédure exécutée et preuve : `../qa/deployment-20261013/release-procedure.py.txt`, `deployment-release.json`. Ces archives opératoires sont liées au SHA et à la sauvegarde de cette release ; ne pas les relancer telles quelles. La reprise exige un rollback précédent réussi et un snapshot strictement identique au runtime courant, sans écrasement du snapshot.

La route `/api/health` contacte des fournisseurs ; ne jamais l’utiliser pour une vérification gratuite. Aucun parcours authentifié ou fournisseur payant n’est revendiqué par les smokes publics.

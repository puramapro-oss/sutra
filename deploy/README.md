# Déploiement OVH SUTRA — état du 14 octobre 2026

**Production active : `e3b17117256269e281304cd4ab83bc722a6f7894`**, https://sutra.purama.dev . CI [38475022601](https://github.com/puramapro-oss/sutra/actions/runs/38475022601) verte. Image exacte `sha256:b0750d6f7552940017a0fcd06422304cafdde0d49aead7bc6e11af98b7d65a16` ; healthy, zéro redémarrage. [Preuves et limites courantes](../qa/ovh-final-providers-20261014/README.md).

Sauvegarde `/opt/purama/apps/sutra/backup-t01-coherent-ci1vi7kq` restaurée (140 tables, comptes identiques). Migration OAuth existante additive testée deux fois sur copie puis appliquée ; aucun écrasement de données. Seule SUNO_API_BASE_URL manquante a été ajoutée depuis le maître ; configuration et secrets applicatifs conservés.

```sh
python3 deploy/ovh.py smoke --source-ref e3b17117256269e281304cd4ab83bc722a6f7894 --public
python3 deploy/ovh.py rollback --source-ref e3b17117256269e281304cd4ab83bc722a6f7894
```

Le rollback restaure l'image/runtime précédents `f770e272…`, attend healthy, conserve la table additive et les données courantes. Ancienne image/runtime vérifiés dans un conteneur isolé ; aucun rollback de production nécessaire lors de cette promotion. Ne pas restaurer un ancien dump au-dessus de nouvelles écritures. Auth sauvegardé comme ID référencés seulement, pas comme sauvegarde Supabase globale ; blobs non gelés transactionnellement.

La procédure exécutée `qa/ovh-final-providers-20261014/promote.py` est une archive liée au SHA et au snapshot exclusif, **pas une commande à rejouer**. Pour une autre release, construire un nouveau candidat avec `python3 deploy/candidate.py --source-ref SHA40`, puis refaire les seuls contrôles touchés et les gates de promotion nécessaires. Ne pas utiliser aveuglément `ovh.py deploy` : le faux écart Upstash du helper partagé reste documenté ; cette promotion conserve les octets du runtime.

Cloudflare DNS-only observé vers OVH, TLSv1.3 Let's Encrypt valide jusqu'au 10 janvier 2027. Aucun DNS modifié. API Cloudflare non vérifiée faute de credential dans le maître, sans impact sur le service public.

La route `/api/health` contacte des fournisseurs : ne jamais l'utiliser pour une vérification gratuite. Les smokes publics ne prouvent pas le parcours connecté ou une génération payante. RunPod401/Shotstack403 restent des blocages de compte ; Zernio attend l'attribution prouvée utilisateur/organisation et les consentements.

Historique précédent : `qa/deployment-20261013/`, `qa/postdeploy-20261013/`. Toutes les images/sauvegardes et les WIP tiers sont préservés.

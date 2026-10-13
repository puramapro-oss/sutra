# SUTRA — activation contrôlée des fournisseurs, 14 octobre 2026

**CONFIGURATION OVH ET LOCALE VALIDÉE ; génération réelle NON TESTÉE.** Cette preuve remplace les blocages de clés et de liaison décrits dans le rapport OVH précédent. Application déployée inchangée : `e3b17117256269e281304cd4ab83bc722a6f7894`, https://sutra.purama.dev. Aucun achat, rendu, génération, publication, migration, rotation ou GPU Mac.

## Résultat et provenance

- Source unique : `~/.env.purama.master`, 0600, inchangé. Seuls RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID, SHOTSTACK_API_KEY et SHOTSTACK_PRODUCTION_KEY sélectionnés. Espace final de RUNPOD_ENDPOINT_ID normalisé dans la copie ; endpoint déjà identique après normalisation, trois clés remplacées.
- OVH : runtime 0600, image exacte conservée, seul conteneur SUTRA recréé. Tous les autres paramètres/app secrets/origines et autres conteneurs inchangés. `.env.local` isolé créé 0600 et ignoré par Git : quatre variables + liaison vérifiée uniquement.
- Sauvegarde de configuration : `/opt/purama/apps/sutra/rollback-provider-config-20261013T234159Z`, 0700/0600 ; octets et mode vérifiés. Sauvegarde locale privée hors Git également conservée. Aucun rollback nécessaire. Retour automatique sur échec couvert par tests, ne pas rejouer l’activation sans nouvelle nécessité.
- Zernio : identité Auth confirmée et profil SUTRA uniques pour le compte de recette autorisé ; organisation PURAMA confirmée par utilisateur. API maître identique au runtime ; unique profil existant nommé **Default**, appartenant au currentUserId de rôle owner. Aucun profil inventé, créé ou renommé ; association univoque serveur vers profil enregistrée sans publier les identifiants. L’API utilisateur Zernio ne fournit pas d’email : cette preuve ne prétend pas y avoir vérifié l’adresse.

| Contrôle depuis le runtime déployé | Résultat | Limite |
| --- | --- | --- |
| RunPod GET `/v2/{endpoint}/health` | HTTP200 et schéma jobs/workers valide | Clé volontairement restreinte à cet endpoint ; aucun élargissement. Zéro worker ready observé ; scale-to-zero possible. Contrat du modèle et génération NON TESTÉS. |
| Shotstack GET `/edit/stage/templates` | HTTP200, tableau valide | Aucune soumission/rendu. |
| Shotstack GET `/edit/v1/templates` | HTTP200, tableau valide | Production authentifiée, aucun crédit consommé par rendu. Environnement applicatif sélectionné reste stage. |
| Zernio GET profils/utilisateur/comptes | HTTP200, propriété/liaison vérifiées, zéro compte social connecté | Consentements utilisateur et publications réelles NON TESTÉS. |
| Santé / accès public et interne | 10 GET conformes, conteneur healthy, zéro restart/erreur agrégée | Aucune génération ni route health potentiellement payante. |

Preuves expurgées : `preflight.json`, `activate.json`. Les champs masterComparison du reçu représentent l’état **avant** synchronisation ; runtimeAllSelectedMatchMaster représente l’état final. Aucun corps fournisseur ni secret journalisé.

## Commandes déjà exécutées

| Commande | Résultat |
| --- | --- |
| `python3 -m unittest discover -s qa/provider-activation-20261014 -p 'test_*.py' -v` | 17 PASS : association ambiguë/étrangère refusée, identité, parsing/config atomique, backup, rollback exact simulé. |
| `npx --no-install eslint qa/provider-activation-20261014/runtime-probe.mjs` | PASS |
| `node --check qa/provider-activation-20261014/runtime-probe.mjs` | PASS |
| `node --require ./qa/t08/offline.cjs --import tsx --test scripts/test-api-contracts.mts scripts/test-local-engine.mts scripts/test-shotstack-contracts.mts scripts/test-zernio-oauth-contracts.mts` | 50 PASS, 0 FAIL/0 SKIP ; environnement minimal et fixtures, réseau bloqué, aucun dotenv applicatif. |
| `python3 qa/provider-activation-20261014/run.py preflight` | PASS, lectures seulement |
| `python3 qa/provider-activation-20261014/run.py activate` | PASS, quatre variables autorisées + binding, sauvegarde et reprise SUTRA contrôlées |

La gate complète du code e3b1711 reste celle de la CI38475022601 ; aucune répétition lourde sans changement produit. L’ajout Salad fait l’objet d’un jalon séparé, non présent dans l’image actuelle.

## Parcours et actions restantes

Connexion : https://sutra.purama.dev/login ; création : https://sutra.purama.dev/create ; atelier : https://sutra.purama.dev/production ; consentements : https://sutra.purama.dev/settings/social . Les pages privées nécessitent le compte utilisateur, sans partage de mot de passe. Les consentements des réseaux choisis doivent être accomplis par l’utilisateur ; aucun compte n’a été connecté automatiquement. Documentation : https://docs.zernio.com/guides/connecting-accounts .

Le mode personnel est encore désactivé dans l’image actuelle : LOCAL_ENGINE_ENABLED=false, aucun worker distant configuré. Le Mac ne sert pas de GPU à OVH. Le routage propriétaire refuse tout repli payant. Le pipeline complet contient encore des fournisseurs pour script/voix/musique/assemblage ; un adaptateur vidéo open source seul ne démontre pas un pipeline entièrement open source. Les clients conservent le routage API ; auth valide ne prouve pas génération/rendu réussi.

Aucune nouvelle action de clé RunPod ou Shotstack n’est nécessaire pour les GET validés. Aucun coût de génération n’a été engagé. Toute future génération réelle nécessite devis adapté et accord explicite.

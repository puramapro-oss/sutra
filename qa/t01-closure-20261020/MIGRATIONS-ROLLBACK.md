# Préparation uniquement — aucune exécution OVH autorisée par ce lot

Le candidat exige les migrations historiques durable/permissions/historique social, puis `20261019_partner_scan_atomic.sql` et `20261020_t03_auto_scheduler.sql`. Les deux nouvelles migrations sont seulement appliquées et restaurées sur PostgreSQL privé de test. Les droits et objets historiques ne sont pas présumés présents en production arrêtée.

Avant une future promotion explicitement autorisée : identifier la cible SUTRA et la base partagée, vérifier l'ownership, maintenir dispatch/génération/publication fermés, sauvegarder données/objets/ACL/config dans le chemin protégé canonique, répéter la restauration sur une copie isolée et contrôler les données historiques. Le reçu doit avoir moins de quatre heures. Ne pas substituer le backup périmé du16/10.

La gate existante attend maintenant, en plus des preuves historiques, `additional-migrations.json`. Son contrat est `validate_additional_migration_proofs` dans `deploy/promotion_guards.py` : source Git exacte, hashes des deux SQL, répertoire et artefacts du backup, dates backup ≤ rehearsal ≤ apply, données conservées, double application sûre, rollback sans perte, restauration vérifiée, aucun changement de production pendant rehearsal. Le rollback doit être conservé dans le répertoire protégé du backup. Les trois empreintes avant/après/rollback et l'empreinte de la requête catalogue sont obligatoires. `afterState` vient de `ADDITIONAL_SCHEMA_SQL`, jamais d'un JSON inventé ; son hash canonique doit correspondre au schéma relu avant/après promotion.

La requête porte seulement sur le catalogue : définitions/arguments/ACL/propriétaires des trois fonctions, colonnes/contraintes/index/trigger/RLS/politiques des trois tables. Elle n'extrait pas de lignes utilisateur ni de secret. Les RPC métier doivent être exécutables par service_role et refusées à anon/authenticated ; le trigger de curseur doit être actif et l'index partenaire valide. Un reçu absent, périmé, dérivé d'un autre SHA ou un catalogue divergent bloque avant promotion.

Ce lot ne crée aucun reçu de production et n'ajoute pas de producteur automatique de preuve distante. Le futur opérateur autorisé doit obtenir et conserver les faits de la répétition/application réelles. Les reçus de test synthétiques ne sont jamais admissibles en production. `verify_catalogue.py` ne cible que le cluster temporaire déclaré par le reçu T03 : redémarrage privé, deux SQL exacts, contrôle catalogue, arrêt garanti dans finally.

Ordre de rollback futur : garder cron/dispatch fermés ; remettre une image applicative compatible par le mécanisme CAS/lock/snapshot existant ; appliquer uniquement les rollback SQL effectivement nécessaires et vérifiés. Le rollback ordonnanceur retire la nouvelle RPC mais conserve curseur, trigger, jobs, quotas et checkpoints. **Ne pas remettre en service l'ancien cron vulnérable R107.** Le rollback partenaire retire la RPC, conserve les données/index/droits serveur ; restaurer une ACL ancienne exige son snapshot, pas de révocation aveugle. Un rollback applicatif ne corrige pas les anciens défauts.

Le snapshot historique est `/opt/purama/apps/sutra/rollback-ab935e59ca4e39776630f05b2ba6c0422c74ec62`, ancien SHA `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164`. Commande historique, **NE PAS EXÉCUTER dans cette mission** :

```sh
python3 deploy/ovh.py rollback --source-ref ab935e59ca4e39776630f05b2ba6c0422c74ec62
```

Elle exige relecture des hashes/état attendus, cible exacte et autorisation. Aucune restauration complète identités/sessions/blobs ni répétition des nouvelles migrations sur la sauvegarde de production actuelle n'est prouvée ici. Un état distant inconnu conserve le verrou durable ; ne pas lancer un rollback concurrent à une mutation dont la fin n'est pas réconciliée.

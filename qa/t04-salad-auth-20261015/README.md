# T04 — reprise de saisie Salad, 15 octobre 2026

Base exacte T01 `d5d49a458e9e630ffbc1a433a7693a8cecd7dad5`, candidat applicatif `c7a7ebd876d36c521b1c30f6d487b7bb07f000a8`, CI [38750974353](https://github.com/puramapro-oss/sutra/actions/runs/38750974353) SUCCESS selon reçu T01. Branche `codex/sutra-t04-salad-auth-20261015`. Aucun produit réimplémenté ; seul le diagnostic du lanceur existant est corrigé.

## Résultat borné

- **PASS : 30 tests ciblés**, soit 3 nouveaux diagnostics +21 régressions Python +6 contrats Node. Zéro échec ou skip après correction.
- **FAIL reproduit puis corrigé :** un refus de saisie ne désignait pas le champ rejeté ; la sortie Terminal masquait également le code de refus/HTTP pourtant disponible dans le reçu. Le test rouge contient 3 méthodes et5 échecs de méthodes/sous-tests, pas5 défauts produit. La correction conserve seulement le NOM du champ, le code constant et un éventuel statut HTTP ; aucune valeur ni corps distant.
- **BLOQUÉ saisie :** le reçu utilisateur du15octobre18:03:40UTC est `INVALID_LITERAL_INPUT`, avant réseau. L'ancien reçu ne permet pas de déterminer le champ saisi fautivement. À18:07:39UTC, `SALAD_API_KEY` est toujours présente mais non littérale ; `SALAD_ORGANIZATION` et `SALAD_PROJECT` sont absentes. Voir `before.json`. Aucun HTTP Salad observé dans cette reprise, aucune écriture du master. Aucun refus API inventé.
- **NON TESTÉ :** authentification réelle, crédits, droit de création, état d'un groupe, image construite, CUDA/GPU/VRAM, génération, réplication/interruption et coût réel. Aucun lancement GPU.

Le nouveau lanceur a été transmis à Matiss pour une saisie masquée. Un résultat de test simulé ne remplace pas un reçu HTTP authentifié. Le blocage est une entrée locale valide manquante, pas une panne démontrée de Salad.

## Action utilisateur gratuite restante

Exécuter dans son Terminal :

```sh
/Users/matissdornier/purama-worktrees/sutra-t04-salad-auth-20261015/qa/t04-salad-auth-20261015/Saisie-Salad.command
```

Le lanceur réutilise `../t04-salad-access-20261015/secure_setup.py`. Saisir uniquement la valeur demandée, sans préfixe/commande/guillemets/espaces, depuis [le portail Salad](https://portal.salad.com) : menu du compte → API Access → Current API Key, puis les noms techniques de l'organisation et du projet. Ne rien transmettre dans le chat. `getpass` exige un vrai TTY sans écho. Le reçu expurgé est dans `qa/t04-salad-access-20261015/live-status.json` du **nouveau worktree**, ignoré par Git et privé0600.

La [documentation officielle API](https://docs.salad.com/reference/api-usage) confirme le header `Salad-Api-Key`, distinct du Bearer AI Gateway. La [découverte officielle du scope](https://docs.salad.com/agents/container-engine/discover-scope-and-preflight), relue pendant cette reprise, dit que l'API publique ne liste pas les organisations/projets : leurs noms doivent venir du portail/opérateur, aucun endpoint deviné.

Deux GET bornés seulement : quotas de l'organisation puis groupes du projet, uniquement si le premier contrat réussit.15s/requête corps compris,1MiB, redirections refusées,40s/processus, aucun retry ni POST. Un200 doit aussi satisfaire son schéma ; un401/403 ne distingue pas clé invalide et droits insuffisants,404 ne distingue pas scope absent et non visible. Les corps de groupes peuvent contenir des secrets et ne sont jamais sérialisés. Les deux preuves validées précèdent la sauvegarde atomique des seuls trois noms autorisés, avec verrou/concurrence et permissions0600. Aucun changement `SALAD_ENABLED`.

## Configuration SUTRA/OVH et fournisseurs réutilisés

Le code `src/lib/salad/config.ts`, le host/bridge existants et `src/lib/salad/container/README.md` restent inchangés. Configuration serveur désactivée par défaut ; aucune clé de compte transmise au worker. Le token worker doit être distinct de la clé Gateway. Les routes worker `/health`, `/v1/capabilities` et jobs exigent leur Bearer ; les deux GET de gestion ci-dessus ne prouvent pas ces routes.

T01 garde OVH, SQL, activation et intégration. Son reçu de coordination du15octobre18:07:10UTC rapporte OVH observé18:05UTC : source `86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164`, healthy,0restarts,SaladOFF, configuration privée0600. **Preuve T01 réutilisée, aucun SSH/config distant T04**. Aucun `.env.local` créé ni secret copié.

`reuse.json` compare91 fichiers avec la livraison T04 `db93ef04165cb6aee9a26bd6b6e732a6c6127a1b` :90 identiques. Seule `src/app/api/production/route.ts` diffère : filtrage public d'erreurs T02 déjà intégré et validé dans la CI c7 ; fichier non modifié ici. Adaptateurs/dépendances/worker réutilisés. La CI c7 compte990contratsPASS/7SKIP et1022legacyPASS/25SKIP ; ces nombres ne sont pas ajoutés aux30tests locaux. TypeScript/lint/build produit inchangés, pas de gate globale répétée.

LTX, RunPod, Shotstack et Suno restent au [rapport de contrats intégré](../t04-salad-access-20261015/README.md#contrats-existants-vérifiés-sans-réimplémentation), avec sources officielles et limites distinctes. Les lectures RunPod health200, Shotstack stage/v1 templates200, SunoAPI crédits200 sont datées du14octobre13:58UTC, pas de nouveaux tests. LTX auth/génération non prouvées. Aucun fallback payant, cancel/webhook non documenté ou compatibilité GPU ajouté à l'annonce.

## À transmettre à T01 avant essai GPU

Noms observés absents : `SALAD_ORGANIZATION`, `SALAD_PROJECT`. Nom présent mais syntaxe refusée : `SALAD_API_KEY`. Source unique `~/.env.purama.master`; aucune valeur dans les preuves. Les autres noms ci-dessous ne sont **pas déclarés absents** : leur présence n'a pas été relue dans cette reprise.

Avant activation T01 doit vérifier `SALAD_ENABLED`, `SALAD_GATEWAY_URL`, `SALAD_WORKER_TOKEN`, `SALAD_QUALIFICATION_JSON`, `SALAD_QUOTE_JSON`, `SALAD_REQUEST_TIMEOUT_MS`, `SALAD_GENERATION_TIMEOUT_MS`, `SALAD_MAX_ESTIMATED_COMPUTE_USD`, `SALAD_WORKER_DATABASE_URL`, `SALAD_DEPLOYMENT_RECEIPT_PATH`, `SALAD_COMFY_URL`, `SALAD_BRIDGE_URL`, `SALAD_WORKER_PORT`. `SALAD_CONTAINER_GROUP` est un identifiant d'exploitation optionnel, pas une preuve de qualification. Ne pas inventer de manifeste, devis, image, poids ou GPU.

Recette Docker intégrée réutilisée : Linux/amd64, bases par digest, dépendances verrouillées, contexte allowlist18fichiers. **Recette disponible, image non construite ni qualifiée**. Workflow LTX-Video0.9.8 T2V seulement, pas API LTX V2. Aucun téléchargement massif ou calcul Mac. Le prix historique RTX3090 0,09USD/h n'est pas un devis garanti.

Après les deux GET gratuits, le [protocole minimal existant](../t04-salad-access-20261015/README.md#image-existante-et-premier-essai-restant) reste à autoriser : builder Linux/image/digest/poids officiels et licences ; PostgreSQL/TLS/rôle dédié ; Gateway/token/probes ; budget total daté incluant cold start, une réplique sans autoscaling. Un premier calcul qualifie le profil réel ; un second job HTTP valide le contrat après manifeste réel. Intention/ID durable puis reprise GET seulement, média/SHA/provenance, coûts estimé/réel séparés, arrêt autorisé explicite. Éviction, réplication, OOM et redémarrage réels sont des essais supplémentaires. Aucun coût/génération n'est déduit d'une clé valide.

## Vérification locale

Commandes exactes et codes dans `checks.json`, rouge/vert et régressions dans les quatre logs de tests. Le nouveau lanceur passe `/bin/sh -n`. Python exécuté par les tests, aucune dépendance ajoutée. Analyse d'impact GitNexus avant modification : `configure` un appelant direct `main`, zéro flux applicatif recensé, LOW ; `main` LOW. **Index partiel/tronqué** : absence de flux ne certifie pas absence de risque. Détection finale et scan secrets à consigner avant commit ; ils ne certifient ni production ni GPU.

Clôture accès18:15:17UTC : `final-access.json` confirme `MASTER_LITERAL_INPUT_REQUIRED`, même état des trois noms, zéro requête et zéro écriture. Ancien reçu18:03:40UTC inchangé, aucun reçu du nouveau lanceur. Matiss reste le seul à pouvoir compléter la saisie masquée ; aucune erreur HTTP distante observée.

GitNexus final initial : staged21fichiers/18symboles/0flux LOW, liste courte plafonnée ; comparaison main4005fichiers/10114symboles/228flux CRITICAL sur historique intégré, distincte du delta local et explicitement signalée. Analyse finale du delta conservée séparément ; même avec --limit100, le formateur CLI affiche15symboles puis un compte résiduel, sans liste exhaustive. Aucune certification globale issue de ce graphe partiel.

Détection finale après rafraîchissement :27fichiers/28symboles/0flux, LOW ; seuls configure/main, tests et sections documentaires dans le delta. Lecture directe du diff confirme aucun fichier produit ; l’index reste partiel. Les seuls rapports de validation ajoutés après cette détection ne changent aucun code.

Scan gitleaks du diff staged expurgé :PASS,0secret détecté ; diff-check PASS. Aucun nouveau code après les30tests. Liste exacte des fichiers dans files.json. Ce lot ne certifie pas zéro bug ni l’authentification distante.

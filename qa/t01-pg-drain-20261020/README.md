# T01 — fermeture PostgreSQL du harnais de reprise

Base : `7a23ab17d6f2a8b4a4fe2088656279c49ff80128`.
CI initiale `39433814419`, job `118665466773` : dix contre-tests PASS, puis arrêt du processus au onzième avec SQLSTATE 57P01 lors du redémarrage privé. Le cluster est arrêté par le finally du lanceur. Ce résultat FAIL reste conservé ; aucun PASS global déduit des dix premières assertions.

Cause reproduite sans base ni réseau : la version installée de pg-pool retire immédiatement les clients de sa liste et résout pool.end avant les événements end des connexions. Le pg_ctl synchrone suivant peut terminer le serveur avant leur fermeture effective. Il ne s'agit pas d'un second pool de l'application.

Correction uniquement QA : suivre les événements connect/end publics et attendre toutes les fermetures après pool.end, avant restart et en clôture. Aucune interception d'erreur, aucune assertion ou étape supprimée. Le runner exécute quatre tests déterministes de ce cycle et enregistre les empreintes du helper et des tests. Le contre-test PostgreSQL réel reste inchangé.

PASS local : quatre tests, zéro échec/skip ; lint des quatre sources QA et git diff --check exit0. Les résultats observés sont dans local-checks.json. Le redémarrage PostgreSQL réel corrigé reste à confirmer par la CI du nouveau SHA ; aucune base distante modifiée. Produit, SQL et dépendances identiques à la base ; lint/TS/build et sécurité précédents restent attribués à cette base jusqu'à la CI exacte.

GitNexus impact ciblé demandé avant édition : symbole absent de l'index (six commits de retard), UNKNOWN. L'homonyme historique a trois consommateurs et risque LOW mais ne certifie pas cette copie. Revue directe : countertest importe startWire ; run exécute countertest. Détection des changements obligatoire avant commit, reçus partagés. Aucun graphe partiel présenté comme exhaustif.

Preuves complètes : `.coord/handoffs/SUTRA-20261012/T01-FINAL-MEMOIRE-INTEGRATION-20261020/pg-drain-repair/` dans le dépôt de coordination. Nouveau manifeste 1224 chemins : les 1222 précédents conservés, deux sources QA modifiées, deux sources QA ajoutées. Les 1160 chemins historiques restent conservés. Les imports T02–T07, migrations, contrats produit et protections restent identiques.

ACK et verdict T08 sur le nouveau candidat restent personnels et non transférés automatiquement. Production, publication, fournisseur payant, GPU et T09 restent fermés selon les réserves documentées. Aucun autre worktree écrit.

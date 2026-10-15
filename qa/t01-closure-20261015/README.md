# SUTRA — clôture intégration du 15 octobre

Base d5d49a458e9e630ffbc1a433a7693a8cecd7dad5 (produit c7a7ebd876d36c521b1c30f6d487b7bb07f000a8). Candidat final en préparation, aucune nouvelle promotion présumée. Production vérifiée18:05UTC :86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164, healthy/0restart, Salad désactivé.

## Deltas et propriétaires

- T02 e63aedd946cde9f207350d27fab9ed4422b43ebf : retests intégrés,60blobs QA/docs exacts. Correctif RPC8c41629 déjà présent, aucun doublon. Les append journaux restent au commit auteur.
- T04 7176c7219110d886eb51b18d38bbc620fedcc0ee : diagnostic de saisie Salad expurgé,28blobs exacts.30tests gratuits auteurs PASS. Authentification Salad BLOQUÉE saisie; clé master non littérale et organisation/projet absents selon reçu18:15UTC. Zéro requête envoyée. Action : saisie masquée via Saisie-Salad.command avec clé et slugs techniques de https://portal.salad.com/ ; aucune ressource GPU créée/activée.
- T07 483d1973ab114d000f602fc8c4c5aa2e3f31b055 :135blobs exacts, huit fichiers produit. UI préférence ordonnanceur, reçu UUID/reload, annulation stricte et consultation GET après ACK perdu.52PASS optimisés ciblés; précédent46PASS recouvrant non sommé. Rouge dev hydratation conservé, non reproduit sur optimisé, cause inconnue. Route T01 livrée conjointement. Harnais final réutilisé :20familles Chromium/WebKit et deux familles Chromium nouvelles, une build de fixture commune; aucune activation serveur.
- T01 : GET/PATCH auto/config : diagnostics privés retirés, authError refusé avant lecture privilégiée. Reproduction7PASS15FAIL puis22PASS0FAIL0SKIP, garde compte réelle et frontières simulées.
- T01 : GET production par requestId+targetStep afin de retrouver la tâche après ACK perdu sans rejouer une création annulée. Auth/session révoquée, isolation utilisateur/kind/clé, identité validée, no-store, erreurs expurgées.29tests nouveaux PASS; ensemble57PASS avec régressions POST/RPC/annulation.404 ne prouve pas une annulation : demande originale potentiellement encore en vol. Aucune nouvelle file ni moteur.

## Préparation OVH

Sauvegarde18:10:14UTC `/opt/purama/apps/sutra/backup-t01-coherent-3h1hmrkq`,141tables restaurées avec comptes identiques, valide4h. Trois migrations finales répétées sur copie privée : application/rejeu/rollback PASS. Aucune DDL production encore. Anciennes preuves conservées dans superseded-receipts avant remplacement canonique.

Auth sauvegardée sous forme d’ID référencés seulement; pas une sauvegarde Supabase globale. Les blobs ne sont pas figés transactionnellement. Ne jamais restaurer l’ancien dump par-dessus de nouvelles écritures. Les futurs rollback d’image et SQL sont séparés et contrôlés.

Aucun cron/worker autonome présent; absence d’infrastructure exécutante distinguée de la configuration. Observer lecture seule préparé; aucun dispatch/génération/publication activé. R30 exécution autonome réelle reste BLOQUÉ; R74 annulation distante create reste absente. Les contrôles UI ne changent pas ces limites.

## Gates

Campagne finale unique sur le prochain SHA : CI qualité(typecheck/lint/build), contrats/sécurité/médias, PostgreSQL et E2E production ciblés. Aucun ancien PASS inchangé ne sera additionné aux nouveaux tests. Les7SKIP contrats et25SKIP legacy historiques restent explicites; aucune transformation d’échec en skip.

GitNexus impact routes HTTP UNKNOWN, consommateurs et tests directs bornent la revue; index partiellement tronqué, aucune certification exhaustive prétendue. Detect_changes requis avant commit. Sept empreintes WIP étrangères inchangées; aucun terminal/service fermé.

## Revue avant gel18:50UTC

Typecheck intégré, lint ciblé et7tests T07 PASS. detect_changes exécuté : CRITICAL avec graphe partiel et associations étrangères; dix fichiers produit revus directement, aucune certification exhaustive du graphe. Gitleaks diff brut2alertes sur métadonnées Git de PNG (empreintes exactes auteur), scan des245fichiers texte réels PASS; aucune règle désactivée. Les journaux de preuves historiques gardent leur contenu exact, y compris espaces finaux. Campagne exacte CI/T08 encore attendue.

## Réconciliation CI navigateur après f29bce5

CI38788915903 : contrats et DB SUCCESS, quality FAIL uniquement sur ancien contrat t07-flows ligne123. TypeScript/lint/build avaient passé, étapes navigateur suivantes non exécutées. Preuve rouge conservée. Le harnais est aligné sur le reçu durable : nouvelle production verrouillée pendant état incertain; UUID et corps conservés; reprise explicite GET; résultat original sans second POST ni changement de navigation; jobId fixture conforme UUID. Aucun produit changé ni test désactivé. Retest dans archive isolée sans secrets, réseau externe bloqué, dépendances existantes de même lockfile. Une première tentative dans le worktree a été refusée par la garde de fichiers environnement : aucun test exécuté par cette tentative.

Contre-épreuve optimisée 2026-10-15T19:15:43.930631+00:00 : `node qa/t08/run.mjs browser-redteam` PASS, 217 contrôles annoncés, aucune erreur masquée. Premier rouge local après résultat conservé (ancien sélecteur generate-script remplacé par contrôle accessible existant Regenerer le script). Lint du seul harnais PASS. 1093 empreintes manifeste conformes, sept WIP étrangers inchangés. Aucun fichier produit changé. CI exacte et T08 restent requis avant migration/promotion.

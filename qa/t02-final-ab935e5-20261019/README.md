# T02 — sécurité candidat final, 19 octobre 2026

ACK T02 explicite sur **ab935e59ca4e39776630f05b2ba6c0422c74ec62 : FAIL**. Ce SHA existe, il est la base isolée et le candidat annoncé par T01. Les anciens correctifs ciblés sont intégrés et leurs régressions passent. Cinq routes supplémentaires contiennent des défauts reproductibles; voir le complément partenaire en fin de rapport. Les correctifs locaux passent leurs tests, **pas encore intégrés**; un défaut de quota atomique reste FAIL et transmis à T01 SQL. Aucun ACK global ni feu vert WanGP ne découle du PASS local.

Branche : `codex/sutra-t02-security-ab935e5-20261019`. Worktree unique : `/Users/matissdornier/purama-worktrees/sutra-t02-final-sha-security-20261015`. Produit limité aux cinq routes réservées dans les deux LOCKS avant édition. Notifications à T01/T08 dans le miroir T02 existant. Aucun autre worktree modifié, push, merge, déploiement, migration distante, appel fournisseur, courriel réel ou génération. La consultation publique npm/GitHub est la seule lecture réseau de ce lot.

## Défauts, causes et corrections isolées

| Défaut reproduit | Cause | Correction | Preuve |
|---|---|---|---|
| GET `/api/setup` retourne200 sans session/client ordinaire; accède au client service-role et fournit le schéma si table absente | Pas de garde serveur | `createServerClient().auth.getUser()` vérifié, `isSuperAdmin` existant; 401/403 avant accès privilégié, no-store partout | `diagnostics-red.json` (1PASS/8FAIL), `diagnostics-green.json` (9PASS) |
| Diagnostics privés simulés renvoyés par `/api/setup` et `/api/health` | `error.message` renvoyé dans JSON | Réponses fixes; health public et statuts200/503 conservés | même preuve; test succès health inclus |
| Contact : HTML arbitraire dans courriel, erreur fournisseur brute,25envois anonymes acceptés et faux succès si Resend refuse | Interpolation HTML, absence limite, contrat retour ignoré | Texte brut; erreurs fixes500/502; plafond existant `enforceRateLimit`20requêtes/minute/processus, clé globale non forgeable par en-tête ou email | `contact-red.json` (1PASS/4FAIL), `patch-regressions.json` |

Le plafond contact est une protection par processus, pas une limite distribuée. Il peut être épuisé par un tiers; le réglage opérationnel et un contrôle distribué restent T01. Aucun secret n'a été nécessaire à ces reproductions.

## Commandes et résultats

Exécutés sur l'arbre exact avant correction :

```sh
SUTRA_EXPECTED_SHA=ab935e59ca4e39776630f05b2ba6c0422c74ec62 python3 qa/t02-final-ab935e5-20261019/run.py create-control delta admin-webhook oauth boundaries cron ssrf routes publication autopilot rls write-permissions
```

Reproduction rouge avant édition, puis validation du correctif isolé avec manifeste SHA256 des sources :

```sh
SUTRA_EXPECTED_SHA=ab935e59ca4e39776630f05b2ba6c0422c74ec62 python3 qa/t02-final-ab935e5-20261019/diagnostics-run.py red
SUTRA_EXPECTED_SHA=ab935e59ca4e39776630f05b2ba6c0422c74ec62 python3 qa/t02-final-ab935e5-20261019/diagnostics-run.py green
SUTRA_EXPECTED_SHA=ab935e59ca4e39776630f05b2ba6c0422c74ec62 python3 qa/t02-final-ab935e5-20261019/patch-run.py patch-regressions patch-typecheck patch-lint
python3 qa/t02-final-ab935e5-20261019/dependencies.py
python3 qa/t02-final-ab935e5-20261019/scan.py
```

Le rouge initial a été exécuté AVANT édition; ne pas l'interpréter comme le résultat actuel. `contact-red.json` conserve sa commande exacte et le hash de la route candidate. Les reçus contiennent les commandes Node24.22.0 complètes, empreintes de logs et SHA de base. Les tests réseau utilisent mocks/loopback et un preload qui refuse les fournisseurs et fichiers `.env*`. PostgreSQL est local et jetable, sans migration distante.

| Groupe | Résultat | Tests/assertions | Preuve |
|---|---|---:|---|
| `create-control` | PASS | 10 | `create-control.json` / `.log` |
| `delta` | PASS | 70 | `delta.json` / `.log` |
| `admin-webhook` | PASS | 38 | `admin-webhook.json` / `.log` |
| `oauth` | PASS | 76 | `oauth.json` / `.log` |
| `boundaries` | PASS | 76 | `boundaries.json` / `.log` |
| `cron` | PASS | 21 | `cron.json` / `.log` |
| `ssrf` | PASS | 61 | `ssrf.json` / `.log` |
| `routes` | PASS | 10 | `routes.json` / `.log` |
| `publication` | PASS | 92 | `publication.json` / `.log` |
| `autopilot` | PASS | 23 | `autopilot.json` / `.log` |
| `rls` | PASS | 261 assertions | `rls.json` / `.log` |
| `write-permissions` | PASS | 30 assertions | `write-permissions.json` / `.log` |
| `patch-regressions` | PASS | 19 | `patch-regressions.json` / `.log` |
| `patch-typecheck` | PASS | — | `patch-typecheck.json` / `.log` |
| `patch-lint` | PASS | — | `patch-lint.json` / `.log` |

Les groupes se recouvrent : ne pas additionner leurs nombres en couverture unique. `patch-regressions` comprend19tests nouveaux (9diagnostics,5contact,5CSRF/replay). CSRF teste12origines/méthodes falsifiées, en-têtes proxy falsifiés, chemin ressemblant à un asset,12formulaires refusés, JSON légitime et callback Suno répété sans effet. Les accès directs aux routes sont testés sans passer par le middleware.

## Portée et réserves

- PASS borné : authentification serveur/session expirée ou bannie, rôles admin, refus entre utilisateurs, médias privés/ownership et TTL; RPC production sans diagnostic brut; OAuth état aléatoire lié à session/profil/utilisateur, expiration/usage unique, révocation et échec fournisseur; cron secret absent/invalide, routes API et webhooks Stripe sans signature/rejeu; SSRF DNS/rebinding, redirections/IP réservées, contenu MIME/limites/timeouts; moteur personnel interdit au client. Voir les noms des cas dans chaque log.
- PASS PostgreSQL local : RLS261assertions et30permissions d'écriture. Ces fixtures n'attestent pas la configuration DB distante aujourd'hui.
- Inventaire :20entrées cron,19gardes directes `assertCronAuth` et un réexport; aucune seconde auth cron.130routes API inventoriées avec hashes et marqueurs lexicaux. **Cet inventaire ne prouve pas à lui seul l'autorisation de chaque action métier.** Les routes publiques historiques hors cas exécutés ne reçoivent pas un PASS dynamique exhaustif.
- NON TESTÉ : isolation native de deux organisations/projets/budgets organisationnels; le modèle actuel repose sur `user_id`, sans `organization_id`/`org_id`/`tenant_id` dans les sources SQL/application examinées. Ne pas assimiler deux utilisateurs à deux organisations. Toute extension organisations doit définir membership/roles/RLS et jobs/storage/budget liés côté serveur, avec fixture2×2.
- BLOQUÉ externe : le reçu T01 du19/10 19:54UTC indique application OVH et DB arrêtées depuis17/10; aucune vérification distante parallèle T02. Source : registre `T01-CERTIFICATION-20261019.md`, reçus T01 `ovh-state.json`, `public-smoke.json`, `backup-db-readonly.json`. Aucune remise en marche autorisée par ce lot.
- NON TESTÉ ici : OAuth/permissions réelles des comptes sociaux, révocation chez fournisseurs, stockage et logs déployés, en-têtes du proxy, effets multi-instances et quota distribué. T06/T04/T01 propriétaires des preuves distantes. Les URLs signées déjà émises peuvent rester valides jusqu'au TTL prévu (300s).
- Config source : pas de CSP/HSTS/X-Frame-Options/nosniff explicites trouvés dans `next.config.ts`/middleware. L'état effectif proxy est à confirmer par T01; aucune modification production faite.
- Build global : non rejoué conformément au mandat; CI historique38827288351 liée à ab935 ne certifie pas les trois corrections nouvelles. Gate d'intégration T01 requise après application.

## Dépendances et secrets

`npm audit` relu sans identifiants ni installation : production7alertes (2low,5moderate,0high/critical); total30 (4low,8moderate,17high,1critical). **État audit : alertes conservées, pas zéro vulnérabilité déclaré.** Vulnérabilités et lockfile identiques au bilan précédent;32versions concernées installées correspondent au lock. Les tests tripwire exécutés dans `ssrf` vérifient0appel du vieux transport request,0signature ECDSA elliptic,0Bitcoin RPC dans les flux OTS exercés; transport existant épingle DNS et refuse redirections. L'alerte uuid porte sur v3/v5/v6 avec buffer, pas le v4 utilisé par request. Les alertes proxy-addr/compression sont dans l'outillage LHCI dev, sans invocation configurée par l'application/CI constatée; risque conditionnel si serveur LHCI exposé. Aucune mise à jour massive ni changement package T01.

Sources primaires : [request SSRF](https://github.com/request/request/issues/3442), [uuid](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq), [proxy-addr](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h), [compression](https://github.com/expressjs/compression/security/advisories/GHSA-vc2v-76pw-4v95). Qualification d'exploitabilité limitée aux chemins examinés, pas à toute utilisation future des dépendances.

Gitleaks règles par défaut/redact100 :1détection, identique au fixture synthétique connu `scripts/test-release-regressions.mts:41` (hash source inchangé),0secret réel démontré dans le périmètre scanné. Aucune règle supprimée. Aucun `.env*`/master lu ni copié. Variables des tests fournies explicitement par nom avec valeurs synthétiques, jamais tirées de credentials réels. L'historique Git complet, les artefacts distants et logs de production sont NON TESTÉS.

## GitNexus et impact

Indexation locale `analyze --index-only` exécutée, sans embeddings/modèle. Graphe partiel avec entrées/branches tronquées. Impact avant édition GETsetup/checkServicehealth/POSTcontact : UNKNOWN (symboles non trouvés, y compris UID explicite). Impact contrôle créationLOW2appelants observés. Revue directe des trois routes, pas d'import applicatif de ces handlers trouvé. `detect-changes --scope all` voit3fichiers mais aucun symbole chevauchant; ce n'est pas un arbre propre ni une preuve d'impact exhaustif. Comparaison obligatoire avec main : **CRITICAL**,5092fichiers historiques/3192symboles/98flux, liste tronquée; ce grand écart historique ne décrit pas les trois corrections seules. Les rapports sont conservés, aucune certification complète du graphe revendiquée.

## Attente T01/T08

T01 doit intégrer le commit local annoncé dans le miroir T02, publier le nouveau SHA exact de candidat dans le registre, puis laisser T02 retester les19cas et les frontières concernées. Sans ce nouveau SHA, le verdict du candidat demandé reste **FAIL**, correctif local **PASS**, retest intégré **BLOQUÉ par intégration T01**. Les réserves ci-dessus restent distinctes. T08 reçoit le NACK et les preuves; aucun signal WanGP vert produit par T02.

## Complément de clôture : routes partenaires

Le commit principal `2b69a8feabb0e82e34939d96cb5176116baa244d` reste autonome. Dernière réserve d'inventaire reproduite après sa livraison sur deux fichiers encore identiques à ab935 : `src/app/api/partner/qr/[code]/route.ts` et `src/app/api/partner/scan/[code]/route.ts`. Réservations exactes et notification T01/T08 avant édition. Rouge `partner-red.json` :3PASS/5FAIL; vert `partner-green.json` :8PASS, TypeScript/lintPASS. Correction : erreurs publiques fixes, erreur de lecture partenaire/quota et erreur d'insertion refusées503 sans cookie. Les seuils existants1IP/24h et100/jour ne sont pas modifiés. GitNexus impact UNKNOWN; QR non résolu, scan0appelant résolu ne prouve pas son absence d'usage.

**FAIL restant, transmis à T01 SQL :** `partner-atomicity-red.json`,0PASS/1FAIL. Deux vrais appels du handler avec réponses DB simulées concurrentes à99 acceptent2INSERT et retournent302, dépassant le plafond100. Le schéma local ne fournit pas de primitive atomique pour cette séquence SELECTcount/INSERT. Preuve du comportement du handler, pas exploitation d'une DB distante. Il faut une vérification/insertion transactionnelle côté DB; SQL reste réservé T01. Aucun verrou en mémoire ajouté pour masquer ce cas multi-instance. La confiance dans les en-têtes IP dépend aussi du proxy T01 et n'est pas certifiée ici. L'intégration seule des cinq correctifs ne suffira donc pas à rendre cet ACK global PASS.

Les trois routes initiales et les deux routes partenaires sont les seuls fichiers produit T02. Résultats des corrections locales19+8PASS distincts, régressions précédentes inchangées; contre-exemple atomique1FAIL séparé et conservé. Commandes Node exactes dans chaque reçu. Les espaces des journaux bruts rouges et GitNexus sont conservés pour préserver leurs hashes; diffcheck code/docs PASS. Le vérificateur auxiliaire de reçus a initialement cherché un fichier .log pour npm (sortie JSON); corrigé au contrôle,20empreintes vérifiées, aucun test produit concerné.

# SUTRA T02 — securite — 2026-10-12

Statut : livraison locale du delta de securite ; integration et mise en production BLOQUEES par les contrats ci-dessous. Aucun push, deploiement, appel fournisseur reel, publication sociale ou migration distante.

## Provenance et propriete

- Branche : `codex/sutra-t02-security-pr3-20261012`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t02-security-pr3-20261012`.
- Base PR3 : `7088a0a3e733de8d2e85f3576bd86627127da369`.
- Livraison atomique : le commit contenant ce handoff, les sources et `qa/t02/verification.json`. Le SHA final est depose dans `.coord/handoffs/SUTRA-20261012/T02-COORDINATION.md` du depot PURAMA. Verifier les empreintes du manifeste contre `git show <commit>:<chemin>`.
- AGENTS, politique canonique, LOCKS, handoffs, branches et worktrees controles avant ecriture ; controle demarrage `POLICY_OK`.
- Premier worktree S5 `sutra-t02-security-20261012` conserve sans delta produit. Aucune substitution de fichier S5 dans PR3.
- Fichiers T01 tooling/dependances, T03 pipelines, T04 adaptateurs, T05 FFmpeg/probe/export, T06 comptes/publication/zernio et T07 UI preserves. Aucun WIP tiers integre.

## Defauts et corrections

| Defaut prouve localement | Correction | Preuve et limite |
| --- | --- | --- |
| Un compte banni conserve une identite Supabase valide ; les routes service-role ne recontrolaient pas le ban | Controle du profil courant dans le client SSR canonique et middleware, refus sur ban/revocation/profil absent/erreur DB ; aucune session concurrente | Tests du client et des vrais handlers avec SDK simule ; pas de fournisseur Auth reel |
| Une mise a jour de facturation peut remplacer `subscription_status=banned` | Marqueur distinct `access_revoked_at`, protege des clients, ecrit/efface par ban/unban | Tests JS + SQL local ; pas de modification des regles de facturation |
| La RLS proprietaire autorise la modification des champs privilegies de son propre profil sous grants ordinaires | Retrait des grants de table ET de colonnes ; UPDATE client sur preferences explicites seulement ; politique proprietaire restrictive | Escalade `is_admin`, credits et auto-deban reproduite avant migration puis refusee ; grants distants NON TESTES |
| Les tokens de `sutra.social_accounts` sont lisibles sous les memes grants | SELECT client limite aux colonnes descriptives ; ecriture et tokens serveur seulement | SELECT token/refresh/metadata et ecritures clients refuses dans PostgreSQL local |
| Le helper V7 `karma_award_seeds` est SECURITY DEFINER avec EXECUTE PUBLIC par defaut et montant/beneficiaire libres | EXECUTE reserve au service_role ; search_path fixe ; corps et regles metier inchanges | Attribution arbitraire a un autre utilisateur reproduite avant migration ; authenticated/anon refuses apres ; service valide |
| Un JWT existant conserve l'acces direct aux tables apres ban applicatif | Politique restrictive `account_is_active()` sur toutes les tables RLS existantes du schema sutra | Tests owner/cross-user/ban/unban et reecriture billing ; ne revoque pas les JWT Supabase ni les autres schemas |
| Les changements admin peuvent annoncer un succes malgre erreur DB/absence de ligne | Verification cible et ligne effectivement modifiee ; erreur generique | Tests ban/unban/set_plan, cible absente et erreurs ; aucun changement de prix ou de plan autorise |
| Initiation OAuth non bornee et messages fournisseur exposes | Reutilisation du limiteur existant (10/min/utilisateur), erreurs statiques connect/callback | 11e appel refuse avant fournisseur ; aucun detail sensible reflechi |
| Telechargement : erreurs DNS brutes et absence de contrat securise commun audio/image/annulation | Extension du downloader PR3 existant, DNS epingle par saut, HTTPS/443, bornes, signal externe, MIME/signatures raster/audio | Transport simule, cas DNS mixte/rebinding/metadata/redirect/overflow/compression/playlist/SVG ; decodage complet reste T05 |
| Stockage : erreurs fournisseur exposees et suppression annoncee sans verifier le resultat | Erreurs generiques upload/delete/list ; resultat fournisseur obligatoire | Tests resultats et exceptions, contrat de succes conserve ; confidentialite du bucket NON PROUVEE |

`assertCronAuth` est conserve sans second mecanisme. La suite PR3 revalide les crons sans secret, avec secret incorrect et en developpement. L'etat OAuth hache, persistant, lie a la session/plateforme et consommable une seule fois est reutilise. Les redirections de session PR3 sont conservees et retestees.

## Chemins et contrats consommateurs

Sources : `src/lib/account-access.ts`, `src/lib/supabase-server.ts`, `src/middleware.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/app/api/social/{connect,callback}/route.ts`, `src/lib/media-download.ts`, `src/lib/storage.ts`.

Migration additive : `migrations/20261012_t02_account_permissions.sql`. Tests : `scripts/test-security-{account,routes,media,storage}.mts` et `scripts/test-security-rls.mjs`.

Le schema doit etre migre **avant** le code SSR : sans `access_revoked_at`, les requetes echouent ferme. Executer les migrations historiques d'abord, puis cette migration, avec leur proprietaire BYPASSRLS. La migration est transactionnelle et rejouable. Ne pas reexecuter ensuite un ancien script de grants ou un CREATE OR REPLACE FUNCTION qui retablirait des permissions publiques. Les futures tables RLS doivent reprendre la politique restrictive ; cette migration ne les anticipe pas.

T05 : `downloadMediaBytes(url, { kind: 'video' | 'audio' | 'image', maxBytes?, timeoutMs?, signal? }): Promise<Buffer>` dans le downloader existant. `downloadVideoBytes` conserve sa signature et delegue au meme moteur. Audio mp3/wav/aac/m4a/ogg ; images png/jpeg/webp ; playlists et SVG refuses. Les signatures ne remplacent pas le decodage/ffprobe. Le cablage de tous les consommateurs audio/image reste a faire par leur proprietaire.

## Validation

Les commandes, versions, resultats et empreintes sont dans `qa/t02/verification.json` et `qa/t02/evidence/`.

- **PROUVE local : 169/169 tests**, dont 31 tests T02 et regressions PR3 cron/OAuth/session/media ; 0 skip. Les fournisseurs et le transport HTTPS sont simules.
- **PROUVE PostgreSQL local : 36 assertions**, reproductions avant/apres, double application de migration, roles anon/authenticated/service_role, isolation et revocation. Cluster propre sans TCP ni URL DB, arrete ensuite. Aucun schema distant inspecte/applique.
- **PROUVE local : typecheck PASS, build webpack PASS (197/197 pages)** avec environnement synthetique. Aucun test navigateur live ni fournisseur reel.
- Lint fichiers T02 : PASS. Lint global PR3 : FAIL, 12 erreurs et 131 avertissements hors delta (tooling/.gitnexus et fichiers T03/T04/T06). Les correctifs de tooling appartiennent a T01 ; aucun faux PASS global.
- Dependances figees T01 `19ea35fbbfe99a978f119f3939ff9935362191dc`, utilisees en lecture seule, Next 16.3.8/Supabase 2.100.1/TypeScript 5.9.3. Node local 26.0.0 ; Node CI T01 24 non rejoue ici. Le lockfile PR3 reste intact : cette preuve lie explicitement les dependances T01.
- Premier typecheck/build invalide par un lien temporaire `packages` qui incluait des sources externes : lien T02 seul retire, nouvelle validation en isolation. Aucun repertoire source supprime.

GitNexus avant edition : `createServerClient` CRITICAL (128 appelants directs/32 processus), `downloadVideoBytes` CRITICAL (5/5), `uploadToStorage` CRITICAL (10/9), alertes annoncees avant les modifications. Routes/middleware et SQL sans arcs exploitables : UNKNOWN, revue directe complementaire. Index final tronque (855 entrees exclues, 624 callees omis, 4 parcours coupes). `detect-changes --scope staged` : 17 fichiers, 127 symboles, 254 processus, CRITICAL attendu pour les helpers partages ; chemins du delta verifies directement. Sortie CLI elle-meme abregee : **aucune certification exhaustive du graphe**. Les preuves/documents finaux sont ajoutes apres cette analyse, sans changement du payload source/test.

## Blocage unique de cloture : integration des contrats et preuve distante

1. **Stockage prive / URLs signees — T01/T05/T06 avec T02.** Les generateurs et journaux persistent une URL publique durable de `sutra-assets`, souvent sans prefixe utilisateur. Il faut une reference stable bucket/chemin/proprietaire, une verification d'acces serveur et une signature courte renouvelee a la lecture/publication, ainsi qu'une reprise des objets et references existants. Remplacer aveuglement `getPublicUrl` par une URL expirante casserait la reprise. Aucune bascule de bucket faite ; ce point reste BLOQUE.
2. **Schema social public — proprietaire DB/T01/T06.** Callback/comptes/publication utilisent `public.social_accounts`, dont le contrat de propriete/migration ne figure pas dans PR3 et differe de `sutra.social_accounts`. La migration T02 protege seulement le schema SUTRA. Ne pas attribuer ces preuves a la table partagee ; audit des grants/RLS et migration exacte requis avant livraison.
3. **Revocation sociale et logs — T06.** Le code PR3 ignore `false` de `disconnectAccount`, et `zernio.ts:logError` imprime `err.message` brut. Findings transmis dans T02-COORDINATION ; fichiers reserves et WIP preserves. Integrer le resultat confirme du proprietaire, sans accepter son WIP comme preuve.
4. **Organisations : NON TESTE.** Aucun modele `org_id`/`organization_id`/`tenant_id` canonique trouve dans ce checkout. L'isolation locale prouvee est par utilisateur ; aucune isolation organisation inventee/certifiee.
5. **Exploitation : NON TESTE.** Application DB, grants effectifs, Auth reel, invalidation globale refresh/JWT, stockage prive, redirections fournisseur et publication reelle restent a verifier lors d'une integration autorisee. Le limiteur OAuth existant est en memoire par processus ; limite multi-instance non prouvee. Les dependances OpenTimestamps residuelles signalees par T01 restent a traiter dans son scope sans downgrade arbitraire.

Reprise T01 : integrer uniquement le delta commite, appliquer les migrations dans l'ordre, resoudre les contrats ci-dessus avec leurs proprietaires, puis executer les gates d'integration. Ne pas rejouer les preuves locales inchangees. Aucune autorisation de production n'est deduite de ce handoff.

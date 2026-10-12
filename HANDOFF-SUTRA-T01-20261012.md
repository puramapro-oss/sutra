# SUTRA T01 — autorisation production, 2026-10-12

**CODE_LOCAL_PASS / RELEASE_BLOCKED_CI. Aucun nouveau commit déployé.** Le mandat autorise sauvegarde, migrations SUTRA, déploiement progressif, Cloudflare/DNS/TLS et rollback. Le déploiement reste conditionné aux contrôles critiques. Le secret GitHub `SMARANA_READ_TOKEN` est absent ; les jobs distants échouent au setup, sans exécuter les tests. Aucun appel fournisseur payant.

Branche unique `codex/sutra-t01-integration-20261012`, worktree `/Users/matissdornier/purama-worktrees/sutra-t01-integration-20261012`. Base de ce delta : `89250c72237cfa9b17a1b5da251b28ed3701f719`, déjà poussée. Les sept livraisons T02–T08 restent intégrées : 1105 empreintes vérifiées, 329 chemins acceptés sans fusion globale. Détail historique inchangé : `qa/release-20261012/deliveries.json`, `accepted-content-audit.json` et les sept HANDOFF propriétaires. Les cinq SHA protégés sont conservés dans l’ascendance ; main et les branches propriétaires ne sont pas modifiés.

## Correctif courant

Médias privés : références HTTPS durables `/api/media/<base64url>`, chemins liés au propriétaire, portée AsyncLocalStorage isolant les jobs concurrents. Les signatures Storage de cinq minutes sont renouvelées après autorisation ; elles ne remplacent pas les références persistées. Shotstack résout son transport avant l’intention payante. Le journal social persiste une capability stable avant claim ; l’endpoint revalide HMAC, expiration, journal, production, compte utilisateur et destination sociale. Révocation et accès croisé sont testés. Une ancienne clé sans propriétaire inventorié est refusée.

`20261012_private_media.sql` ajoute le registre RLS réservé au service. `deploy/private-media-cutover.sql`, séparé des migrations préparatoires, ferme le bucket et interdit les opérations anonymes/authentifiées même sous une politique permissive globale. Aucun objet n’est effacé. Ne jamais rouvrir le bucket public pour un rollback ; l’ancien client ne constitue pas un rollback fonctionnel des médias privés.

Inventaire OVH : zéro référence à sutra-assets dans les 397 colonnes texte/JSON inspectées et zéro production SUTRA existante ; un objet sans propriétaire reste conservé et non attribué. Aucune réécriture arbitraire de données. Les téléchargements externes gardent les contrôles SSRF/DNS, taille et redirections.

## Validation gratuite fraîche

Depuis ce worktree, Node24.21.0 :

```sh
SUTRA_NODE=/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node
PATH="$PWD/test-results/media-bin:$PATH" "$SUTRA_NODE" scripts/run-ci.mjs contracts
PATH="$PWD/test-results/media-bin:$PATH" "$SUTRA_NODE" scripts/run-ci.mjs media
"$SUTRA_NODE" scripts/run-ci.mjs quality
"$SUTRA_NODE" qa/release-20261012/run-postgres.mjs --full
LC_ALL=C "$SUTRA_NODE" scripts/test-security-rls.mjs
"$SUTRA_NODE" qa/t08/run.mjs redteam
"$SUTRA_NODE" qa/t08/run.mjs browser-redteam
"$SUTRA_NODE" qa/t08/run.mjs legacy-offline
```

| Contrôle | Résultat |
| --- | --- |
| Contrats | 473 PASS, 7 SKIP, 0 FAIL ; schedule/composition/publication PASS |
| Médias FFmpeg réels | 34 PASS |
| Typecheck / lint / build webpack | PASS / 0 erreur,111 avertissements / PASS,197 pages |
| PostgreSQL local18 | 13 contrôles migrations +12 tests pipeline PASS |
| Permissions SQL + coupure Storage | 164 assertions PASS, migrations appliquées deux fois |
| Redteam hors réseau | 14 PASS |
| Navigateur Chromium isolé | 210 contrôles +7 extensions PASS ;165 audits axe,0 violation,0 erreur navigateur |
| E2E legacy isolés | 1022 PASS,25 SKIP,0 FAIL,0 flaky |
| Restauration OVH PostgreSQL15.8 | 136 tables aux comptages identiques ;6 migrations appliquées deux fois PASS |

Résultats bruts : `qa/production-20261012/evidence/`, `security-rls.log` et `backup-restore.json`. Les sept SKIP contrats sont INSEE live4, DB distante2, OTS réseau1 ; ce ne sont pas des PASS. Aucun parcours fournisseur réel ni E2E utilisateur authentifié sur la production n’est revendiqué. Les preuves historiques ont été conservées, notamment la sortie PostgreSQL écrasée par le runner, restaurée depuis HEAD après copie du résultat frais.

## Sauvegarde et production

Sauvegarde cohérente SUTRA + trois tables publiques sociales dans un snapshot read-only commun. Archive Storage et métadonnées conservées sur OVH, répertoire0700/fichiers0600 ; seules les métadonnées de preuve sont publiées. La fixture auth contient seulement les identifiants référencés et reste sur OVH. Ce n’est pas une sauvegarde complète de Supabase/Auth. Les blobs ne sont pas gelés transactionnellement.

Sauvegarde finale : `/opt/purama/apps/sutra/backup-t01-coherent-l01juhcq/`. Base de restauration privée conservée : `sutra_restore_t01_l01juhcq`. Empreintes complètes : `qa/production-20261012/backup-restore.json`.

La restauration en base privée a révélé puis corrigé deux prérequis : restauration avec le rôle supabase_admin, et inclusion de la fonction de trigger public.update_social_updated_at. Les deux essais incomplets sont préservés. L’essai final restaure les 136 tables et compare les comptages avant migrations. Les six migrations v10, v11, journaux, médias privés, permissions compte, permissions finales sont réappliquées deux fois sur la copie PostgreSQL15.8. Aucune DDL de production, coupure bucket, suppression de donnée ou remplacement du conteneur actuel.

Construction candidate Linux préparée via `python3 deploy/candidate.py --source-ref SHA40` : archive Git exacte, dépendances privées verrouillées, secret BuildKit opaque, conteneur sans réseau externe, GET gratuits uniquement, arrêt du seul candidat. Ne modifie ni Compose, ni DB, ni DNS. Résultat à ajouter après construction.

## Blocage externe et état Cloudflare

CI `38303074323` : trois échecs de setup, PostgreSQL16 démarre. Recherche ciblée dans les configurations sécurisées existantes, environnement, trousseau, secrets dépôt/org/environnements : aucun SMARANA_READ_TOKEN utilisable. Le credential SMARANA existant est administrateur avec repo/workflow ; il n’est pas injecté dans le CI du dépôt public. Un autre PAT existant répond401. Aucun secret affiché ni copié dans Git.

**Unique action manuelle demandée :** ajouter `SMARANA_READ_TOKEN`, limité à Contents:read sur `puramapro-oss/purama-smarana`, à https://github.com/puramapro-oss/sutra/settings/secrets/actions/new . Ne pas transmettre sa valeur dans la conversation. Après ajout : relancer les jobs, puis reprendre migration/cutover/déploiement/smoke.

Session Cloudflare authentifiée disponible. Aucun enregistrement SUTRA explicite ; les deux A wildcard216.150.1.65 et216.150.16.129 sont DNS only, vers Vercel. Le domaine public https://sutra.purama.dev répond402. Origine144.217.14.210 : ancien conteneur35c137f healthy, GET internes200/200/401 ; certificat direct non qualifié (curl60/verify20). Aucune bascule DNS/TLS exécutée tant que la gate critique CI manque. Vercel conservé. Aucun rollback nécessaire puisque rien n’a été remplacé.

## Préservation et limites

POLICY_OK ; AGENTS/POLITIQUE/BATON/plan/brief/ERRORS/LOCKS/handoffs et processus inspectés. Claim `SUTRA-T01-20261012:AUTORISATION-PRODUCTION`. `qa/production-20261012/preservation.json` :53 entrées étrangères inchangées par rapport au contrôle précédent ; worktree prunable absent conservé. Aucun reset/stash/clean, aucun arrêt de processus étranger, aucune suppression de worktree.

GitNexus impact avant modifications : dépendances médias/worker/publication HIGH/CRITICAL signalées ; nouveaux symboles UNKNOWN. Index en retard de3 commits, TRUNCATED929 entrées/519 callees/4 coupures. Les diffs directs et tests constituent la preuve bornée ; aucun certificat d’exhaustivité du graphe. Detect-changes staged :69 fichiers,33 symboles,27 flux, risque CRITICAL ; périmètre média attendu, sortie tronquée. Gitleaks :13 alertes, toutes des SHA-256 de sources vérifiées,0 non classée. Tests Python du déploiement9 PASS ; lint ciblé du dernier ajout SQL PASS.

La branche S5 historique non validée n’est pas fusionnée : budget hybride, restauration de versions et journal cron-runs ne sont pas livrés ; éditer le script ne régénère pas la voix. Rectification du rapport précédent : `src/lib/logger.ts` existe déjà ; son absence était une erreur documentaire. Ces limites ne sont pas transformées en PASS de production.

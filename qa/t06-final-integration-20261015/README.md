# T06 — intégration sociale finale et delta autopilot

**PASS sur le lot OAuth/publication intégré ; deux défauts supplémentaires corrigés localement sur social/autopilot. Intégration du nouveau delta T01 et correction UI propriétaire T07 attendues.** Aucune preuve de production ni de consentement réel.

## Candidat et preuves réutilisées

Candidat T01 reçu : `cb3f893c35599a6c9c50a4d23c82013c10c5f3ae`, CI [38797929920](https://github.com/puramapro-oss/sutra/actions/runs/38797929920). Branche T06 réutilisée : `codex/sutra-t06-integrated-retest-20261015`, parent `3edae7ae1d3c13ed2b385a9602a9ad8da6ca5b6d`. Aucun rebase, duplication du lot ou changement du worktree T01.

Commande exécutée une fois :

```sh
python3 qa/t06-final-integration-20261015/verify.py /Users/matissdornier/purama-worktrees/sutra-final-providers-20261013 cb3f893c35599a6c9c50a4d23c82013c10c5f3ae
```

`integration.json` rapproche 40 sources : 32 anciennes empreintes identiques, migration historique identique au SQL corrigé T01 déjà testé, sept entrées de contexte du candidat. Les hashes des logs CI exacts sont vérifiés et 190 noms de tests retrouvés sans ambiguïté : **76 OAuth + 92 publication + 22 auto/config**, tous PASS, aucun skip dans cette sélection. `selected-ci-assertions.txt` conserve les noms. La CI globale comporte sept skips hors de cette sélection ; aucun total global « sans skip » n'est revendiqué. Ce rapprochement ne constitue pas 190 nouvelles exécutions locales.

Les **22 auto/config ne couvrent pas social/autopilot**. Le premier reçu d'intégration précède la découverte de cette lacune ; son PASS qualifie uniquement les groupes nommés. Le nouveau rouge ci-dessous empêche de déclarer le candidat cb3 intégralement corrigé.

Les corrections précédentes `T06-INTEGRATED-01` (CAS après vrai timestamp SQL) et `T06-INTEGRATED-02` (révocation legacy, migration T01) sont intégrées. L'étape CI PostgreSQL T06 history est PASS sur cb3 ; neuf cas sont identifiés par la fixture identique et l'ancien TAP local, pas par neuf assertions imprimées dans le log CI. Les groupes SQL history27 et CAS7 sont PASS ; groupes recouvrants, ne pas additionner. L'ancien blocage d'intégration des deux corrections est levé, les anciens rouges restent conservés.

## Nouveau défaut reproduit et corrigé

`src/app/api/social/autopilot/route.ts` avait exactement le même blob Git `12b4f771f26fb921e4538f096a855c924489004e` dans notre parent et cb3. Ses dépendances directes supabase-server/account-access, package/lockfile/tsconfig n'ont pas changé entre ces SHA.

- **T06-FINAL-01 — diagnostics privés** : injecter une erreur synthétique de création client, de lecture, d'insertion ou d'upsert dans GET/POST renvoie son message dans `details`. Dix échecs ciblés. Correction : conserver les erreurs publiques fixes et leurs statuts, supprimer les diagnostics internes des réponses ; aucun nouveau log sensible.
- **T06-FINAL-02 — destinations dupliquées** : POST avec `['youtube','x','youtube','x']` persistait quatre entrées. Correction : déduplication par identité dans le schéma existant, ordre de première sélection conservé. Aucune nouvelle plateforme ou publication.

**Avant : 23 tests, 12 PASS / 11 FAIL / 0 SKIP. Après : 23 PASS / 0 FAIL / 0 SKIP.** Le rouge est conservé. Le banc vérifie également utilisateurs distincts, sessions absentes/expirées/révoquées, impossibilité de choisir `user_id`, défauts désactivés, conservation de la configuration existante et rejet d'entrées invalides. Il réutilise le vrai contrôle d'accès et remplace la DB par un mock.

Commandes réellement exécutées :

```sh
python3 qa/t06-final-integration-20261015/run.py before
python3 qa/t06-final-integration-20261015/run.py gate
```

`before-results.json` / `gate-results.json` contiennent les argv exacts, logs associés et codes de sortie. La gate fait les 23 tests, **TypeScript ciblé et ESLint sans warning : PASS**. Environnement enfant limité, garde réseau et interdiction de lecture `.env*` existantes. Aucun secret, appel fournisseur ou calcul IA. Aucun test OAuth/publication invariant ni build global relancé.

## Couverture et limites

| Risque | Verdict et preuve |
| --- | --- |
| Connexion/callback/liste de comptes | PASS mocks : neuf plateformes OAuth, refus des plateformes indisponibles, projection sans tokens, isolation utilisateur. |
| State aléatoire, usage unique, expiration | PASS code+contrats : 32 octets aléatoires, secret navigateur distinct, cookie HttpOnly/Secure/SameSite, TTL600s, suppression atomique ; session/utilisateur/profil et courses vérifiés. |
| Organisation | PASS pour le contrat local UUID utilisateur → profil Zernio unique, refus profil absent/réaffecté ; organisation distante et appartenance réelle NON TESTÉES. Aucun champ organization_id natif inventé. |
| Tokens/scopes | PASS absence de stockage des tokens de plateforme dans le parcours actuel, effacement legacy, erreurs expurgées après delta ; demande `posting` uniquement. Chiffrement/rotation internes Zernio et permissions effectivement accordées NON TESTÉS. |
| Révocation/reconnexion | PASS mocks+PG : révocation locale avant appel distant, un DELETE, barrière si résultat incertain, nouveau consentement obligatoire, historique transactionnel. Aucun succès distant inventé. |
| Comptes absents/expirés/révoqués | PASS : destination explicite non envoyée, médias non vérifiés et approbation absente refusés. |
| Déduplication/idempotence | PASS : plateforme/compte et occurrence, journal durable, même clé/corps après réponse perdue, réconciliation GET ; aucun nouveau POST aveugle. Nouveau POST social/autopilot normalise aussi les doublons. |
| Partiel/reprise | PASS : état `partially_published`, résultats de chaque compte conservés, succès antérieur jamais republié, reprise limitée au compte admissible. |
| IANA/DST/récurrences | PASS CI `node scripts/test-auto-schedule.mjs` : quotidien, hebdomadaire, biweekly=14jours, mensuel au premier jour de semaine sélectionné ; Paris gap/fold, Lord_Howe demi-heure, Kiritimati et limites d'occurrence. |
| Absence de publication prématurée | PASS : échéance future, date invalide et horaire dépassé après réponse perdue refusés, jamais de repli publishNow. Tests réseau extérieur interdit. |
| Configuration automatique | PASS API auto/config existante et nouveau banc social/autopilot après delta. FAIL contrat UI ci-dessous, transmis au propriétaire. |

### Frontière T07 : configuration masquée au rechargement

Source cb3 : GET `/api/social/accounts` renvoie seulement `{accounts}`. `settings/social/page.tsx` lit pourtant `data.autopilot`, sinon DEFAULT_AUTOPILOT (disabled/[]), sans GET `/api/social/autopilot`. Ce dernier conserve pourtant `{enabled:true,default_platforms:['youtube']}` (cas positif du nouveau banc). Recharger fait donc afficher un faux défaut ; enregistrer peut perdre la préférence. **Défaut de contrat démontré par lecture des ports et mock API ; reproduction navigateur/correction NON TESTÉES par T06, transmises T07/T01 avant édition.** Ne pas masquer une erreur de chargement par une configuration par défaut. Aucun fichier UI modifié.

## GitNexus et clôture

Impact avant édition : GET **CRITICAL461**,229 appelants et2 processus, avec association étrangère Lottery ; POST **UNKNOWN**. Index stale d'un commit et déjà partiel. Alerte communiquée ; `impact-get.json`/`impact-post.json` conservés. Recherche directe : route HTTP consommée par settings/social, plus nouveau banc. Aucun helper de sécurité T02, page T07, route auto/config T01, SQL ou configuration modifié. `detect_changes` exécuté avant commit ; ses limites ne sont pas présentées comme une certification exhaustive. Voir reçu de clôture et handoff.

**BLOQUÉ externe** : intégration du nouveau delta par T01 et traitement du défaut UI par T07/T01. **NON TESTÉ** : build du nouveau delta intégré (gate finale propriétaire T01), OAuth réel, chiffrement/rotation du fournisseur, grants effectifs, révocation distante réelle, cron déployé, chaîne navigateur→DB→fournisseur réelle et publication publique. Les gates exactes de cb3 ne certifient pas automatiquement notre nouveau delta. L'absence de consentement personnel n'est pas un bug logiciel.

Parcours personnel : `PARCOURS-MATISS.md`. Aucune nouvelle clé requise, aucune publication d'essai demandée.

Clôture locale : Gitleaks du patch stagé **PASS, zéro finding**, syntaxe Python et diff-check **PASS**. Le TAP rouge brut reste dans before-autopilot.log.gz ; copie texte normalisée uniquement en fin de ligne, empreintes dans log-normalization.json. detect_changes exécuté :17fichiers/6symboles/363flux, **CRITICAL**, associations étrangères et index stale ; exhaustivité **UNKNOWN**. Aucune certification globale du graphe. Reçu closure.json.

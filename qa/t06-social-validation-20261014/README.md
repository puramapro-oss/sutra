# T06 — OAuth, autorisation de publication et reprise

Base réelle T01 : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140`, vérifiée le 14 octobre 2026. Le lot antérieur `c562b78` est intégré. Branche isolée `codex/sutra-t06-social-validation-20261014`. Les anciens bilans fournisseurs ne sont pas réutilisés comme état courant.

## Défaut corrigé

**T06-VALIDATION-01** : un compte local `connected` pouvait encore envoyer, rejouer ou retenter une publication après suppression/réaffectation de son binding Zernio. Le journal ne comparait pas le profil serveur actuel avec la provenance du compte ; il ignorait aussi un marqueur de révocation en attente si le statut local était incohérent.

Reproduction avant correction : **14 FAIL / 4 PASS**, `before.log` et `before.json`. Correction dans **un seul fichier produit**, `src/lib/publication-journal.ts` : à chaque autorisation avant et après réservation durable, relire le binding serveur, exiger `credential_owner=zernio` et le même `zernio_profile_id`, refuser une révocation en attente. Le profil Zernio est la frontière de tenant du contrat existant ; ce lot n'invente pas un nouveau modèle d'organisation.

Après correction : **18/18 PASS**. Les créations, replays et retries refusés ne font aucun POST simulé supplémentaire. Le chemin automatique partage le contrôle. La réconciliation GET et l'historique restent accessibles ; un consentement frais correspondant au profil actuel permet un seul envoi. Deux tests exercent le vrai sérialiseur Supabase pour les prédicats CAS NULL/JSONB, avec transport simulé.

## Tests et limites de preuve

Gate ciblée finale sous **Node 24.21.0 existant**, sans installation :

```sh
SUTRA_QA_NODE_BINARY=/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node node qa/t06-social-validation-20261014/run.mjs
```

Les commandes développées, codes et compteurs figurent dans `results.json` et `verification.json`.

| Contrôle | Résultat | Preuve |
|---|---|---|
| Nouveau binding + CAS transport simulé | PASS 18 | `delta.log` |
| OAuth final, autonomie et publication | PASS 112 | `regressions.log` |
| Routes sociales, révocation, rapprochement | PASS 9 | `routes.log` |
| Consommateurs publication existants | PASS 6 | `consumers.log` |
| Concurrence : 32 journaux, 64 destinations, aucun doublon | PASS 1 | `load.log` |
| TypeScript ciblé + lint des fichiers modifiés | PASS | `typecheck.log`, `lint.log` |
| IANA, changements d'heure et récurrences | PASS réutilisé, fichiers identiques | `reused-proof.json` |
| Parcours indépendant T08 sur fixture historique | FAIL fixture : 4 PASS / 4 FAIL | `journey.log`, propriétaire T08 |
| Consentement, refresh/révocation de jetons et publication réels | NON TESTÉ | Aucun appel fournisseur ni compte connecté |
| Campagne intégrée/build du nouveau candidat | NON TESTÉ par T06 | T01 seul, aucun build global répété |

**146 tests distincts PASS, zéro échec et zéro skip dans le lot réservé.** Ne pas additionner les preuves historiques ni le parcours T08 à ce total. La gate par défaut exclut explicitement le parcours indépendant T08 ; son diagnostic reste reproductible par l'argument `journey`.

Les 112 régressions couvrent state à usage unique et TTL de dix minutes, session/utilisateur/profil/navigateur, refus OAuth, callbacks concurrents, révocation et reconnexion, comptes absents/expirés/déconnectés, contrôle des médias vérifiés, réponses perdues, idempotence, succès partiel, reprise du seul compte échoué et maintien d'un résultat distant incertain. Les jetons fournisseur ne sont pas persistés dans SUTRA ; `scopes=posting` est conservé. Leur rotation effective chez Zernio n'est pas prouvée par une simulation.

Le code IANA et son test n'ont pas changé : Paris (gap/fold), Lord Howe (demi-heure), Kiritimati, cadence hebdomadaire/bimensuelle/mensuelle, HH:mm et IANA invalides, fenêtres `(début, fin]`, identité d'occurrence. Égalité SHA256 des sources, tests, dépendances et runner avec le manifeste intégré de `86d04c8`, CI `38508390596`. Cette réutilisation ne certifie pas le nouveau build. L'activation d'un ordonnanceur réel reste hors de ce lot, chez T01.

## Fixtures partagées et dépendance T08

`socialDatabase(userId)` conserve son paramètre par défaut pour les autres consommateurs et fournit une provenance synthétique. Les tests sociaux réservés utilisent désormais un UUID valide et son binding synthétique. Aucun contrôle ni assertion de sécurité n'a été retiré.

- ACK T08 du 14 octobre 14:13 UTC : adaptation limitée à `qa/t08/integrated/load.test.mts`. Avant : 1 FAIL ; après : 1 PASS. Les 64 destinations et assertions de concurrence/replay sont inchangées.
- ACK T01 du 14 octobre 14:16 UTC : helper `publicationDatabase` et six scénarios PUBLICATION dans `scripts/test-release-regressions.mts`. Avant : 3 PASS / 3 FAIL ; après : 6 PASS. Le reste du fichier est intact.
- T08 réserve et adapte séparément `scripts/test-t08-integration-journey.mts` et `qa/t08-integration-journey-20261014/database.mts`. La fixture historique utilise `user=u`, refusé par le binding UUID strict. T01 doit intégrer ensemble ces adaptations et ce correctif, puis T08 retester le candidat. Aucun WIP T08 copié dans ce lot.

Le premier essai du parcours sous Node26 échouait avant publication avec `SUTRA_PUBLICATION_CONFIG_UNAVAILABLE` : mock du paquet Supabase non appliqué, erreur de harnais conservée dans `journey-runner-before.log`. Le runtime Node24 et les options T08 rétablissent la frontière simulée ; les quatre FAIL restants sont les identités de fixture invalides. Ils ne sont ni masqués ni comptés PASS.

## Sécurité, GitNexus et frontières

Secrets : aucune lecture/copie de `~/.env.purama.master` ni de `.env*`. Les variables enfant viennent exclusivement de constantes synthétiques dans `run.mjs`, avec une liste limitée de variables système. Le preload `qa/t08/offline.cjs` refuse le réseau externe et la lecture des `.env*`. Pas d'achat, GPU, IA sur Mac, publication, connexion de compte, migration, changement distant, push, fusion ou déploiement.

Impacts préalables : `runPublicationJournal` **HIGH**, deux appelants directs (manuel/automatique), sept symboles, un groupe de parcours ; risque annoncé avant modification. Fixture partagée MEDIUM, helper de test LOW. Le fichier load a un impact UNKNOWN : usages et diff revus directement, aucun raisonnement « non utilisé ». Index isolé, sans embeddings, explicitement partiel ; `gitnexus-*.log` et `impact-*.txt` conservent les limites. Analyse des changements avant commit dans `detect-changes.txt` : **CRITICAL**, 44 fichiers alors indexés dans le diff, 69 symboles, 366 parcours remontés. Alerte communiquée avant commit. Le graphe partiel et les symboles génériques `invoke` empêchent de qualifier cette portée exhaustive ; revue du diff et des deux consommateurs produit directs, preuves ciblées uniquement. Aucun fichier produit hors publication-journal n’est changé. Contrôle des secrets expurgé (`gitleaks.json`, zéro résultat) et diff-check PASS.

Le contrôle n'annule pas une requête déjà acceptée par un fournisseur. Une révocation ambiguë conserve sa barrière, l'historique et l'absence de nouvelle tentative aveugle ; seul T01 peut réconcilier le résultat distant et les bindings. L'ancien compte sans provenance exige un nouveau consentement, jamais une fausse metadata ajoutée automatiquement. T02 est informé du contrôle d'autorisation ; T07 du diagnostic `SUTRA_SOCIAL_PROFILE_RECONNECTION_REQUIRED`. Aucun fichier de ces propriétaires n'est modifié.

## Parcours exact de Matiss

1. Ouvrir [SUTRA](https://sutra.purama.dev/login), se connecter et lire/accepter personnellement les conditions si elles sont demandées. Ouvrir ensuite [Réglages sociaux](https://sutra.purama.dev/settings/social).
2. Cliquer **Se connecter**, ou **Se reconnecter** pour un compte existant, seulement sur les réseaux voulus : TikTok, YouTube, Instagram, Facebook, X, LinkedIn, Pinterest, Reddit, Threads. Les connexions indisponibles ne sont pas contournées.
3. Dans l'écran hébergé, choisir le compte et, si proposé, la chaîne YouTube, Page Facebook, destination personnelle/organisation LinkedIn ou tableau Pinterest. Vérifier la bonne identité et les permissions avant accord. Le contrat demande `posting` ; les permissions d'identité, de liste et de renouvellement nécessaires sont affichées par le fournisseur. [Guide officiel Zernio](https://docs.zernio.com/guides/connecting-accounts).
4. Revenir dans la même session et le même navigateur sous dix minutes. Vérifier **Connecte** et l'identité affichée. Après refus ou expiration, repartir du bouton de connexion avec un nouvel état.
5. Si « Profil social non attribué » ou « Déconnexion en cours de vérification » apparaît, T01 traite le binding ou le résultat distant. Aucune nouvelle clé n'est demandée par ce lot. Ne pas activer la publication pour cette vérification. Si une offre ou un paiement est demandé, arrêter sans achat.

**Actions utilisateur minimales restantes : consentement légal si demandé, puis consentement aux comptes souhaités.** L'absence de consentement n'est pas un défaut logiciel. Le test d'une publication réelle nécessitera une autorisation distincte ; aucun consentement n'a été donné à la place de Matiss.

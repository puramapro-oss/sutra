# T06 — social final, 15 octobre 2026

Branche `codex/sutra-t06-final-social-20261015`, worktree isolé, base T01 `49c166d4c15412d2a3c1246c216cf0df319f2df0` (reçu documentaire après le produit testé `3855665fa79e3cc2171124d864a834214d6ac617`). Ancien lot T06 `74655b1` intégré et préservé. Réservations nominatives dans les deux LOCKS avant édition. T01 conserve SQL/config/bindings/intégration, T02 private-media, T07 interface.

**Quatre défauts corrigés localement ; historique des autorisations FAIL, correction BLOQUÉE sur le contrat SQL T01.** Aucun appel fournisseur réel, secret, consentement personnel, achat, publication, calcul IA/GPU, migration distante, push, fusion ou déploiement. Aucun build global répété.

## Défauts, causes et corrections

| Défaut | Reproduction | Correction vérifiée |
|---|---|---|
| Callback accepte un profil retiré/réaffecté pendant le GET d'identité | Changer le binding synthétique pendant la réponse ; compte enregistré malgré l'autorité périmée | Relire `getAuthorizedProfileId` après l'attente ; refuser sans compte enregistré, state déjà consommé. Deux cas PASS. |
| Révocation envoie DELETE avec un compte hors autorité actuelle | Binding absent/invalide/réaffecté, provenance absente/étrangère, modification pendant le CAS | Contrôler binding et provenance après la réservation locale ; aucun DELETE hors autorité. Barrière locale maintenue, résultat distant non confirmé. Sept cas PASS. |
| Répétition d'une révocation confirmée renvoie DELETE | Deux requêtes séquentielles après succès | Retour confirmé sans seconde requête distante ni nouvelle révision. PASS. |
| Champs d'anciens tokens conservés après révocation | Ancienne ligne avec access/refresh/expiration synthétiques | Effacer les trois colonnes dans le CAS avant DELETE ; nettoyer aussi les états déjà confirmés ou en attente, sans répéter DELETE. Trois cas PASS. |

Les deux autres tests du nouveau groupe vérifient connexion→révocation→reconnexion et refus HTTP403 sans répétition. Le compte historique et les résultats de publication sont conservés. Le contrat distant booléen ne permet pas de distinguer tous les refus des résultats incertains : HTTP202 et barrière restent conservateurs. Un compte sans provenance ne reçoit jamais une fausse provenance automatiquement.

Preuves rouges conservées : `red-delta.log` contient **10 FAIL/1 PASS bruts**, dont neuf échecs produit et **un défaut du banc** (mock canonique sans projection SELECT, qui ne démontre aucune fuite produit). Cette assertion de banc a été retirée ; la projection reste couverte par les tests T02 existants. `red-idempotence.log` et `red-legacy-credentials.log` isolent les défauts suivants. Aucun échec de banc n'est compté comme nouveau défaut logiciel. Les assertions des fixtures historiques sont conservées ; seuls le mock du binding, la provenance synthétique de trois tests PG et les colonnes de la table jetable ont été adaptés.

## Commandes et résultats exacts

Runtime réutilisé : Node **24.21.0**, `/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node`. Les reçus `results-*.json` conservent les arguments développés et codes retour.

```sh
node24 qa/t06-final-social-20261015/run.mjs delta oauth-regressions security-consumers revocation-consumer typecheck lint
node24 qa/t06-final-social-20261015/run-postgres.mjs
node24 qa/t06-final-social-20261015/run.mjs history-contract
```

`node24` désigne le binaire absolu ci-dessus, sans installation. Les phases ont été exécutées par groupes ciblés ; ne pas rejouer les PASS inchangés. La dernière commande **retourne 1**, elle expose volontairement l'exigence non satisfaite et n'appartient pas à la gate verte du correctif.

| Contrôle | Statut | Preuve |
|---|---|---|
| Nouveau delta OAuth/révocation | PASS 15 | `delta.log` |
| Neuf plateformes, state, erreurs, courses, partiel et reprise | PASS 47 | `oauth-regressions.log` |
| Consommateurs sécurité T02/T08 et routes | PASS 30 | `security-consumers.log` |
| Consommateur autonomie après révocation | PASS 1 | `revocation-consumer.log` |
| CAS PostgreSQL18 isolé, concurrence 24 sessions | PASS 7 | `postgres.log`, `postgres-result.json` |
| TypeScript ciblé et lint, y compris le test d'historique | PASS | `results-history-contract-typecheck-lint.json` |
| Conservation des autorisations précédentes | **FAIL 1** | `history-contract.log` |
| Correction atomique de l'historique | **BLOQUÉ — SQL T01** | contrat ci-dessous et miroir coordinateur |
| Build/campagne sur le nouveau candidat intégré | **NON TESTÉ par T06** | campagne unique T01/T08 après intégration |

Total des commandes exécutées : **100 PASS, 1 FAIL, 0 SKIP**. Ne pas additionner les anciens passages rouges, les recouvrements fonctionnels ou la CI historique. Le cluster PG privé loopback a été arrêté et conservé. Le transport PostgREST réel reste NON TESTÉ ; la fixture PG exerce les prédicats CAS sur PostgreSQL réel sans migration partagée.

Provenance : variables de tests uniquement constantes synthétiques des runners, plus une liste limitée de variables système. `qa/t08/offline.cjs` bloque sockets externes et lecture des `.env*`. `~/.env.purama.master` n'a été ni lu, ni copié, ni modifié. Aucun besoin de nouvelle clé.

## Exigences maintenues et limites

- **PASS local** : state CSPRNG 32 octets, secret navigateur indépendant HttpOnly/Secure/SameSite, TTL600s, suppression atomique à usage unique ; session vérifiée, user, plateforme, profil et révision liés. Refus, erreur, expiration et callback concurrent ne permettent aucun replay.
- **PASS local** : callback lié au profil serveur ; le client ne peut choisir son organisation. Le modèle courant utilise un profil Zernio par utilisateur comme frontière. Cela ne prouve pas une ACL d'organisation distincte ni les bindings réels, réservés à T01.
- **PASS local** : demande `scopes=posting`, contrôle d'identité distant simulé, aucune persistance de tokens Zernio dans les nouvelles connexions, réponses publiques expurgées, purge des colonnes historiques à la révocation. **NON TESTÉ** : permissions réellement accordées, rotation/refresh/révocation chez les plateformes, configuration du compte fournisseur.
- **PASS réutilisé** : IANA/DST et récurrences, par égalité SHA256 de 26 fichiers pertinents dans `reused-proof.json` avec la CI T01 [38598361267](https://github.com/puramapro-oss/sutra/actions/runs/38598361267). Paris été/hiver, gap/fold, Lord Howe 30 minutes, Kiritimati, entrées invalides et fenêtres `(début, fin]`. Quotidien, hebdomadaire, **toutes les deux semaines** (`biweekly`, pas deux fois par mois), mensuel au premier jour sélectionné du mois. Pas de modification de ces règles.
- **PASS local + preuve intégrée inchangée** : déduplication des occurrences/destinations, compte absent, partiel, reprise du seul compte échoué, clés/intention persistées avant POST, GET de rapprochement après issue incertaine, refus média non vérifié ou consentement absent. Les contrôles avant/après claim du journal demeurent identiques. Un résultat incertain ne devient pas un succès et ne déclenche aucun nouvel envoi aveugle.
- **NON TESTÉ** : publication publique, ordonnanceur effectif, réseau tiers, navigateur avec consentement réel, révocation instantanée d'une requête déjà partie. Les preuves UI/build de3855665 ne certifient pas ce nouveau delta. Pas de garantie exhaustive.

## T06-HISTORY-01 — demande au propriétaire SQL

Repro indépendante : connexion → révocation confirmée → reconnexion ; le premier `sutra_oauth_revision` n'est plus dans le stockage simulé, les states ont été consommés et seule la ligne courante subsiste. La lecture des routes et des SQL canoniques retrouve le trigger de timestamp, aucun journal des changements d'autorisation. C'est un **défaut logiciel**, distinct de l'absence de consentement de Matiss. La présence éventuelle d'un mécanisme distant non versionné n'a pas été testée.

T01 doit fournir un contrat de **mutation du compte + événement durable dans la même transaction**, éventuellement via un trigger canonique, avec CAS et rollback commun. Événements connexion/reconnexion/révocation demandée/confirmée/incertaine, horodatage serveur, user/compte/plateforme/profil vérifiés, révision/operation unique pour la déduplication. Distinguer les scopes demandés des grants attestés. Aucun token, state brut, session_id, clé ou erreur brute. Conservation des événements après reconnexion ; ACL/RLS de lecture et écriture à qualifier avec T02. Le helper activity_logs best-effort ne suffit pas. Ne pas empiler sans limite dans metadata, utilisée dans les filtres URL du CAS.

Le contrat et le test rouge ont été transmis dans `.coord/handoffs/SUTRA-20261012/T06-FINAL-SOCIAL-20261015.md`. T06 n'a modifié aucun SQL ni créé un second modèle d'organisation. Une solution SQL par trigger nécessitera une preuve PostgreSQL dédiée ; le seul mock de routes ne peut pas valider un trigger.

## Parcours personnel de Matiss

Parcours vérifié dans le code candidat ; **attendre la réception/qualification T01**, sans supposer les corrections déjà en production.

1. Se connecter à [SUTRA](https://sutra.purama.dev/login), lire et accepter personnellement les conditions si demandées, puis ouvrir [Réglages sociaux](https://sutra.purama.dev/settings/social).
2. Cliquer **Se connecter** ou **Se reconnecter** pour les réseaux souhaités : TikTok, YouTube, Instagram, Facebook, X, LinkedIn, Pinterest, Reddit ou Threads. Les cartes Snapchat, Tumblr, Mastodon, Bluesky et Vimeo restent **Connexion indisponible**.
3. Dans le parcours hébergé, sélectionner le bon compte et la destination proposée (chaîne YouTube, Page Facebook, profil/organisation LinkedIn ou tableau Pinterest selon la plateforme). Lire les permissions avant de consentir. SUTRA demande `posting` ; cela n'atteste pas à lui seul les grants réellement accordés. [Guide officiel Zernio](https://docs.zernio.com/guides/connecting-accounts).
4. Revenir dans **le même navigateur et la même session sous dix minutes**. Vérifier le statut et l'identité du compte. Après refus/expiration, repartir du bouton avec un nouvel état. Aucun lien périmé à réutiliser.
5. Pour déconnecter, utiliser **Déconnecter**, puis confirmer **Déconnecter**. Un résultat non confirmé reste signalé ; ne pas répéter la demande ni contourner la barrière. « Profil social non attribué » exige le binding T01 ; « Déconnexion en cours de vérification » exige sa réconciliation. Aucune nouvelle clé n'est requise sur cette seule base.

Actions personnelles minimales : consentement légal si demandé, choix des comptes et consentements correspondants. Ne pas activer la publication automatique pour cette vérification. Toute offre/paiement demandé est hors autorisation. Aucun compte n'a été connecté ou autorisé à la place de Matiss.

## GitNexus et réception

Index privé sans modèle/embeddings : 19 036 nœuds, 36 789 liens, 364 flux. Couverture **partielle** : entrées/callees non classés et coupes de parcours ; exhaustivité UNKNOWN. Impacts préalables : callback Next GET UNKNOWN/0 appelant résolu (route réelle lue/testée), `revokeSocialAccount` LOW/deux appelants indexés, fixture UNKNOWN complétée par revue directe. Les usages directs OAuth, route DELETE, autonomie et fixture PG ont été couverts. Aucun symbole tiers modifié.

Analyse des changements, scan secrets expurgé et empreintes du delta sont archivés avec ce dossier. T01 devra ajouter `scripts/test-t06-final-social.mts` au runner CI qu'il possède ; le test rouge d'historique doit devenir vert sur le contrat retenu, sans être masqué dans les PASS. T02 conserve son correctif capability et T07 l'interface. Réception intégrée et recette T08 restent nécessaires.


Contrôles de clôture : `detect-changes --scope staged --repo <worktree> --limit 2000` :24fichiers indexés,19symboles,deux flux, risque **MEDIUM**. Comparaison demandée `--scope compare --base-ref main` :2684fichiers historiques,7984symboles,229flux, **CRITICAL**, liste plafonnée et graphe partiel ; alerte communiquée avant commit. Cette comparaison ne représente pas le seul delta T06. Revue manuelle des deux fichiers produit et tests de leurs consommateurs effectués. Les nouveaux tests non présents dans l'index initial sont revus par diff, typecheck et lint, sans prétention de couverture exhaustive. Logs de preuve conservés malgré l'ignore global `*.log` ; espaces de fin de ligne normalisés seulement.

Le scan complet des logs a signalé deux dumps JSON de comptes **synthétiques**, champs tokens null et révision UUID aléatoire. Dumps expurgés, diagnostic et FAIL préservés ; aucune règle désactivée. Rapport initial expurgé `gitleaks-before-redaction.json`, traçabilité `log-redaction.json`.

Dernière analyse staged après ajout des preuves :47fichiers,19symboles,deux flux, **MEDIUM** (`detect-final-staged.log`), sans nouveau symbole produit. Scan final expurgé :zéro fuite ; `git diff --cached --check` PASS.

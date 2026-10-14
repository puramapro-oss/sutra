# Recette finale T01 — plan sans exécution

Propriétaire : T01. Point de départ : candidat intégrant les livraisons T02–T08 par chemins contrôlés, après contrat T04. Aucune commande de déploiement/activation/provisioning/achat/publication ici. Ce plan n'autorise aucune dépense. Les tests doivent garder des transports fermés et des identités synthétiques sur environnement local jetable.

## Préconditions et preuve commune

1. Figer SHA40 candidat, LOCKS, SHAs/handoffs livrés et état Git ; préserver les WIP. Examiner les diffs depuis1461733 puis depuis chaque preuve propriétaire. Le commit configuration57e4042 ne livre pas l'adaptateur Salad.
2. Récupérer le contrat réel T04 : GET authentifié `/api/video/capabilities`, schéma/version, code du mode désactivé, choix owner/client, journal durable/intention, identifiant worker, réconciliation, preuve média. Aucun export ou champ à inventer ; un contrat absent reste BLOQUE.
3. Importer uniquement les tests T08 et leur runner/config, puis adapter leurs imports/assertions au contrat réel si celui-ci diffère. Ne pas remplacer le worker par un algorithme de routage réimplémenté. MODE-03 corrigé sur42b03ba : quatre tests PASS déjà reçus ; ne les rejouer que pour le nouveau delta Salad/candidat. Les assertions session/route et compteurs de transports restent indispensables.
4. Vérifier environnement synthétique, garde `qa/t08/offline.cjs`, dépendances exactes. Aucun chargement du maître ou `.env.local` pour ces tests. Désactiver les sorties réseau fournisseurs/publication ; aucune utilisation de `/api/health` comme smoke gratuit.

## Quatre scénarios T08 à rejouer sur le candidat

| Cas | Action locale contrôlée | Résultat attendu / preuve à conserver |
| --- | --- | --- |
| Client interdit owner | Session cliente + identité owner forgée dans corps/header + demande du mode propriétaire selon schéma final ; GET capabilities sous client et sans session. | Identité serveur autoritative, capacité owner inaccessible ; refus stable si demande explicite ; zéro appel worker. Enregistrer status/codes expurgés et compteurs. |
| API cliente normale | Session cliente, demande API valide ; fixtures worker désactivé, actif, indisponible. | API explicite reste disponible selon plan/quotas ; zéro routage vers worker owner. Aucun health global bloquant artificiellement les clients. |
| Salad désactivé | Session owner, flag Salad désactivé ou configuration absente ; capabilities et création réelles. | Indisponibilité explicite et sûre, zéro POST worker ni API ; UI indique indisponible/inconnu et conserve le projet. MODE-03 doit devenir vert avec un code métier stable. |
| Aucun repli payant | Session owner, worker configuré fixture : HTTP503, timeout avant réception et état ambigu. | Aucun RunPod/WAN/LTX/Shotstack implicite ; échec/unknown/reconcile explicite. T08 vérifie frontière, T03 fournit la preuve durable sans double POST. |

Commande cible actuelle : `node qa/t08-final-modes/run.mjs`. Résultat attendu après intégration : modes4/4, typecheck/lint ciblés0erreur. En cas d'évolution du contrat, consigner le diff du test et la raison, jamais retirer une exigence pour verdir la suite. Archiver SHA produit/test et hashes des fichiers exacts exécutés.

## Réutiliser les preuves propriétaires

| Propriétaire | Vérification de livraison ; ne rejouer que delta affecté |
| --- | --- |
| T02 | Auth worker serveur, propriétaire seul, HTTPS/SSRF/redirections, isolation job/stockage, erreurs et secrets ; ne pas exposer le serveur loopback historique comme worker distant. |
| T03 | Persister intention avant POST, réception incertaine, GET de réconciliation, lease expirée/CAS, concurrence, reprise checkpoints sans second POST/fallback. Une fixture mémoire ne prouve pas persistance production. |
| T04 | Raccord réel route/dispatch/worker, auth, capabilities, journal durable existant, pas d'activation. Vérifier que les mêmes exports sont ceux testés par T02/T03/T05/T08. |
| T05 | Réel décodage synthétique, tailles/audio/aspect/subtitles, provenance du média final. Fermer T05-MEDIA-01 : mêmes octets source sous autre URL refusés comme montage final requis. |
| T06 | Consentements, state/callback/cookie, révocation, reprise sociale sans doublon ; corriger la reconnexion UI après revoked et rejouer son contre-test. |
| T07 | UI responsive/clavier/axe ciblée du parcours modes ; aucun client présenté comme owner, disabled/unknown explicites, aucun budget inventé ; vérifier son correctif contraste. |

## Parcours continu final, puis une seule gate d'intégration

Sur instance locale isolée et DB jetable, préparer un utilisateur client et un propriétaire synthétiques. Exécuter connexion → création → quota/budget exposé réel → génération simulée → checkpoints/reprise → montage/export sur médias synthétiques → validation → planification → publication simulée. Réutiliser les fixtures et scripts déjà livrés, sans nouvelle implémentation parallèle. Prélever identité job, statut, checksum média, occurrence, journal par destination et compteurs de soumissions ; ne conserver aucune valeur sensible. Les exigences budget absentes ou non branchées restent NON TESTE/BLOQUE, pas équivalentes au quota.

Après collecte et correction de tous les FAIL requis, T01 seul lance la gate globale appropriée **une fois sur son candidat exact** et réutilise les contrôles inchangés. Les suites historiques partagent des cas ; ne pas additionner les nombres. Aucune CI globale avant candidat. Le snapshot e3b1711 vert ne certifie pas les nouveaux raccords.

La release Salad reste BLOQUE si le contrat réel, la persistance, la validation média ou un contre-test requis manque. La qualification GPU/réseau réel reste NON TESTE sans essai réel séparément autorisé ; ne jamais la déduire de health200, capabilities, mocks ou d'une CI verte. Un futur test payant ou un déploiement demande une autorisation distincte ; ne rien lancer au titre de ce plan.

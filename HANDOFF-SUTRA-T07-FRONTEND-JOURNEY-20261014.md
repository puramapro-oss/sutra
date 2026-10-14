# Handoff SUTRA T07 — frontend, parcours finaux du 14 octobre 2026

Branche : `codex/sutra-t07-frontend-journey-20261014`.
Worktree : `/Users/matissdornier/purama-worktrees/sutra-t07-frontend-journey-20261014`.
Base T01 vérifiée : `e09fdaeafbf1ec8554a7b689fe3c44dd696d0140` ; correctifs antérieurs T07 `654ae42a587d9934dbb29a63ec75eeec19062d72` déjà identiques. SHA livré enregistré après commit dans `.coord/handoffs/SUTRA-20261012/T07-FRONTEND-JOURNEY-20261014.md` du dépôt de coordination.

## Défauts corrigés

- Consentement : lien mentions HTTP404 → route canonique200 ; modal natif, Tab/Shift+Tab/Escape et restauration focus/scroll ; contraste des trois thèmes ; requête pendante bornée à10s avec erreur/réessai sans avancer le document.
- Lecteur : failed/draft/ready sans média distingués, contrôles sans effet désactivés ; résultat non validé explicitement signalé.
- Téléchargement existant : contrôle ready/published + reçu URL/SHA exact ; redirection privée307 gérée par Blob, contrôle MIME/non-vide et SHA des octets reçus ; erreur expurgée, réessai, déduplication et délai30s. Aucun export/rendu de secours. Le premier lien natif échouait à deux largeurs ; reproduction conservée.

## Fichiers

Produit uniquement :

- `src/lib/legal/components/LegalReacceptanceGate.tsx`
- `src/components/legal/LegalReacceptanceGateMount.tsx`
- `src/components/editor/VideoPlayerPanel.tsx`

Preuves/tests/captures : `qa/t07-frontend-journey-20261014/**`. Documentation : ce handoff et append auteur dans `BATON.md`, `task_plan.md`, `ERRORS.md`. Aucun service backend, version légale, droit, config, compte ou autre propriétaire modifié.

## Résultats exacts

**PASS local : 61 assertions distinctes, 0 FAIL final**, réconciliées par nom dans `final-assertions.json` avec lien vers chaque résultat brut. Campagnes finales : consentement15/15 ; parcours30PASS/4FAIL de banc puis reprise ciblée6/6 ; visuel6/6 ; téléchargement privé9/9 ; régression lecteur18/18 ; visuel téléchargement4/4. Les setups et assertions rejouées ne sont pas additionnés. Commandes exactes, empreintes produit/dépendances et codes retour dans `verification.json`/README.

TypeScript et lint ciblé : exit0. Diff-check : exit0. Scan produit/docs exit0 ; scan QA brut six UUID synthétiques, tous classés non secrets avec six fingerprints précis, scan revu exit0. GitNexus précommit :17 symboles attendus,0 flux résolu, LOW ; preuves finales dans le même dossier. Ne pas qualifier le graphe d'exhaustif : index tronqué, lecteur LOW/1 appelant EditorPage/0 flux ; consentement UNKNOWN, chaîne DashboardLayout→Mount→Gate revue directement.

**FAIL historiques conservés** : consentement9 ; lecteur failed2 ; lien natif après307 deux ; attentes/transport/TLS du banc séparés. Le typecheck concurrent au démarrage Next a échoué TS6053 sur fichiers générés ; même commande après arrêt du seul serveur auteur PASS. Aucun défaut masqué par un skip.

**Mesure** : même réponse légale suspendue17s, avant encore bloqué après12s, après erreur réessayable à10895ms. Pas de performance de production inférée des compilations dev. Ancienne mesure bibliothèque6GET→0GET,452ms→27,5ms réutilisée seulement sur source identique.

**BLOQUÉ** : aucun blocage externe pour ce lot local ; intégration et campagne finale du candidat restent à T01. Aucune fusion effectuée.

**NON TESTÉ** : Safari/Firefox/appareil physique/lecteur d'écran ; gros fichiers et mémoire Blob ; CORS/stockage réels ; performance du build de production ; fournisseurs, paiement, génération, export/rendu et publication réels, OAuth distant. L'inaccessibilité CORS produit une erreur visible, sans opération payante de secours. Aucun consentement Matiss/PURAMA enregistré.

## Parcours et remise T01

Identité `legal-test@example.invalid` exclusivement. `/login?next=/library` → refus cookies facultatifs → lecture des routes `/mentions-legales`, `/cgu`, `/cgv`, `/politique-confidentialite` puis quatre actions explicites `J'ai lu, je continue` via la vraie route locale `/api/legal/accept`. Pas d'injection d'acceptance ni contournement légal. Création/API, GPU distant désactivé, statut inconnu/reprise même intention, bibliothèque erreur/vide, export indisponible et `/settings/social` testés avec réponses simulées. Aucune connexion sociale réelle.

Captures utiles affichées : `after/legal-375.png`, `after/legal-1440.png`, `visual/player-*.png`, `visual/social-*.png`, `visual-download/player-*.png`. Captures pendant animation conservées séparément, non utilisées comme validation visuelle.

T01 : intégrer uniquement le commit gelé du miroir, préserver les autres deltas et append documentaires. Ne pas relancer ces preuves inchangées ; exécuter la campagne intégrée unique quand le candidat change. T07 n'a fait ni push, ni fusion, ni déploiement, ni appel fournisseur, ni lecture de secret. Aucune garantie « zéro bug ».

# T07 → T01 — UX/UI finale et performances, 15 octobre 2026

Branche `codex/sutra-t07-final-ux-perf-20261015`, worktree `/Users/matissdornier/purama-worktrees/sutra-t07-final-ux-perf-20261015`. Base T01 **49c166d4c15412d2a3c1246c216cf0df319f2df0** ; produit testé précédemment3855665. Le SHA de cette livraison est le commit contenant ce document, reporté explicitement dans le miroir de coordination après commit. Ne pas réutiliser un ancien bilan fournisseur. Aucun push/fusion/déploiement.

**À intégrer : neuf fichiers frontend seulement**, plus preuves et sections documentaires T07. Aucun fichier backend/config/OVH modifié. Réservations exactes `SUTRA-T07-20261015:FINAL-UX-PERF` dans les deux LOCKS ; fin d'écriture signalée après commit. Préserver tous les WIP d'intégration T01.

| Fichier | Delta |
|---|---|
| `src/app/(auth)/login/page.tsx` | Garde synchrone contre double soumission |
| `src/app/(auth)/signup/page.tsx` | Même garde, visibilité du mot de passe accessible au clavier |
| `src/app/(dashboard)/settings/social/page.tsx` | GET unique borné10s, erreur persistante, reprise, aucun faux zéro compte ; OAuth inchangé |
| `src/components/settings/social/DisconnectConfirmModal.tsx` | Modal existant réutilisé : nom, focus, confinement, Escape |
| `src/app/(dashboard)/auto/schedules/page.tsx` | GET/PATCH bornés/dédupliqués ; brouillon et ID conservés après échec/réponse perdue ; labels/contraste/fuseau |
| `src/app/(dashboard)/auto/layout.tsx` | Contraste du descriptif seulement |
| `src/hooks/useEditorHandlers.ts` | Historique des trois mutations de sous-titres ; export préservé |
| `src/hooks/useEditorHistory.ts` | Première édition après undo/redo enregistrée, branche future remplacée |
| `src/app/(dashboard)/editor/[id]/page.tsx` | Narration initiale identique dans le rendu et l'historique |

SHA256 exacts : `qa/t07-final-ux-perf-20261015/tested-source-manifest.json`. Dossier complet : [README](qa/t07-final-ux-perf-20261015/README.md), résultats bruts, scripts, captures, mesures avant/après, impacts et analyse GitNexus intégrale. BATON/task_plan/ERRORS : intégrer uniquement les sections finales T07, pas remplacer les documents communs.

**PASS local ciblé** : Chromium auth22, social10, planning9 ; delta final Chromium éditeur5/visuel3/navigation3 ; WebKit éditeur5, clavier4. TypeScript, lint des neuf fichiers et du harnais, build final PASS. Contrastes/labels/focus/erreurs/débordements vérifiés à375/1440px. Build final7,6s, TypeScript build3,1s,198pages ; pas de répétition des suites globales/backend inchangées.

**FAIL bruts conservés et qualifiés** : WebKit première campagne auth18/4 (Tab remplacé dans le harnais par Alt+Tab après contrôle HTML natif,4/0 ensuite) ; social9/1, planning8/1, parcours33/1, téléchargement privé8/1, extra28/3 (deux vrais défauts undo corrigés, un contrôle générique). Dernier delta WebKit visuel2/1 et navigation2/1. Les gardes génériques capturent un message d'accès réseau lors du déchargement forcé ; même message reproduit sur HTML natif sans SUTRA avec fetch pagehide et catch. Navigation applicative normale : aucune erreur. Les commandes production gardent code1 ; aucune gate globale verte affirmée et aucun filtre ajouté pour faire passer ces erreurs.

**Mesures comparables** : double soumission auth2→1 requête aux deux largeurs ; planning3752→1 PATCH et brouillon conservé. API suspendue : erreur sociale observée10,89s et planning10,90s après deadline10s, reprise manuelle avec même ID. DCL local production Chromium20–91ms selon page/largeur ; ce n'est pas un gain avant/après, ni une mesure réseau public. Aucune promesse sans latence ; détail des octets/ressources et conditions dans `metrics.json`.

**BLOQUÉ** : Safari natif WebDriver désactivé (HTTP500). Repli UI interrompu avant navigation en raison d'une interaction utilisateur concurrente, sans changer les réglages. WebKit testé ne vaut pas Safari natif/iOS validé.

**NON TESTÉ et action T01/T03** : pas de contrôle d'annulation durable exposé dans création/production. La route production prévoit `step=cancel` avec `requestId/targetStep`, mais sa clé n'est pas celle de `/create`. L'abandon du fetch n'annule pas un job fournisseur. Confirmer le contrat serveur et son état de réconciliation avant de raccorder une annulation UI. Ce manque reste explicitement ouvert ; aucun backend modifié en parallèle. VoiceOver réel, appareil physique, OAuth personnel, fournisseurs/crédits réels, gros médias/CORS distant et nouveau candidat intégré restent NON TESTÉS.

GitNexus : impacts préalables LOW ou UNKNOWN documenté pour Next/JSX ; analyse finale **HIGH**, neuf fichiers/24symboles/neuf flux. Liste intégrale obtenue après troncature CLI, périmètre conforme ; comparatif historique main **CRITICAL**/tronqué ne représente pas le delta T07. Nouveaux tests hors index, aucune certification exhaustive. Secrets : aucun master/env lu, quatre faux positifs UUID de fixture documentés, scan revu PASS. Serveurs propres arrêtés ; aucun compte réel connecté, aucune publication, génération facturée, GPU ou IA sur Mac.

Prochaine étape : T01 vérifie les blobs exacts, intègre le delta sans écraser les autres lots, puis T08 vérifie le candidat intégré et les limites signalées. Aucune autorisation de promotion donnée par ce handoff.

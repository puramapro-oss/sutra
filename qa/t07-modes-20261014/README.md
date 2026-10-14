# T07 — modes de génération et reconnexion sociale, 14 octobre 2026

## Périmètre et provenance

Mandat distinct Matiss 01h40. Branche `codex/sutra-t07-modes-ux-20261014`, base exacte `14617333bfb21efe1f2a1c91888d3322dde20f5b` (application `e3b17117256269e281304cd4ab83bc722a6f7894`). Worktree isolé ; réservations exclusives dans les deux LOCKS. ACK T01 MODE-DEFECTS pour les deux fichiers UI sociaux. Aucun fichier API/lib/backend, configuration ou dépendance modifié. Les anciens constats fournisseurs de 48f2d5e sont historiques ; aucun audit fournisseur rejoué par T07.

## Corrections

- Création et Production : distinction API client / personnel open source distant, worker distant et coûts d’hébergement explicités, état déclaré par le GET public T04 visible même détails fermés, ou disponibilité non vérifiée si la réponse manque/échoue. Aucun sélecteur ne prétend changer l’autorisation serveur. Aucun prix, délai garanti, calcul Mac gratuit ou 4K native promis.
- Erreur de création avant la première étape auparavant masquée : alerte désormais indépendante de l’affichage du pipeline. Messages bornés pour worker indisponible, quotas/budget et résultat incertain, lien bibliothèque et brouillon conservé. Les erreurs fournisseur brutes ne sont plus reflétées par ces deux encarts.
- Pipeline : neuf cibles de contraste loading détectées par axe, couleurs ajustées dans le design system existant. Aucun traitement de génération modifié.
- Social : seul `status=connected` compte comme connecté. Historique des autres états conservé, reconnexion accessible ; seules connexions actives proposées dans Autopilot. Une ligne historique ne masque pas une ligne connectée. Retour DELETE202 : révocation distante non confirmée, aucun faux toast de succès. Grille et boutons adaptés au mobile.
- Consommateur UI du DTO public T04 v1 : un GET authentifié same-origin par montage, y compris le rejeu des effets Strict Mode ; timeout8s, aucun polling/retry. Validation fermée, huit états du worker, client API non sondé, coût calcul seul distinct du coût réel/total (attente/stockage/réseau exclus). Aucun manifeste privé, raison brute ou autorité navigateur exposé. Erreurs Salad budget et profil non pris en charge distinguées.

## Validation ciblée

| Commande | Résultat |
|---|---|
| `node qa/t07-modes-20261014/browser.mjs` | **26 PASS**, 27 audits axe WCAG2A/AA/2.1AA sans violation |
| `node qa/t07-modes-20261014/browser.mjs --social-only` | **8 PASS**, 7 audits axe sans violation ; UI sociale inchangée depuis cette passe |
| `node qa/t07-modes-20261014/browser.mjs --capabilities-only` | **18 PASS**, 17 audits axe sans violation ; aucun POST |
| `node qa/t07-modes-20261014/browser.mjs --capabilities-only --visual-only` | 4 PASS, 3 audits axe ; captures client/prêt/occupé à375px examinées, sans génération |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | exit0, après le dernier delta produit capabilities/messages Salad |
| ESLint explicite des neuf fichiers UI et du harnais | exit0 ; 22 avertissements antérieurs dans create/page.tsx, aucun nouvel avertissement |
| `git diff --check` | PASS |

Chromium réel, Next dev webpack, Node v26.0.0. Largeurs **320, 375, 768, 1280, 1440 px**. Formulaires auto/manuels, clavier/focus du panneau, vide, attente, worker indisponible, quota et résultat inconnu, brouillons, reconnexion et DELETE202. Zéro erreur JavaScript/hydratation capturée. Contrôles sans débordement horizontal et captures examinées à 375/1440. Les captures complètes des parcours création/production sont conservées aux cinq largeurs. ARIA/axe/clavier vérifiés ; aucune session VoiceOver ni recette production revendiquée.

Dix POST génération interceptés en navigateur, un DELETE social et un POST connexion simulés : **aucune route de génération, achat, publication ou OAuth réel exécutée**. Profil et données synthétiques uniquement. Environnement minimal synthétique ; garde `qa/t08/offline.cjs` bloque réseau distant et lecture `.env*` dans Next. Aucun secret maître/local lu, copié ou affiché. Aucun build de production/gate globale identique relancé, aucune modification distante.

### Preuves antérieures conservées

`browser-run-initial.txt` et `results-before-loading-contrast.json` : quinze parcours responsive passaient puis échec axe loading (neuf cibles), corrigé. `browser-run-errors.txt` et `results-errors-after-contrast.json` : sept contrôles de régression PASS. `browser-run-interrupted.txt` et `results-interrupted.json` : trois cas à320 PASS puis serveur local arrêté/connexion refusée ; cause externe non établie, ce lancement reste incomplet. Son ancien libellé automatique « six requêtes » était inexact : le tableau `intercepted` est vide. Le harnais journalise désormais le nombre réel et la sortie du processus, démarre son propre groupe isolé et arrête uniquement son serveur. La passe finale est entièrement verte. Des interruptions de flux Next dev lors des navigations figurent dans le log local ; aucune erreur navigateur correspondante ni impact fonctionnel reproduit dans la passe complète.

Les JSON `evidence/results.json`, `evidence/social/results.json` et `evidence/capabilities/results.json` font foi : **52 contrôles ciblés PASS /51 audits axe sans violation**, hors complément visuel des trois panneaux. Capabilities : compte client, huit états owner, HTTP401/404/503, JSON invalide, version incompatible, disponibilité contradictoire, coût invalide et timeout. Un seul GET malgré édition du formulaire et bascules auto/manuelle ; zéro champ d’autorité ajouté aux POST.

Deux démarrages capabilities sont restés sans réponse HTTP après Ready ; arrêt uniquement de leurs groupes de processus après vérification PID/cwd, preuves `browser-capabilities-startup-stalled*.txt` et JSON correspondants conservés. Nouveau cache Next : démarrage et tests PASS. Cause interne du cache non certifiée. L’ancien `.next` est intégralement conservé dans `/Users/matissdornier/purama-worktrees/.sutra-t07-next-retained-20261014` (171Mo), aucun artefact supprimé. Le probe de démarrage possède désormais un timeout. Aucun autre terminal interrompu.

## GitNexus / sécurité

Impact exécuté avant chaque édition produit. `ExecutionModeNotice` : LOW, deux appelants ; `PipelineProgress`, `StepRow`, `PlatformGrid` : LOW, un appelant chacun. Les pages/callbacks retournant UNKNOWN ont été recoupés par imports/usages source. Index isolé actualisé, mais tronqué sur les flux/callees : aucune certification exhaustive. `detect-changes-staged.txt` contient l’analyse finale avant commit : HIGH, dix flux UI attendus (création/production/capabilities et social), alerte communiquée. Le CLI limite aussi l’affichage des symboles malgré --limit100 ; la liste des fichiers Git a été revue intégralement. Revue Git limitée aux neuf fichiers UI et preuves/docs réservées. Gitleaks staged expurgé exécuté avant commit, reçu dans `security.txt`. Manifeste SHA256 des sources/config/lockfile dans `tested-source.json`.

## Contrat T04 / intégration T01

DTO public reçu dans `T04-SALAD-20261014-ACK.md` puis vérifié en lecture seule dans le worktree T04 (`src/app/api/video/capabilities/route.ts`, `src/lib/salad/application.ts`). T07 a raccordé l’UI à ce contrat v1 ; aucune copie backend. `capabilities-contract-source.json` en conserve les empreintes de lecture (WIP T04, pas une preuve intégrée). Absence de route sur la base1461733 => état inconnu explicite ; aucun HTTP200 fournisseur ni plan n’implique prêt.

**Périmètre UI terminé localement.** T01 doit intégrer endpoint T04 et UI, puis valider ensemble avec l’identité serveur. Disponibilité réelle Salad, CAS global GPU, stockage immuable, qualification matérielle, coût réel et qualité native restent hors preuve UI. Aucun besoin de DTO supplémentaire pour ce lot. L’encart est informatif : routage, droits et refus de lancement restent imposés par le serveur. Il ne désactive pas les formulaires sur une disponibilité inconnue et ne propose pas de fallback payant.

Livraison locale uniquement, aucun push/fusion/déploiement. T01 reçoit branche/SHA/liste exacte dans `.coord/handoffs/SUTRA-20261012/T07-MODES-UX-20261014.md`. Aucun achat, compte à connecter ou action manuelle utilisateur nécessaire pour ces corrections UI.

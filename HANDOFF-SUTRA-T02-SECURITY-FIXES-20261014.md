# HANDOFF SUTRA T02 — SECURITY-FIXES — 2026-10-14

Branche : `codex/sutra-t02-security-fixes-20261014`.
Base : `b7cf848d07fca2734db36a2e30d045ca312a3162` ; code intégré T01 `d8691d8ac6cf885f8e5522f361f45ebe229ec20d`.
Commit local : voir HEAD de cette branche et le bulletin coordinateur `.coord/handoffs/SUTRA-20261012/T02-SECURITY-FIXES-20261014.md` (SHA complet après commit).

## Livré

- `src/lib/storage.ts` : propriétaire et chemin obligatoires ; suppression vérifie la propriété, liste strictement confinée. Aucun appelant produit des helpers supprimant/listant trouvé : durcissement interne, pas exploitation HTTP affirmée.
- `src/app/api/verify/[videoId]/route.ts` : diagnostics DB/provider/exception retirés des réponses publiques, contrat métier conservé.
- `src/lib/opentimestamps.ts`, nouveau `src/lib/ots-transport.ts` : transport HTTPS/DNS public épinglé sans redirection, bornes temps/taille, erreurs constantes ; parseur/crypto OTS conservés. Refus des estampillages vides après échec de tous les calendriers. Attribution exclusive ACK T01 dans LOCKS02:31.
- `scripts/test-security-storage.mts` : fixtures conformes au contexte propriétaire existant.
- Quatre nouveaux `scripts/test-t02-security-fixes-*.mts` : storage, proof, session-media, ots.
- Preuves : `qa/t02-security-fixes-20261014/**` ; append BATON/task_plan/ERRORS.

## Vérifications

PASS :55 tests ciblés /0 FAIL /1 SKIP réseau volontaire ;38 nouveaux et17 régressions. TypeScript/lint ciblés PASS. Commandes exactes et empreintes dans les manifestes/run.py/README QA.
FAIL historiques conservés :15 cas storage/proof avant correction ; trois décisions de redirection vulnérable request ; un faux succès OTS sans attestation. Les tests de correction sont verts.
Gate globale/build inchangés non rejoués.47 chemins sécurité/dépendances/migrations identiques à la base, preuves intégrées T01 réutilisées ; nouveaux modules évalués séparément. Aucun résultat fixture assimilé à une preuve fournisseur ou Bitcoin réel.

## À T01

Importer uniquement les fichiers de ce commit ; OAuth T06 et worker/providers T04 n'ont pas été touchés. Ajouter les quatre nouveaux scripts à scripts/run-ci.mjs sous votre ownership. Effectuer une seule gate finale sur le candidat intégré, y compris build Next : ce lot ne remplace pas votre preuve d'intégration.

npm audit conserve2 low/5 moderate,0 high/critical ; mitigation de request appliquée au chemin OTS. uuid/elliptic : aucun appel vulnérable applicable identifié, alertes conservées. Package/lock inchangés ; éventuel remplacement architectural de la dépendance reste à attribuer par T01. Pas de nettoyage de sécurité par override majeur forcé.

BLOQUÉ hors lot : activation GPU préexistante sans qualification/autorisation. NON TESTÉ : calendriers/Bitcoin/fournisseurs live, consentement/publication, RLS distante, génération/GPU, navigateur et build global après delta. URL signée déjà émise reste susceptible d'être valide jusqu'au TTL300s ; révocation testée pour émission suivante.

GitNexus : impacts avant édition (storage/proof UNKNOWN ; OTS LOW), couverture globale tronquée explicitée, detect-changes final et scanner dans QA. Aucun secret réel lu/affiché/copié, aucun package installé ni migration/production/push/fusion. Worktree et tous WIP tiers conservés.

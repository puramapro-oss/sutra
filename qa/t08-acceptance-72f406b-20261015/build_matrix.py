"""Reconcile each historical requirement against this candidate's explicit evidence."""
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
CANDIDATE = '72f406b940b7e3cdfb27873751a4059375646f25'
now = datetime.now(timezone.utc).isoformat()
old = json.loads((ROOT / 'qa/t08-acceptance-d21b7b4-20261015/matrix.json').read_text())
source = json.loads((OUT / 'source-verification.json').read_text())
assert source['counts'].get('FAIL', 0) == 0
ci_path = OUT / 'ci-verification.json'
ci = json.loads(ci_path.read_text()) if ci_path.exists() else None
ci_ready = bool(ci and ci['candidate'] == CANDIDATE and ci['counts'].get('FAIL', 0) == 0)
rows = {r['id']: {**r, 'previousStatus': r['status'], 'candidate': CANDIDATE, 'reviewedAt': now} for r in old['requirements']}

def update(ids, status, evidence, kind='executed'):
    for rid in ids.split():
        rows[rid].update(status=status, evidence=evidence, evidenceKind=kind)

journey = 'journey.json/.log :13 PASS/0 FAIL/0 SKIP sur72f. Routes, file, worker, pipeline, contrat export et journal social réels ; session/DB/fournisseurs/stockage simulés. J01 chaîne complète, J02/J11 concurrence12, J04/J05/J10 pannes/reprise, J06 isolation. Aucune génération fournisseur ni publication réelle.'
update('R01 R04 R05 R08 R09 R10 R11 R12 R13 R14 R16 R17 R20 R21 R24 R25 R26 R27 R28 R29 R35 R37', 'PASS', journey)
update('R06 R58', 'PASS', 'CI exacte contrats : mode client interdit propriétaire, API client normale préservée, Salad désactivé refuse avant quota/fournisseur, aucun fallback payant. Estimation/devis/plafond/réservation synthétiques. Nouveau rpc19 et journey13 PASS. Ancien modes6 inchangé et vérifié source-verification.json.', 'executed-and-source-bound-reuse')
update('R15', 'PASS', 'CI exacte contrats : test-t03-suno-recovery/music-recovery/suno-contract PASS. Reprise taskId et timeout simulés ; pas de musique réelle.', 'exact-candidate-ci')
update('R19 R48 R68', 'PASS', 'ci-verification.json :17 exports CPU synthétiques CI réels, SHA256/octets/décodage complet ; final-media32 et retained-real-exports49 sans addition des recouvrements. source-verification.json :82 sources T05 inchangées et3MP4 4K conservés hashés,5tests auteur PASS. Concurrence/deadline/export/image/audio/sous-titres techniques. Upscale160x90→320x180→4K, pas de génération native4K.', 'exact-candidate-ci-and-source-bound-reuse')
update('R22 R56', 'PASS', 'social-authority.json15 PASS sur72f : session/utilisateur/profil/expiration, autorité revalidée après attente et avant DELETE. history-routes.json9 PASS sur PostgreSQL réel complète mocks par trigger canonique, replay et reconnexion. OAuth personnel non exécuté.')
update('R23 R31 R53', 'PASS', 'CI exacte contrats security-{routes,storage,media}, security-fixes-{storage,proof,session-media,ots}, oauth-boundaries : SSRF/IDOR/CSRF/XSS/redirects OTS ciblés PASS, aucun stamp externe. capabilities19 et rpc19 rejoués PASS sur72f. Pas de sécurité exhaustive.', 'exact-candidate-ci-and-executed')
update('R30', 'BLOQUÉ', 'receipts/scheduler-inventory.json13:23:32UTC :0systemd/cronhost/pgcron SUTRA,0configuration auto active,0publication auto. scheduler-plan.json PREPARED_NOT_INSTALLED observe-only, sans dispatch. Dépendance précise : configuration/activation contrôlée T01 ; secret présent ou observateur ne vaut pas ordonnanceur exécutant.', 'fresh-configuration-receipt')
update('R33 R66', 'PASS', 'CI exacte disposable-database : RLS261/ACL30, pipeline16, durable/social46, Salad7 et historique27 ; history-routes9 PostgreSQL réel exécutés par T08. Clients interdits colonnes financières/statuts, opérations normales permises. ACL claim SECURITY INVOKER évaluées avec RLS/DML (anon/auth refus, service_role autorisé), sans conclure sur ACL seules. SQL non déployé.', 'exact-candidate-ci-and-executed')
browser = 'CI38745298450 exacte :20 familles Chromium/WebKit,283assertions PASS/1FAIL. Garde runtime webkit/social FAIL suivi R69/R47 ; autres19familles PASS,0erreurDOM, méthodes qualifiées GET/HEAD seulement. Assertions accessibilité/connexion/lecteur concernées PASS ; aucune validation globale du navigateur. T07 source inchangée :142assertions Chromium375/1440,39axe sans violation, focus/clavier/double-submit/retry/timeout. Captures375 social/planning examinées T08 ; pas de Safari/VoiceOver/appareil physique.'
update('R03 R39 R40 R52 R69 R70 R71', 'PASS', browser, 'exact-candidate-ci-and-source-bound-reuse')
update('R42', 'PASS', 'run.py : environnement synthétique allowlist et qa/t08/offline.cjs, aucun secret master/.env chargé, aucun fournisseur distant, calcul IA Mac/GPU/paiement/publication/production. Recettes PG privées arrêtées. Scan secret delta avant commit dans quality.json.')
update('R46', 'PASS', 'quality.json : syntaxe Python/Node et ESLint nouveaux fichiers QA. TypeScript/lint/build produit sur CI38745298450 exact ; aucun build local concurrent.', 'delta-quality-and-exact-candidate-ci')
update('R47', 'PASS' if ci_ready else 'BLOQUÉ', 'Quatre causes intégrées72f ; T08 direct112PASS0FAIL0SKIP, dont parcours13 après corrections. CI38745298450 trois jobs SUCCESS, manifeste1061blobs exacts.' if ci_ready else 'Quatre causes intégrées72f et112tests directs PASS ; gate globale exacte CI38745298450 encore attendue. Aucun ancien vert CI ne ferme cette dépendance.', 'exact-candidate-ci' if ci_ready else 'pending-exact-ci')
update('R49', 'PASS', 'rpc.json19 PASS sur72f. Rouge T02 conservé12PASS7FAIL ; correctif8c41629 intégré byte-identique. Erreurs claim/profil/worker : code public exact dans HTTP et last_error, marqueurs privés absents. Autorité/plan falsifié et écriture non confirmée contrôlés.')
update('R50 R72', 'PASS', 'T03 clôture29 scénarios distincts PostgreSQL réels (10nouveaux+19existants) et durable34 T08 précédents, sources invariantes vérifiées. Nouvelle CI durable/social46 et contrats, journey13 frais : terminal/checkpoint voix/CAS/ACK perdu/reprise. Aucun GPU distant.', 'source-bound-reuse-and-exact-candidate-ci')
update('R51', 'PASS', 'CI exacte social-validation/autonomy : publication refusée ancien profil/revocation pending. social-authority15 et history-routes9 frais ; incertitude DELETE conserve fence, aucune reconnexion/publication faussement autorisée.')
update('R54 R57', 'PASS', 'cancellation.json4 PASS sur72f : erreur SQL expurgée, session/isolation/double clic/quota. CI pipeline16 couvre réservation mois original libérée une fois, worker annulé ne peut plus checkpoint/finish. Annulation serveur uniquement ; /create ne câble pas cette commande durable, reset local ne prouve aucun arrêt fournisseur.')
update('R55', 'PASS', 'capabilities.json19 PASS sur72f : capacité privée refusée après revoke/changement profil, identité/provenance/usage revérifiés. Ancien rouge10PASS9FAIL conservé ; correction intégrée retestée.')
update('R59 R61', 'PASS', 'receipts/backup-restore.json T01 exécuté13:21:11UTC :141tables restaurées, comptages identiques, snapshot partagé, aucune DDL production. Reçu copié/hashé, fraîcheur <4h lors de recette (receipts/provenance.json). Auth IDs seulement/blobs non atomiques ; pas restauration complète R62 ni nouvelle exécution distante T08.', 'fresh-owner-execution-receipt')
update('R60', 'PASS', 'history-sql.json27 PASS sur PostgreSQL privé : apply/replay/rollback. Reçus T01 checkpoint/client-permissions/social-history verify-copy, dernière empreinte historique d2f6a9cb exacte, rollback conserve historique et données. Simulations livraison/promotion/rollback déjà exécutées sur sources invariantes ; étapes CI72f correspondantes skipped après erreur navigateur, non prétendues exécutées. Aucune migration production T08.', 'executed-and-owner-receipts')
update('R64 R67', 'PASS', 'history-routes.json9 PASS : connexion→révocation200→confirmation→reconnexion, PostgreSQL18 et trigger updated_at canonique. Fix3edae7a byte-identique, CAS sur snapshot SQL rechargé ; rejouer confirme sans second DELETE. Historique durable et erreurs audit atomiques vérifiés. Rouge historique4PASS2FAIL conservé.')
update('R65', 'PASS', 'history-routes9 + history-sql27 PASS : ancien compte Zernio/profil valide sans révision révoqué et tokens purgés. Migration intégrée d2f6a9cb impose provenance stricte, profil/identité inchangés, révision réellement absente et pending absent/false ; aucun consentement passé inventé. Null/invalide/race/échec audit refusés atomiquement.')
update('R73', 'PASS', 'harness.json6 PASS/0FAIL/0SKIP, assertions T08 byte-identiques au rouge2PASS4FAIL. POST/PATCH/DELETE/méthode absente restent unexpected, GET admissible borné. Correctif T01 avec contre-preuves natives GET/HEAD séparées, CI78 contrôles. Aucun test échoué ignoré.')

if ci and not ci_ready:
    update('R47 R69', 'FAIL', 'T08-CI-WEBKIT-01 : CI38745298450 quality FAIL sur72f. webkit/social :9assertions fonctionnelles PASS puis garde runtime FAIL ;1pageerror user_notifications CORS sur fixture HTTPS locale, navigation6,0erreurDOM. Reproduction et SHA des artefacts dans ci-verification.json et DEFECTS.md. T01 diagnostique ; aucune qualification sans contre-preuve native exacte. Contrats990PASS/7SKIP et PG PASS ne ferment pas ce rouge.', 'exact-candidate-ci-failure')

gaps = {
 'R02': 'Aucun login OAuth personnel exécuté sur72f. Identité synthétique seulement ; consentement utilisateur personnel indispensable.',
 'R07': 'Aucun budget fournisseur consommé, aucun achat/essai facturé autorisé. Estimation/réservation simulées ne prouvent ni coût réel ni solde. Dépendance budget distincte du code.',
 'R18': 'Aucun média IA fournisseur réel à examiner ; qualité technique CPU synthétique R19/R48 ne certifie pas qualité image/voix IA.',
 'R32': 'Aucune preuve exhaustive de sécurité. Risque précis redirections OTS fermé R53 ; pas de nouveau scan général sans delta justifié.',
 'R34': 'Pas de chaîne continue navigateur→DB distante→GPU→publication publique. Parcours simulé, PG privé réel et exports CPU réels sont des preuves séparées.',
 'R36': 'Aucune alerte exploitation réellement délivrée et suivie de reprise complète. Observateur T01 préparé seulement, états/logs simulés R35.',
 'R38': 'Pas de SLA ni charge distante. Concurrence12 isolée et mesures T07 dev instrumentées54–713ms DCL/5.28–5.29Mo ne sont pas benchmark production.',
 'R41': 'Clavier/focus/mobile375 CI et T07 prouvés ; aucun parcours manuel intégral lecteur écran, VoiceOver ou appareil iOS physique.',
 'R43': 'Pas de GET fournisseur authentifié sur72f. Reçus200 RunPod/Shotstack/SunoAPI du runtime86d04c8 datés et distincts ; aucune nouvelle sonde autorisée par T01. Présence clé/health200 ne prouve pas GPU.',
 'R44': 'Aucun GPU/VRAM24Go/rendu facturé qualifié. T04 db93ef0 : clé Salad malformée, org/projet absents, saisie personnelle masquée requise ; aucun secret lu T08. Mode/gateway inactifs, image CUDA et budget réel non qualifiés.',
 'R45': 'Aucun compte social connecté, consentement personnel ni publication publique exécutés. Connexion sociale et publication sont simulées ; choix/réseaux et consentements restent personnels.',
 'R62': 'Sauvegarde141tables exclut auth/sessions complètes et snapshot atomique des blobs. Reçu frais ne ferme pas restauration complète cohérente.',
 'R63': 'Aucune DDL/promotion/rollback production exécutés par T08, interdits dans ce mandat. SQL privé et simulation R60 restent distincts.',
}
for rid, text in gaps.items():
    update(rid, 'NON TESTÉ', text, 'current-proof-gap-reviewed')
rows['R74'] = {'id': 'R74', 'requirement': 'Commande UI create reliée à l’annulation durable serveur',
              'owner': 'T01/T03/T07', 'previousStatus': 'Limite déjà signalée par T07, séparée ici du PASS API R57',
              'status': 'BLOQUÉ', 'candidate': CANDIDATE, 'reviewedAt': now,
              'evidence': 'Handoff T07 intégré cbcf174 : identités UI/production différentes, commande durable non raccordée. Aucun delta UI depuis ce reçu (source-verification.json). Dépendance précise : contrat de liaison job/UI à arbitrer et intégrer par propriétaires T01/T03/T07 ; T08 ne peut pas déclarer reset/abort fetch comme arrêt du travail. R57 certifie seulement API/SQL.',
              'evidenceKind': 'source-bound-owner-integration-blocker'}
assert len(rows) == 74 and len(gaps) == 13
historical = ['R54','R55','R56','R64','R65','R66','R67','R68','R69','R70','R71','R72']
counts = dict(Counter(r['status'] for r in rows.values()))
result = {'candidate': CANDIDATE, 'observedAt': now, 'counts': counts,
          'verdict': 'NON PRÊT aux essais réels GPU/publication ; recette simulée et CPU acceptée sous limites' if ci_ready else 'NON PRÊT ; CI exacte FAIL WebKit social, cause à corriger par T01',
          'boundedAcceptance': ci_ready, 'directTests': {'pass': 112, 'fail': 0, 'skipped': 0},
          'sourceVerification': source['counts'], 'ciVerification': ci['counts'] if ci else None,
          'historical12Failures': {rid: rows[rid]['status'] for rid in historical},
          'requirements': list(rows.values())}
(OUT / 'matrix.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
lines = ['# T08 — matrice finale du candidat72f', '', f'SHA exact : `{CANDIDATE}`. Revue : {now}.', '',
         ' / '.join(f'{n} {s}' for s,n in counts.items()) + '.', '',
         'PASS = preuve exécutée directe ou auteur/CI liée aux sources exactes. FAIL = défaut reproductible. BLOQUÉ = dépendance précise. NON TESTÉ = aucune preuve réelle. Aucune simulation ne certifie GPU/publication réelle.', '',
         '| ID | Exigence | Statut | Preuve et limites | Propriétaire |', '|---|---|---|---|---|']
for row in rows.values():
    lines.append('| ' + ' | '.join(str(row[k]).replace('|','/') for k in ['id','requirement','status','evidence','owner']) + ' |')
(OUT / 'MATRIX.md').write_text('\n'.join(lines) + '\n')
print(json.dumps({'candidate': CANDIDATE, 'counts': counts, 'ciReady': ci_ready}, ensure_ascii=False))

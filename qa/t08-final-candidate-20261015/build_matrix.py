"""Render the bounded T08 verdict; current evidence replaces all historical claims."""
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SHA = "3855665fa79e3cc2171124d864a834214d6ac617"
previous = json.loads((ROOT.parent / "sutra-final-providers-20261013/qa/t01-consolidation-20261014/matrix-3855665.json").read_text())
journey = {1, 4, 5, 8, 9, 10, 11, 12, 13, 14, 16, 17, 20, 21, 24, 25, 26, 27, 28, 29, 35, 37}
notes = {
    2: "Aucune connexion OAuth personnelle ; identité synthétique dans CI, aucun consentement réel.",
    3: "CI38598361267 navigateur production légal15/parcours34/privé9 et contrats redirections OVH PASS. Identité synthétique, aucune connexion personnelle ni sonde production T08.",
    6: "modes.json :6 PASS sur3855665. Client interdit au mode propriétaire, API client préservée, Salad désactivé échoue avant quota/fournisseur sans repli payant. Budget simulé R58.",
    7: "Aucun coût GPU consommé ni achat ; montants fixtures ne constituent pas un devis réel. Budget réel/autorisation d'essai payant absents.",
    15: "CI exacte contracts.log : taskId Suno, intention durable avant HTTP, timeout/ACK/reprise GET sans resoumission. ci-evidence-index.json repère34 assertions Suno qui se recouvrent. Aucune musique réelle.",
    18: "Aucune qualité IA réelle continue mesurée. CPU synthétique couvert R19/R48, sans qualification GPU ni qualité fournisseur.",
    19: "CI exacte test:media120 PASS/0FAIL : vrais encodages/décodages CPU synthétiques. provenance.json vérifie37 MP4 conservés. Aucun GPU.",
    22: "CI exacte : scénarios replay state/ancien consentement/révocation du14oct PASS, repères ci-evidence-index.json. Nouvelle course de binding pendant attente GET/DELETE FAIL R56 ; aucun PASS OAuth général.",
    23: "CI exacte : gardes stockage/preuve publique du14oct PASS, repères ci-evidence-index.json. Capacité privée après revoke/binding invalide FAIL R55 ; aucun PASS global médias.",
    30: "Configuration volontairement inactive : T01-FINAL-INTEGRATION15oct01:07UTC confirme aucun cron exécutant SUTRA ni auto-publication. Secret présent ne vaut pas activation. T01 seul configuration/OVH.",
    31: "CI exacte redteam14 PASS et contrats ciblés SSRF/IDOR/CSRF/XSS PASS ; index de21 assertions bornées. Pas de sécurité exhaustive, R54-R56 restent FAIL.",
    32: "Sécurité exhaustive non déduite des tests bornés. Ancien sous-risque précis OTS maintenant couvert R53 ; aucun scan général supplémentaire.",
    33: "CI exacte PostgreSQL jetable réel : pipeline16, Salad7, reprise/OAuth26, RLS259 assertions,0skip. SQL canonique chargé et logs hashés. Aucune DB distante modifiée par T08.",
    34: "Aucun parcours continu DB réelle→fournisseur→montage→publication. Parcours simulé et tests PostgreSQL/CPU séparés ne remplacent pas cette preuve.",
    36: "Aucune alerte réellement délivrée ni diagnostic exploitation bout en bout. États et erreurs applicatifs simulés couverts R35.",
    38: "Aucun SLA/charge distante mesuré. R37 :12 requêtes concurrentes isolées seulement ; durées CI ne constituent pas un engagement réel.",
    39: "CI exacte Chromium210 contrôles+7extensions,165scans axe/0violation. Résultats et captures375/1440 hashés ; deux images affichées par T08. Aucun Safari/iOS/Android/lecteur écran physique.",
    40: "CI exacte bibliothèque production25 PASS : pagination/filtre/retry/double clic/contraste. Ancien FAIL fermé sur cette preuve exécutée, sans rebuild identique.",
    41: "Lecteur écran et parcours manuel intégral absents. Ancien FAIL modal fermé : légal15 PASS à375/1440, focus/piège clavier/Escape/thèmes/retry/délai ; capture375 examinée. Sous-PASS ne ferme pas lecteur écran.",
    42: "run.py : allowlist, valeurs synthétiques, offline.cjs (réseau externe/lecture.env refusés). Aucun secret nécessaire/copié ni opération GPU/payante/publication/production. Scan du delta avant commit joint.",
    43: "Pas de nouvelle authentification fournisseur actuelle T08. GET200 RunPod/Shotstack T04/T01 du14oct conservés comme preuve datée ; configuration courante non contrôlée T08, pas de probe concurrent. Ni crédit ni génération déduit.",
    44: "Aucun GPU/VRAM/modèle/génération testé. T01 signale15oct clé Salad malformée, gateway absente et mode désactivé ; health200 ou présence de clé ne qualifie pas un GPU.",
    45: "Aucun compte social connecté ni consentement personnel/publication publique. Consentements utilisateur requis après correction R55/R56 et nouveau candidat.",
    46: "quality.json : typecheck ciblé/ESLint nouveaux tests/Python AST PASS. TS/lint/build produit exact3855665 CI PASS réutilisés par empreintes. Warnings lint préexistants, aucun zéro-warning prétendu.",
    47: "Nouveau SHA intégré T01 manquant. T01-FINAL-INTEGRATION15oct :3855665 ancienne référence, corrections propriétaires en cours. Cinq FAIL14oct clos sur3855665, nouveaux rouges R54-R56. Aucun ACK/promotion présumé.",
    48: "CI exacte retained-real-exports49 + composition12/compositor31/local-engine3/salad-media25 =120PASS CPU.37 MP4 hash/taille vérifiés dans provenance.json ; aucune génération payante.",
    49: "production-error.json :4 PASS du test auteur T02 rejoué directement sur3855665. Ancien diagnostic submit_video_job expurgé ; annulation distincte R54 FAIL.",
    50: "durable.json :18 PASS rejoués sur3855665 et PostgreSQL CI canonique réel vérifie checkpoint/intégrité/ACK perdu. Null non autorisé refusé. Pas preuve de reprise fournisseur distante.",
    51: "social-authority.json :18 PASS +journey13 sur3855665. Publication refuse ancien profil/revoke pending. Nouvelles frontières R55/R56 non couvertes par ce PASS.",
    52: "CI exacte production journey34+private-download9 PASS (assertions communes non additionnées) : états honnêtes, validation, HTML/corruption/timeout/retry/double clic. Capture1440 affichée ; révocation privée R55 FAIL.",
    53: "CI exacte contracts : OTS refuse redirections dangereuses, bornes transport PASS ; ci-evidence-index.json. Aucun stamp externe. Ancien risque précis fermé, R32 reste NON TESTÉ.",
}
rows = []
for old in previous["requirements"]:
    number = int(old["id"][1:])
    row = {key: old[key] for key in ("id", "requirement", "owner")}
    row.update(previousStatus=old["status"], status="NON TESTÉ" if number == 43 else old["status"], candidate=SHA)
    row["evidence"] = ("journey.json/.log :13 PASS exécutés sur3855665. Routes→queue→worker→contrat export→journal social réels ; session/DB/fournisseurs/media I/O simulés. J01 complet, J02/J11 concurrence12, J04/J05/J10 pannes/reprise, J06 isolation. Aucun appel payant ni publication réelle."
                       if number in journey else notes[number])
    if number == 22:
        row["requirement"] = "OAuth : scénarios replay/ancien consentement/révocation du lot14oct"
    if number == 23:
        row["requirement"] = "Stockage et preuve publique : gardes du lot14oct"
    rows.append(row)

additional = [
    ("R54", "Panne SQL à l'annulation : réponse publique expurgée", "FAIL", "T03/T01",
     "cancellation.json C04 : attendu5xx expurgé, observé503 avec diagnostic synthétique.3PASS/1FAIL, repro transmise T08-CANCEL-01 ; aucun produit modifié."),
    ("R55", "Capacité privée invalidée après revoke/changement de profil", "FAIL", "T02/T01",
     "T02-CAP-01 sur49c166d produit identique3855665 :10PASS/9FAIL,307/signature malgré autorité invalide. RED receipts/t02-red-0.txt hashé. Correctif WIP ne vaut pas intégration ; aucun doublon T08."),
    ("R56", "Autorité OAuth revalidée après attente et avant DELETE", "FAIL", "T06/T01",
     "T06-FINAL-SOCIAL15oct :9 défauts produit sur49c166d. Rouge brut10FAIL/1PASS inclut1artefact de projection fixture, distingué par T06. Callback accepte binding réaffecté/retiré pendant GET ; DELETE hors autorité. Reçu rouge conservé, retest intégré requis."),
    ("R57", "Annulation : session/isolation/double clic/quota SQL", "PASS", "T08/T03/T01",
     "C01-C03 :3 PASS HTTP→vrai cancelJobByKey→RPC simulée. CI pipeline16 couvre mois original libéré une fois et worker annulé incapable de checkpoint/finish. Atomicité SQL prouvée par CI, pas par fixture."),
    ("R58", "Estimation simulée : devis/plafond avant réservation", "PASS", "T04/T03",
     "CI exacte : expired quote, insufficient budget and unqualified profile never reserve or POST ; preflight timeout/budget, quoteEvidence immuable. Index budget19 assertions, aucun prix réel inventé."),
    ("R59", "Sauvegarde/restauration isolée bornée", "PASS", "T01",
     "backup-restore.json14oct14:03UTC : snapshot partagé141 tables/comptages identiques, reçu hashé. Auth IDs seulement et blobs non gelés transactionnellement. Réemploi borné, pas sauvegarde fraîche promotion R61."),
    ("R60", "Migration/rollback isolés et concurrence DDL", "PASS", "T01",
     "CI exacte :34 simulations déploiement,16 migration,7 promotion/rollback et SQL canonique réel. checkpoint-concurrency.json :2sessions55P03/rollback exact3fonctions. Aucune modification production T08."),
    ("R61", "Reçu de sauvegarde fraîche au snapshot de recette", "PASS", "T01",
     "Nouveau reçu T01 exécuté15oct01:10UTC : snapshot partagé,141 tables/comptages exacts,4contrats schema. Copie et hash t01-backup-restore-20261015.json vérifiés. PASS daté ; revalider fraîcheur/liaison au candidat au moment de toute promotion, aucune promotion autorisée ici."),
    ("R62", "Restauration complète identités/sessions/blobs cohérents", "NON TESTÉ", "T01",
     "Reçu exclut Supabase auth complet et gel atomique blobs ; aucune preuve de restauration complète. Copie isolée partielle ne ferme pas cette exigence."),
    ("R63", "Migration/rollback réellement appliqués en production", "NON TESTÉ", "T01",
     "Aucune migration/promotion/rollback production exécuté ou autorisé à T08. Simulations/copie isolée R60 restent distinctes."),
    ("R64", "Révocation confirmée rejouée sans second DELETE", "FAIL", "T06/T01",
     "T06 signale nouveau rouge15oct dans son handoff : répétition après confirmation émet un second DELETE. Fixture dédiée test-t06-final-social.mts ; correction auteur non intégrée. T08 ne recopie/modifie pas son test."),
    ("R65", "Révocation purge les anciens champs tokens", "FAIL", "T06/T01",
     "T06 signale deux nouveaux rouges15oct : champs tokens historiques persistent après revoke, confirmé ou non. Fixtures synthétiques seulement ; correctif réservé social-account-revocation.ts, retest intégré requis."),
    ("R66", "Droits clients : colonnes financières/statuts protégés", "FAIL", "T01 SQL",
     "T01-SQL-01 : copie privée restaurée du runtime courant,3 mutations injustifiées commission/referral/concours sous authenticated, rollback total. Reçu t01-rls-write-red.json. Défaut du schéma constaté, pas prétendu retest SQL3855665 ; correctif canonique T01 en cours."),
    ("R67", "Historique OAuth durable après révocation et reconnexion", "FAIL", "T06/T01 SQL",
     "T06-HISTORY-01 :0PASS/1FAIL history-contract, première autorisation perdue à la reconnexion. Routes réelles avec DB/transport simulés, reçu conservé. Correction bloquée au contrat SQL atomique T01 ; aucune acceptation personnelle en cause."),
    ("R68", "Export CPU : concurrence et délai total bornés", "FAIL", "T05/T01",
     "T05 sur49c166d :5 défauts concurrence2/1, minimum fractionnaire0, attente/téléchargement/découverte encodeur sans timeout. Correctif local44cbbab,34PASS et17MP4 CPU réels, non intégré ; référence3855665 reste FAIL sur ces cas."),
    ("R69", "UI sociale : panne/timeout explicites et reprise", "FAIL", "T07/T01",
     "T07 Chromium375/1440 :5FAIL/1PASS,503 devient faux0compte, retry absent, délai non borné. Reçu social-before-chromium copié. Correctif WIP non intégré, backend T06 distinct."),
    ("R70", "Dialogue de révocation : nom accessible et focus", "FAIL", "T07/T01",
     "T07 dialog-before-chromium :2FAIL/1PASS, nom accessible vide et focus initial absent. Test clavier sur identité synthétique ; reçu copié, correctif réservé T07."),
    ("R71", "Formulaires connexion/inscription : double soumission et clavier", "FAIL", "T07/T01",
     "T07 before-chromium :6FAIL/12PASS à375/1440. Deux requêtes auth au lieu de1 pour double soumission ; bouton visibilité mot de passe signup hors Tab. Reçu conservé, correctif propriétaire non intégré."),
    ("R72", "Reprise : validation terminale et intégrité checkpoints voix", "FAIL", "T03/T01",
     "T03 FINAL-DURABLE-DELTA : résultats terminaux non nuls invalides acceptés, checkpoint pending non promu, checkpoint voix corrompu accepté. before-new.json exit1 avec hashes produit49c166d ; corrections réservées, migration QA à T01, pas de vert intégré présumé."),
]
for rid, requirement, status, owner, evidence in additional:
    rows.append(dict(id=rid, requirement=requirement, status=status, owner=owner, evidence=evidence,
                     candidate=SHA, previousStatus="nouveau contrôle ciblé"))
counts = dict(Counter(row["status"] for row in rows))
result = dict(candidate=SHA, observedAt=datetime.now(timezone.utc).isoformat(), counts=counts,
              verdict="NON PRÊT aux essais réels ; référence non finale, défauts ouverts, aucun ACK de promotion",
              directTests=dict(passCount=62, fail=1, skipped=0), proofVerification=dict(passCount=99, fail=0),
              requirements=rows,
              limitations=["FAIL propriétaire distingué du FAIL reproduit directement T08.",
                           "Preuves CI exécutées sur SHA exact puis artefacts vérifiés ; aucune exécution locale fictive déclarée.",
                           "NON TESTÉS réévalués, jamais transformés en PASS/skip.",
                           "Nouveau candidat15oct nécessite retests des deltas intégrés."])
(OUT / "matrix.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
text = "# Matrice indépendante T08 — référence3855665,15oct\n\n"
text += "**NON PRÊT aux essais réels.** Nouveau candidat intégré15oct non fourni ; correctifs propriétaires en cours.\n\n"
text += f"{counts} ; {len(rows)} exigences.62 tests directs PASS/1FAIL/0SKIP ;99 contrôles de provenance PASS. Compteurs non additionnés aux familles CI qui se recouvrent.\n\n"
text += "PASS = preuve exécutée dans le périmètre nommé ; FAIL = défaut reproductible ; BLOQUÉ = dépendance précise ; NON TESTÉ = absence de preuve réelle ; N/A = hors périmètre effectif (aucun N/A artificiel).\n\n"
text += "| ID | Exigence | Statut | Preuve et limites | Propriétaire |\n|---|---|---|---|---|\n"
for row in rows:
    text += "| " + " | ".join(str(row[key]).replace("|", "/") for key in ("id", "requirement", "status", "evidence", "owner")) + " |\n"
(OUT / "MATRIX.md").write_text(text)
print(counts, len(rows))

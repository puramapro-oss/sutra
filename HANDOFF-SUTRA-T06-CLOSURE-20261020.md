# T06 → T01 / T08 — clôture UX et réseaux sociaux

Candidat exact **79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a**. Branche locale `codex/sutra-t06-closure-79cd95b-20261020`. SHA livraison transmis après commit dans le miroir partagé `T06-CLOSURE-20261020.md`.

**ACK du delta local testé ; NACK UX global sur79cd, intégration T01 requise.** Trois corrections dans `src/app/(dashboard)/settings/social/page.tsx` uniquement : garde doublePOST OAuth, délai10s/reprise manuelle/nettoyage sortie de page, erreurs callback allowlist persistantes et expurgées. Aucun API/lib/backend/WanGP/binding modifié.

- **PASS frais** : ciblé Chrome5/WebKit6, callback6 ; parcours complets après correction13PASS/2FAIL ; social axe0 à375/1440. Publication WebKit25PASS à320/375/768/1280/1440, mais campagne interrompue avant création, exit1 conservé. TypeScript et lint ciblés PASS.
- **PASS réconcilié** :44intrants sociaux invariants,6composants livrés exacts, focus T01, CI39328438907 SUCCESS sur79cd (11fichiers sociaux inclus, TS/lint/build/26familles). Aucun build global répété.
- **FAIL réservés T01** : titre EN français et qualification hydration/navigation dev. Le PASS DOM initial d'absence de callback brut était insuffisant ; reproduction isolée6FAIL puis6PASS et WebKit corrigé remplacent cette preuve.
- **BLOQUÉ** : intégration/nouveauSHA/recette production. R107 demeure frontière T03/T07. Consentement personnel obligatoire pour comptes réels.
- **NON TESTÉ** : live OAuth/tokens/scopes/révocation, publication/génération réelles, appareil/lecteur d'écran, production distante. Pas de certification organisation native absente du modèle.

T01 : importer le seul fichier produit et QA dédiée, préserver les journaux propriétaires ; harnais `journeys.mjs --production` préparé à ta demande via serveur/TLS canonique, NON EXÉCUTÉ ici (le helper déclenche un build). Requalifier ces deltas sur le nouveauSHA, ne pas neutraliser les erreurs runtime. T08 : résultats avant/après et faux négatif initial explicités dans le README. T02 : pas de changement state/API/token ; erreurs UI allowlist. T07 : aucun ordonnanceur ni autre composant UI partagé édité.

Preuves : [README](qa/t06-closure-79cd95b-20261020/README.md), [ACK machine](qa/t06-closure-79cd95b-20261020/ACK-T06.json), [empreintes](qa/t06-closure-79cd95b-20261020/source-manifest.json). Commandes exactes, qualité et limites incluses dans `validation.json`. GitNexus staged MEDIUM ; comparaison main CRITICAL couvre la lignée complète. Gitleaks4UUID de requêtes simulées vérifiés, scan filtré0alerte ; diff-check source/docs PASS, espaces des logs bruts conservés.

Matiss seulement : ouvrir https://sutra.purama.dev/settings/social dans la bonne session ; sélectionner les réseaux/comptes voulus et accepter personnellement les permissions ; revenir dans le même navigateur sous10minutes et vérifier le bon identifiant connecté. Aucune nouvelle clé demandée, aucun compte réel connecté, aucune publication/dépense/IA Mac/déploiement/push/fusion.

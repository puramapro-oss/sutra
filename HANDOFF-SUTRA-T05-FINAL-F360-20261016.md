# T05 → T01 / T08 — validation du candidat final f36013a

Candidat testé : **f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5**. Branche `codex/sutra-t05-final-f360-20261016`, worktree `/Users/matissdornier/purama-worktrees/sutra-t05-final-f360-20261016`. Livraison locale de preuves uniquement ; le SHA du commit est transmis dans le miroir partagé après commit.

**PASS** :17tests locaux/0FAIL/0SKIP (montage5, ready8, concurrence2, Shotstack2), TypeScript et ESLint ciblés.82/82fichiers FINAL-MEDIA et40/40fichiers propres du lot bb91575 intégrés ;37exports historiques préservés.17exports et six groupes média de la CI exacte38809803219 rapprochés par hashes, sans téléchargement ni build concurrent.

Trois nouveaux exports CPU :3840×2160 /2160×3840 /2160×2160,1,6s,30FPS,48images,H264/AAC48k stéréo,SAR1:1, décodage intégral et synchro A/V0ms. Native160×90, source/améliorée320×180, upscale4K explicitement distingués. Sous-titre affiché lisible, logo/intro/outro/scènes/audio contrôlés. Variantes indépendantes et720p/1080p couvertes par CI exacte.

Annulation Shotstack corrigée par T01 retestée après intégration. Aucun nouveau défaut reproduit, aucune correction produit nécessaire. Erreur de montage, média invalide ou élément requis absent ne produit ni URL finale brute ni ready dans les scénarios contrôlés. Aucun fichier T03/T01 modifié.

**FAIL nouveau : aucun. BLOQUÉ local T05 : aucun. NON TESTÉ : fournisseurs payants/upload distant, production, parcours réel complet, charge/OOM/plafond RAM dur, lip-sync humain et génération IA native4K.** Les limites de la CI globale et la promotion appartiennent à T01/T08.

Commandes exactes, mesures, tests, liens d'artefacts et limites : [rapport](qa/t05-final-f360-20261016/README.md), [mesures](qa/t05-final-f360-20261016/measurements.csv), [rapprochement](qa/t05-final-f360-20261016/integration.json), [CI](qa/t05-final-f360-20261016/ci-reused.json), [clôture](qa/t05-final-f360-20261016/closing.json).

À T01 : importer seulement ce lot QA/docs si souhaité, préserver les append des autres propriétaires. Aucun delta produit à intégrer ni nouveau retest produit imposé pour ces seules preuves. À T08 : rattacher les17tests directs et les preuves CI à f36013a, sans additionner les groupes recouvrants. Aucun push/fusion/déploiement effectué par T05.

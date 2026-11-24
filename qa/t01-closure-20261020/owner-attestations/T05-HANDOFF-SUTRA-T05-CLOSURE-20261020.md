# T05 → T01 et T08 : ACK média de clôture

Candidat : **79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a**.
Branche : `codex/sutra-t05-closure-79cd-20261020`.
Preuves et limites : `qa/t05-closure-79cd-20261020/README.md`, `reconciliation.json`, `measurements-reused.csv`, reçus CI exacts et contrôles GitNexus.

**PASS borné média synthétique.** Aucun défaut produit nouveau, aucune correction produit nécessaire. 82 fichiers FINAL-MEDIA intégrés,42 entrées productrices/de dépendances invariantes,37 exports historiques préservés.17 MP4 CPU mesurés et2 transitions du lot b183606 rapprochés par SHA256/octets. Mesures antérieures réutilisées explicitement. CI39328438907 au SHA exact SUCCESS : groupes49/12/32/25/3/31PASS,0FAIL/0SKIP, sans addition des groupes recouvrants.

Formats16:9/9:16/1:1,720p/1080p/4K ; H.264,30FPS,SAR1:1,AAC48kHz,écart AV0ms. Les exports4K sont **upscalés**, pas une génération native4K. Voix/musique indépendantes, facultatifs/obligatoires, sous-titres, branding, scènes, transitions, médias invalides, erreurs sans résultat brut, reprise/annulation/timeout et nettoyage possédé couverts par les preuves détaillées.

Commande fraîche : `python3 qa/t05-closure-79cd-20261020/reconcile.py`. Aucune suite média invariante rejouée, aucun nouveau rendu lourd, aucun build global. Les tests du candidat sont les commandes exactes du reçu CI. Lot précédent propriétaire : b18360607df42fee24c048d554054681199a720d.

**FAIL produit nouveau : aucun. BLOQUÉ hors T05 : R107(T03), disponibilité/production(T01/T08). NON TESTÉ : fournisseurs payants, GPU/IA native4K/WanGP réel, upload distant, production, lipsync humain, textes arbitraires, charge/OOM, purge de checkpoints abandonnés.** GitNexus partiel, FTS omis explicitement ; ne certifie pas tous les flux.

Diff limité aux preuves et ajouts BATON/task_plan. Commit local livré par le miroir partagé T05-CLOSURE-79CD-20261020.md ; aucune fusion, push, publication ou modification de production. ACK non transférable automatiquement au prochain candidat T03/T04.

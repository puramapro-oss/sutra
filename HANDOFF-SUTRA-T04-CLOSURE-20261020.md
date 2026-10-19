# Handoff T04 vers T01 et T08 — clôture fournisseurs20/10

Base exacte : **79cd95bfdb3e5837e2a78e45efaea444cb8dcf8a**. Branche `codex/sutra-t04-closure-79cd-20261020`, worktree `/Users/matissdornier/purama-worktrees/sutra-t04-ack-ab935-20261019`. Le SHA du présent commit sera transmis dans le miroir partagé après commit, sans auto-référence impossible.

**NACK propriétaire du candidat79cd pour trois défauts musicaux reproduits et confirmés par T08. ACK du correctif local testé, pas de certification anticipée du futur candidat intégré.**

À intégrer :

- `src/lib/stable-audio.ts` : succès terminal strict, validation durée/ID/URL; refus de replay et erreur conservant le job.
- `src/lib/riffusion.ts` : réponse imbriquée MusicalAPI + compatibilité du format plat, polling13s, borne délais/corps, identité/statut/erreurs contrôlés.
- `src/lib/music-provider-job.ts` : transport partagé borné, diagnostics expurgés, erreur/provenance sans coûts inventés.
- `src/lib/fallbacks.ts` : seul import et catch de `generateMusicWithProvenance`, propage l'erreur connue. Aucun fallback payant ajouté.
- `qa/t04-closure-79cd-20261020/**`, présent handoff, seuls append auteurs de `BATON.md`/`task_plan.md`. Ne pas écraser les journaux T01.

T01 doit enregistrer `music-contracts.test.mts` et `music-provenance.test.mts` de ce dossier dans son runner CI, puis publier le nouveau SHA/CI à T08. Rien à réintégrer pour ElevenLabs :6d7d75a déjà intégré à blob exact; correctif stock62bb57f également intégré. Coverr config/admin-health déjà corrigés par T01. Alerte Pollinations documentée au propriétaire T03/T01, aucun appel ni modification pipeline/UI.

Tests : rouge3FAIL sur79cd; régressions119PASS, puis nouveautés finales41PASS (recouvrement, ne pas sommer), TypeScript et lint ciblé PASS. CI existante39328438907 réutilisée pour le code inchangé. Secrets non lus, réseau externe bloqué pendant tests, aucune génération, aucun GPU, build global, push, fusion ou déploiement. Rapport complet, matrice fournisseur, variables par NOM et protocole réel : [preuves](qa/t04-closure-79cd-20261020/README.md).

Blocages historiques19/10 non réinterrogés : Salad/Pexels configuration malformée; scopes Salad absents; ElevenLabs401 `invalid_api_key`; Pixabay/Coverr facultatifs absents. RunPodhealth, Shotstackstage/v1 et SunoAPIcrédits200 ne prouvent aucune génération. GPU/image/modèle et coût réel NON TESTÉS. Aucun correctif supplémentaire de compte ne peut être prouvé sans nouvelle lecture coordonnée par T01.

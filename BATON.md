# BATON — SUTRA T04, reprise intégrée du 2026-10-12

Branche `codex/sutra-t04-providers-final-20261012`, worktree isolé homonyme sous `purama-worktrees`. Base T01 `589732cb49959c1a576a3ba381b310cd594600ac`, commit produit `449150e4daa6e9e608b6b2ee0a490ca626d311bd`. Le commit contenant ce BATON ajoute les documents/preuves ; pointeur coordinateur pour le SHA final poussé.

DELTA_T04_LOCAL_VERIFIE. Cinq défauts corrigés : checkpoint absent refusé, wrappers d'une même scène sérialisés, aucune substitution stock/WAN avec intention LTX, ID valide conservé malgré acceptation malformée pour GET uniquement. Propriété fournisseurs exclusivement ; checkpoint T03 et protections T02 conservés.

Gates fraîches : 432 contrats PASS/7 SKIP (+ schedule/composition/publication), 33 médias PASS après binaire FFmpeg T01, typecheck PASS, lint 0 erreur/111 warnings, build 197 pages PASS avec vraies polices mises en cache hors réseau. Tests ciblés 147 PASS inclus dans les contrats. Premiers échecs d'environnement archivés. Aucun appel payant/déploiement/secret/DB distante ; garde anti-preview de la seule branche T04.

Handoff courant : HANDOFF-SUTRA-T04-20261012.md ; preuves et hashes committés : qa/t04-final-20261012/manifest.json. Handoff T01 conservé pour les preuves historiques inchangées (SQL/browser/legacy non rejoués). GitNexus tronqué, impacts initiaux HIGH/CRITICAL pris en compte ; aucun certificat global.

Prochain pas : coordinateur accepte le delta produit depuis la base exacte et fusionne les seuls documents/gardes concurrents. Limites : providers live/coûts réels et runtime distant non qualifiés, webhook/annulation distante LTX non documentés, journaux crash-safe de bout en bout WAN/voix/musique non prouvés. Ne pas rejouer les PASS inchangés ni redévelopper S5. Aucun déploiement dans ce mandat.

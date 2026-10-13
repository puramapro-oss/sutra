# Revue lecture seule de la promotion f770e272

**Aucun risque reproductible identifie dans le script actuel et ses preconditions disponibles.** Empreinte exacte dans `promotion-review.json`. Le script principal et ses deux blocs Python distants compilent ; aucune execution du script, aucun SSH, aucune mutation de production pendant cette revue.

- CI verrouillee au run `38330861913`, au SHA exact `f770e272d2d8e3bb3dde5b523fe7aa37f122399d`, terminee en succes et aux trois jobs en succes.
- Candidat PASS avec source exacte ; preuve locale courante 14/14 pour ce meme SHA et image `sha256:956b477deb4b7049914db5f51d934cf15fb0c3ea5fe289d6029c23b4c599e417`.
- Helper commun verrouille par SHA256. Avant snapshot : image de production exactement egale a celle du precedent deploiement 3e, conteneur healthy. Snapshot cree exclusivement (mkdir sans exist_ok), permissions fermees, Compose/runtime copies opaquément, marqueur complete en dernier.
- Avant mutation : Compose/runtime identiques au snapshot, imageId candidate et label commit exacts, changement limite a l'unique champ image Compose, resolver TLS conserve, config Compose validee avant remplacement.
- Promotion sans dependances ni pull ; sante et image effectivement utilisee controlees. Smokes internes/publics, 28 gardes origine, 120 assertions SQL read-only et comparaison opaque du runtime constituent les postconditions.
- Toute exception dans la promotion/postvalidation appelle le rollback Compose/runtime, qui attend le retour healthy avant receipt PASS. Si le rollback echoue, il leve une erreur et aucun faux PASS n'est ecrit. Schema et DNS inchanges par cette procedure.

Limites de cette revue : pas de resultat de la CI encore en cours revendique ; pas de nouvelle restauration base ni rollback reel declenche pour la revue. Le script ne doit etre lance qu'apres ses propres gates ; le snapshot exclusif empeche une relance aveugle apres un essai interrompu.

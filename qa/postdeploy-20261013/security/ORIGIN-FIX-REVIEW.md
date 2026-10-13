# Revue lecture seule de la correction origine publique

Verdict de revue : **aucun defaut reproductible identifie dans le diff**. Cette revue ne remplace pas le controle de l'image construite ni les sondes apres deploiement. Empreintes exactes des quatre fichiers examines : `origin-fix-review.json`.

- `publicOrigin` selectionne une configuration serveur, avec precedence `NEXT_PUBLIC_APP_URL`, puis `NEXT_PUBLIC_SITE_URL`. Il normalise l'origine et rejette protocole non HTTP(S), userinfo, chemin, query et fragment. Aucune confiance ajoutee aux headers Host/X-Forwarded-Host/X-Forwarded-Proto.
- Le callback conserve `safeNextPath`, les branches d'erreur generiques et les ecritures de cookies existantes. Seule la base des redirections change. Les codes OAuth et erreurs distantes ne sont pas exposes.
- Le middleware accepte l'Origin publique configuree, refuse les origines etrangeres et `null`, et garde le support API sans Origin. Le comportement sans Origin existait avant ce diff ; aucun assouplissement introduit.
- Les redirections du middleware reconstruisent pathname/search/hash sur l'origine configuree. Les cookies rafraichis sont copies comme avant, avec les memes options. Les decisions d'authentification, de role et de revocation ne changent pas.
- Sans configuration, le fallback `requestUrl.origin` conserve le mode local precedent. Avec configuration invalide, la fonction echoue explicitement ; une configuration valide demeure requise pour les instances derriere proxy.
- Les sept tests ajoutes couvrent callbacks succes/erreur, cookies, CSRF des quatre verbes, origine interne, host/proxy forgés, fallback local et redirections des roles. Le chef annonce 7/7 PASS ; je n'ai pas rejoue cette preuve verte inchangee.

Aucune correction produit, aucune nouvelle sonde publique ni installation/build effectue. Apres promotion, verifier l'origine publique effectivement incorporee dans l'image et les deux erreurs historiques, sans effacer les JSON d'echec initiaux.

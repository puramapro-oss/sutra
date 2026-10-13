# HANDOFF SUTRA T06 — reprise fournisseurs et audit social

13 octobre 2026. **COMPLÉMENT T06 TERMINÉ ; FOURNISSEURS/OAUTH BLOQUÉS.**

- Branche : `codex/sutra-t06-provider-audit-20261013`.
- Worktree : `/Users/matissdornier/purama-worktrees/sutra-t06-social-autonomy-20261012`.
- Base : `48f2d5e9e45a2a49e267a8b5b3a57834b7bac1f4`, descendante du commit demandé `589732cb49959c1a576a3ba381b310cd594600ac`.
- Scope : documentation/preuves T06 et garde Vercel de cette seule branche. Aucun symbole produit édité, aucun test partagé rejoué, aucune sonde fournisseur/VPS doublonnée. Les lots produit T02/T05 restent sur leurs branches ; aucun merge.
- Livraison précédente T06 conservée : `b2ec2eca250948fdb1012ada36829c0296ccab4e`, code `d4238596abb84a88f84e3c3e49f3a46aed44fd0d`, intégrée dans la base. `HANDOFF-SUTRA-T06-20261012.md` inchangé.

## Fichiers et preuves

`qa/t06-provider-audit-20261013/README.md` : verdicts RunPod/Shotstack/Suno/Zernio, provenance opaque, Mac/OVH, limites et actions utilisateur avec liens officiels.

`qa/t06-provider-audit-20261013/SOCIAL-AUDIT.md` : état OAuth, scopes, profil/session/organisation, expiration/rotation/révocation, idempotence et publication partielle ; matrice exacte des consentements.

`qa/t06-provider-audit-20261013/source-manifest.json` : snapshots propriétaires datés et hachés, 752 fichiers produit/tests/config identiques à T01/T08. Les autres fichiers du dossier sont les preuves expurgées T01/T04/T08, le contrôle GitNexus et `validation.json`. BATON/plan locaux actualisés. `vercel.json` ajoute uniquement `deploymentEnabled=false` pour cette branche avant le push déjà autorisé.

## Résultats et blocages réels

- RunPod : GET endpoints/health **401**, Mac/OVH, après normalisation en mémoire ; action utilisateur sur clé/permissions.
- Shotstack : deux clés × stage/v1 **403**, Mac/OVH ; mauvaise clé/désactivation/restriction non départageables. Sélection de clé production corrigée par T05 séparément.
- Suno : base legacy utilisée par SUTRA **503** sans credential ; authentification tiers `sunoapi.org` **200 HTTP + code200** pour GET crédits (T01). Alias maître inutilisé et contrat incompatible avec SUTRA ; décision fournisseur puis adaptation. Plateforme officielle Suno existante derrière connexion. Fuite d’erreur fournisseur 2xx reproduite par T08 sur cette base ; correctif réservé à T04, non intégré.
- Zernio : GET accounts **200 / zéro compte**, GET profiles T01 **200 / un profil**. Connexion incompatible avec contrat actuel, profil tenant non rattaché, scopes minimaux non transmis, refresh/webhooks non raccordés ; permissions et révocation native non qualifiées. Consentements utilisateur uniquement après correction.
- Maître : six suffixes `\n` parasites non corrigés ; valeurs fournisseurs normalisées concordantes Mac/runtime. Origines APP/SITE maître différentes de SUTRA ; aucune copie aveugle. OVH contrôlé en lecture seule par T04 malgré l'échec SSH d'une tentative T01.

Tests réutilisés sur sources identiques : **480 contrats PASS / 7 SKIP**, schedule/composition/publication PASS ; TypeScript PASS, lint 0 erreur / 111 avertissements. Contre-tests T08 : **1 PASS / 5 FAIL**, conservés rouges. Les correctifs et tests supplémentaires T02/T05 (`312522a8` / `47e49ee9`, poussés par leurs propriétaires) ne sont pas déclarés intégrés. T04 possède le correctif Suno2xx et le diagnostic `env.ts`, encore séparés. Les contrôles T06 sont consignés dans `validation.json` ; graphe GitNexus partiel/périmé explicitement borné.

Aucune publication, génération payante, connexion de compte, rotation de token, modification distante de configuration, migration ou déploiement. Aucun secret lu/copié par T06, source unique maître utilisée par les propriétaires des sondes ; aucun `.env.local` créé.

## Reprise coordinateur

Accepter seulement ce delta documentaire/garde après revue. Traiter les correctifs avec leurs propriétaires ; ne pas effacer les intentions inconnues pour relancer des générations, ne pas perdre les destinations déjà publiées, ne pas fabriquer les consentements TikTok ni une destination Pinterest. Le SHA final et la confirmation distante sont transmis dans `.coord/handoffs/SUTRA-20261012/T06-PROVIDER-AUDIT-COORDINATION-20261013.md` après commit/push ; aucune autorisation de déploiement n'en découle.

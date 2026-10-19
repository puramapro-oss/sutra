# T06 → T01 / T08 — UX et réseaux sociaux

Date : 2026-10-19. Base exacte : **ab935e59ca4e39776630f05b2ba6c0422c74ec62**.
Branche locale : `codex/sutra-t06-ux-social-ab935-20261019`.
Le SHA de livraison est transmis dans `.coord/handoffs/SUTRA-20261012/T06-AB935-20261019.md` après commit. Aucun push/fusion/déploiement.

**ACK T06 du delta local testé ; NACK UX de la base ab935 sans ce correctif.** T01 doit intégrer les six composants réservés, mutualiser la gate production et annoncer le nouveau candidat avant ACK d'intégration. Aucun ACK global/production fabriqué.

- Corrections : accessibilité/focus/modal responsive ; comptes révoqués/expirés/ambigus exclus et identité fixée ; date locale/IANA/DST ; confirmation/brouillon ; reprise des seuls échecs, succès préservé après réponse perdue, incertitude sans second POST ; erreurs expurgées ; double-clic et champs en vol verrouillés ; pied masquant la date mobile corrigé.
- **PASS** :29contrôles Chrome nouveaux, cinq largeurs320/375/768/1280/1440, axe0dans la modale, captures inspectées, aucune erreur client/hydratation observée. TypeScript0erreur ; lint0erreur111warnings préexistants ; lint final ciblé PASS.
- **PASS réconcilié** :46hash/blobchecks,3livraisons exactes,213assertions sociales et418assertions navigateur multiformes sur CI38827288351/ab935. Pas de rejeu global inutile.
- **FAIL base** :9contrôles navigateur rouges avant corrections ; causes et red/green dans le dossier preuve. Le correctif local n'est pas encore intégré par T01.
- **BLOQUÉ** : disponibilité production (T01 : app/DB arrêtées,404). T06 n'a fait aucun restart ni SSH.
- **NON TESTÉ nouveau delta** : build production mutualisé T01, WebKit, lecteur d'écran réel, fournisseur/tokens/scopes réels, média réel/génération/publication. Pas de certification d'une organisation native absente du modèle.

Fichiers produit exclusifs : `src/components/social/PublishEverywhereButton.tsx` et `src/components/social/publish/{PublishScheduleSection,PublishPlatformGrid,PublishCaptionSection,PublishResultsSection,PublishModalFooter}.tsx`. Modal/design system existants réutilisés sans modification. Frontières T02 sécurité/API, T07 ordonnanceur, T09 WanGP et T01 config/intégration intactes. GitNexus : impact enfantsHIGH averti ; graphe partiellement tronqué, pas de garantie exhaustive.

Preuves/commandes/limites : [README](qa/t06-ux-social-ab935-20261019/README.md), [résultats finaux](qa/t06-ux-social-ab935-20261019/verified-chrome/results.json), [empreintes source](qa/t06-ux-social-ab935-20261019/tested-source-manifest.json).

Matiss, après restauration du service par T01 : ouvrir https://sutra.purama.dev/settings/social, choisir les connexions souhaitées, sélectionner personnellement les bons comptes et accepter les permissions chez chaque plateforme ; au retour dans la même session sous10minutes vérifier « Connecte » et le bon compte. Aucun nouveau secret nécessaire, aucun consentement effectué à sa place.

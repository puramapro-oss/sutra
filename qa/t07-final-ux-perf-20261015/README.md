# T07 — UX/UI et performances, 15 octobre 2026

Livraison locale sur `codex/sutra-t07-final-ux-perf-20261015`, base T01 **49c166d4c15412d2a3c1246c216cf0df319f2df0**, code candidat **3855665fa79e3cc2171124d864a834214d6ac617**. Les anciens correctifs T07 `a01c44d` sont déjà intégrés. Le WIP d'intégration T01 et les moteurs des autres auteurs sont préservés. Ce dossier ne certifie ni la production ni un candidat intégrant les nouveaux lots T02–T08.

## Résultat et défauts corrigés

| Défaut reproduit | Cause et correction | Preuve finale |
|---|---|---|
| Double soumission inscription/connexion : 2 requêtes aux deux largeurs | L'état React seul ne verrouillait pas deux événements synchrones. Garde `useRef` et libération en `finally` ; OAuth inchangé | Chromium auth22 PASS ; WebKit requêtes uniques, clavier ciblé4 PASS |
| Bouton de visibilité du mot de passe d'inscription inaccessible par Tab | `tabIndex=-1` retiré, état `aria-pressed` explicite | Clavier Chromium375/1440 et WebKit Alt+Tab375/1440 |
| API sociale503 présentée comme zéro compte ; attente sans borne | Chargement/erreur/données distincts, validation de réponse, alerte persistante et reprise, abort10s, requête unique | Chromium social10 PASS ; WebKit9 fonctionnels PASS |
| Déconnexion sans nom accessible ni comportement modal complet | Réutilisation du composant Modal existant : titre, focus initial Annuler, confinement, Escape, restitution du focus | Dialog simulé et scans visuels375/1440, Chromium/WebKit |
| Planification : double PATCH, brouillon effacé sur503, erreur de lecture masquée | Verrou synchrone, deadline10s, brouillon/ID conservés en résultat incertain ; reprise manuelle sans nouvel ID, liste conservée après suppression refusée | Chromium9 PASS ; WebKit8 fonctionnels PASS |
| Heure sans nom accessible, texte AutoLayout insuffisamment contrasté | Label de l'heure, fuseau Europe/Paris explicite, état des jours, retour à la ligne des noms longs et opacité70 | Axe375/1440 sans violation sur les états testés ; ancien ratio3,72:1 |
| Sous-titres ajoutés/modifiés/supprimés non annulables ; narration initiale perdue ; première édition après undo ignorée | Historique explicite dans les trois handlers, même narration initiale pour UI/historique, retrait du drapeau qui ignorait la première édition après undo | Éditeur Chromium5 PASS + WebKit5 PASS, dont branches après undo/redo |

Les fuseaux IANA, récurrences, IDs persistants et contrats serveur ne changent pas. Aucun export ni journal de publication backend modifié. Le diff `handleExport` est vide malgré son inclusion dans le résultat GitNexus par recouvrement des lignes du symbole parent.

## Conditions d'exécution et commandes

Node24, Next16.3.8, React19.2.4, Playwright1.58.2 ; Chromium et WebKit26.0r2248 installés. Viewports375×900 et1440×900 (contexte initial375×812), locale fr-FR, mouvements réduits. Il s'agit de navigateurs réels sur Mac avec viewports mobiles, pas d'un appareil iOS physique.

`run.mjs` réutilise les fixtures et les composants opérationnels T01/T07. Identité `legal-test@example.invalid`, base locale jetable, quatre consentements explicites via la vraie route légale. Les appels payants sont interceptés ; aucun secret ni `.env` lu. Les mutations non prévues sont refusées, le réseau serveur est borné au loopback par `qa/t08/offline.cjs`. Aucun compte réel, publication, génération ou achat. Les reçus conservent les résultats bruts, les mutations inattendues et les destinations bloquées.

Préfixe exact des commandes locales :

```sh
NODE=/Users/matissdornier/.npm/_npx/387698761821791d/node_modules/node/bin/node
Q=qa/t07-final-ux-perf-20261015
```

Reproductions ciblées : `"$NODE" "$Q/run.mjs" --baseline`, puis variantes `--baseline --social`, `--baseline --social --dialog-only`, `--baseline --planning`, `--baseline --editor --webkit`. L'option baseline nomme le dossier de sortie ; elle ne restaure pas le code. Les reçus rouges ont été obtenus avant les corrections correspondantes. Pour reproduire un ancien défaut, utiliser le fichier produit de la base49c166d dans une copie isolée.

Validation finale :

```sh
"$NODE" "$Q/run.mjs" --production-suite
"$NODE" "$Q/keyboard-regression.mjs"
"$NODE" "$Q/run.mjs" --production-delta
"$NODE" "$Q/keyboard-probe.mjs"
"$NODE" "$Q/webkit-navigation-probe.mjs"
"$NODE" node_modules/typescript/bin/tsc --noEmit --incremental false
"$NODE" node_modules/eslint/bin/eslint.js 'src/app/(auth)/login/page.tsx' 'src/app/(auth)/signup/page.tsx' 'src/app/(dashboard)/auto/layout.tsx' 'src/app/(dashboard)/auto/schedules/page.tsx' 'src/app/(dashboard)/editor/[id]/page.tsx' 'src/app/(dashboard)/settings/social/page.tsx' src/components/settings/social/DisconnectConfirmModal.tsx src/hooks/useEditorHandlers.ts src/hooks/useEditorHistory.ts
"$NODE" node_modules/eslint/bin/eslint.js qa/t07-final-ux-perf-20261015/*.mjs
```

`keyboard-regression.mjs` a été lancé pendant le serveur production du premier run : il lit `production-chromium/owned-server.json` et nécessite ce serveur actif. Ne pas le relancer contre un port périmé. Les deux runs production construisent chacun une seule fois : le second est justifié par la correction de l'historique découverte dans le premier. Aucune suite backend ou gate globale inchangée n'a été rejouée. Le dernier build produit est PASS : compilation7,6s, TypeScript3,1s,198 pages, serveur prêt63ms. Typecheck final et lint produit PASS ; logs vides = sortie0. L'ancien lint mixte rouge contenait trois `console.log` du harnais, corrigés ; il est conservé.

## Verdicts exacts (ne pas additionner les recouvrements)

| Reçu | PASS | FAIL brut | Interprétation |
|---|---:|---:|---|
| production-chromium/chromium/final |22|0| Auth, erreurs, double soumission, clavier, axe |
| production-chromium/chromium/social |10|0| Chargement, délai, retry, révocation simulée, modal |
| production-chromium/chromium/planning |9|0| Sauvegarde, réponse perdue, ID stable, brouillon, labels |
| production-chromium/webkit/final |18|4| Quatre attentes Tab du harnais ; contrôle HTML natif établit Alt+Tab sur ce WebKit |
| keyboard-webkit-regression |4|0| Les quatre mêmes interactions corrigées dans le harnais, même build |
| production-chromium/webkit/social |9|1| Fonctionnel PASS ; garde générique pageerror rouge sur navigation forcée |
| production-chromium/webkit/planning |8|1| Même diagnostic |
| production-chromium/webkit/journey |33|1| Parcours et sécurité UI PASS ; même garde générique |
| production-chromium/webkit/private-download |8|1| Téléchargements simulés PASS ; même garde générique |
| production-chromium/webkit/extra |28|3| Deux vrais défauts undo corrigés ensuite ; une garde générique |
| delta-production-chromium/chromium/editor |5|0| Sous-titres et script après correction |
| delta-production-chromium/chromium/visual |3|0| Erreurs/modal : capture après animation et axe |
| delta-production-chromium/chromium/navigation |3|0| Navigation normale et contrôle forcé |
| delta-production-chromium/webkit/editor |5|0| Sous-titres et script après correction |
| delta-production-chromium/webkit/visual |2|1| Contrôles visuels PASS, garde générique rouge |
| delta-production-chromium/webkit/navigation |2|1| Navigation normale PASS sans erreur ; contrôle forcé rouge |

Les commandes production terminent donc avec code1 : aucune prétention de gate entièrement verte. `verification.json` recense aussi les runs intermédiaires. Le diagnostic ciblé localise toutes les erreurs du dernier test navigation WebKit à `hard-navigation-control` : annulation de fetch pendant `page.goto`. `webkit-navigation-probe-pagehide.json` reproduit le même message « due to access control checks » dans une page HTML sans SUTRA/React/Next, avec fetch sur pagehide et catch explicite ; Chromium n'émet pas cette erreur. Les erreurs ne sont pas filtrées dans la gate. Cela démontre un comportement du banc/moteur lors du déchargement, sans certifier tous les usages de Safari.

Les anciens échecs de navigation en développement (HMR/attente de session), le mauvais heading du premier harnais éditeur et les premières attentes de suppression incorrectes sont conservés. Les tests production ciblés les remplacent comme preuve finale ; ne pas les présenter comme autant de défauts produit.

## Parcours couverts et mesures

Connexion/inscription simulées, consentement explicite, bibliothèque vide, dashboard503/reprise, navigation, brief manuel en six étapes, formats, choix du mode API/personnel, fournisseur absent, GPU distant désactivé, coût estimé visible, crédits absents402 distincts, progression queued/processing/done avec deux polls simulés, reprise incertaine avec même intention, cinq onglets éditeur, export indisponible, résultat non vérifié/proof incohérente, téléchargement vérifié sans nouveau rendu,307 privé/corps corrompu/HTML/refus/délai, réglages sociaux sans compte/OAuth indisponible/révocation simulée, planification en erreur et réponse perdue. Clavier, noms accessibles, modal/focus, scans axe et débordements testés à deux largeurs. Pas de preuve VoiceOver ni de rendu ou fournisseur réel.

| Mesure comparable | Avant | Après |
|---|---:|---:|
| Double submit auth, réponse simulée350ms,375/1440 |2 requêtes|1 requête (-50%)|
| Double clic création planning375 |2 PATCH, brouillon perdu|1 PATCH, brouillon conservé|
| API sociale suspendue16s |Pas d'erreur visible après12s|Abort10s, alerte observée10 890ms Chromium /10 883ms WebKit|
| Sauvegarde planning sans réponse |Absence de borne dans le code initial|1 requête ; erreur10 899ms Chromium /10 903ms WebKit ; ID conservé pour reprise manuelle|

Le baseline navigateur planning1440 a été interrompu par le harnais : aucune mesure avant/après desktop inventée. Le défaut GET503 planning a été établi par lecture du code puis contre-test, pas par une capture initiale réussie.

Mesures locales après correction en build production, incluant les ressources de test/axe : Chromium signup375 DCL91ms,411644 octets transférés,28 ressources ; signup1440 DCL39ms,411329 octets,27 ressources ; login375 DCL24ms,412759 octets,29 ressources ; login1440 DCL20ms,412758 octets,29 ressources. WebKit DCL34–48ms selon page/largeur. Détails dans `metrics.json`.

Les DCL dev avant/après (signup375775→1078ms ;144098→144ms ; login375232→126ms ;1440131→115ms) comprennent compilation/cache différents : **aucun gain de chargement n'est attribué au correctif**. Le temps `recoveryMs` inclut une attente explicite800ms du test ; ce n'est pas une mesure INP. Pas de benchmark public/LCP/INP, de profil GPU ou d'optimisation spéculative d'images. Les réductions de requêtes sont la seule amélioration de performance comparable affirmée.

Captures réellement inspectées : `production-chromium/chromium/final/signup-375.png`, `production-chromium/chromium/planning/planning-375.png`, `delta-production-chromium/chromium/visual/social-dialog-375.png`, `delta-production-chromium/chromium/visual/social-error-1440.png`, `delta-production-chromium/webkit/visual/social-error-375.png`, `delta-production-chromium/webkit/editor/subtitles-375.png` et `subtitles-1440.png`. Les autres captures sont disponibles sans prétendre à une revue visuelle exhaustive.

## GitNexus, secrets et limites restantes

Index isolé construit sur49c166d (`gitnexus-index.log`), impacts préalables `impact-*.json` : appels résolus LOW ; routes Next/handlers JSX non résolus UNKNOWN, complétés par lecture directe. `detect_changes(scope=all)` : neuf fichiers,24 symboles,9 flux, risque **HIGH**, signalé avant commit. Le CLI coupe l'affichage des symboles ; le même backend a été appelé pour enregistrer le résultat intégral `detect-changes-full.json`, sans partial/truncated/error. Tous les symboles listés appartiennent aux neuf fichiers réservés. Le comparatif `main` couvre2670 fichiers de l'historique d'intégration, risque **CRITICAL**, tronqué : il ne certifie pas ce lot. Les nouveaux tests ne sont pas indexés ; le graphe n'est pas une preuve exhaustive des frontières Next/React.

Gitleaks expurgé : quatre faux positifs UUIDv4 d'intention synthétique dans le seul reçu journey. `secret-review.json` et `gitleaks-reviewed.ignore` documentent leurs empreintes exactes, aucune règle générale désactivée. Scan revu PASS. Aucun master/env/secret réel utilisé. Tous les processus lancés par ce lot sont arrêtés, voir `owned-processes-final.json`.

- **BLOQUÉ** : Safari27 natif WebDriver HTTP500, automatisation distante désactivée (`safari.json`). Repli CUA interrompu avant navigation à cause de l'activité concurrente de l'utilisateur ; aucun réglage changé (`native-safari/result.json`). WebKit automatisé n'est pas présenté comme Safari natif validé.
- **NON TESTÉ / dépendance T01–T03** : annulation durable de génération. Aucun contrôle d'annulation exposé par `/create` ou `/production`. `src/app/api/production/route.ts:62` accepte `step=cancel`, `requestId` et `targetStep` pour une clé **production** ; `/create` utilise une autre intention. `useVideoGeneration.resetGeneration` interrompt seulement le fetch local. Ne pas raccorder cette commande à une fausse garantie d'arrêt fournisseur. T01/T03 doivent confirmer le contrat d'annulation et la reprise par identité avant ouverture du parcours UI. Backend laissé intact.
- **NON TESTÉ** : appareil iOS physique, Safari natif, lecteur d'écran VoiceOver réel, réseau public/quotas/coûts réels, OAuth personnel, CORS de vrais stockages et gros médias, nouvelles versions backend en cours d'intégration T01.
- T01 doit intégrer les neuf fichiers par diff/blob exact, conserver ses WIP et soumettre le delta au contrôle indépendant T08. Aucun push, fusion, déploiement, migration, publication ou activation de fournisseur par T07.

Contrôle de whitespace avant commit : code, tests et documentation PASS. Le contrôle intégral signale seulement des espaces de fin et lignes terminales dans les logs bruts ; ces preuves sont conservées sans normalisation.

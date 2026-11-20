# T07 — correctifs UI routés par T01, 20 octobre 2026

**PASS local borné ; pas d'ACK global de release.** Candidat T01 `fcd0559f611831a57909c693694b92ccb81eba45`, parent QA T07 `cabae2c155f54d095202df0494e2c17b41339e3d`, branche `codex/sutra-t07-ui-fcd-20261020`. Les 65 fichiers produit figurent avec leurs empreintes avant/après dans `source-manifest.json`.

T01 a attribué les 51 routes de `owner-routing.json` à T07. Réservations nominatives et extensions dans les deux LOCKS partagés avant édition. T06 conserve la publication ; T02 conserve le composant juridique `/ma-memoire`. Aucun backend, hook métier, SQL, configuration, dépendance, token CSS global, montant, commission ou texte légal changé. Aucun autre worktree modifié.

## Défauts reproduits et correction

- Contrastes insuffisants, boutons/liens icônes sans nom, quatre sélecteurs Batch sans labels associés et régions défilantes non accessibles au clavier : correction des sélecteurs réellement observés, en conservant les composants et la palette. `contrast-plan.json`, `contrast-applied.json`, `manual-applied.json` et les violations axe avant/après sont conservés.
- `/settings/notifications` annonçait « Preferences sauvegardees » sans aucune requête de sauvegarde. Le GET ne chargeait pas de préférences et les garanties horaires/score étaient des valeurs locales fictives. Reproduction dans `interaction-before/results.json` et capture du faux succès. Faute de contrat backend opérationnel, le rendu annonce désormais l'indisponibilité, explique le bouton désactivé et propose le lien vers les notifications. Pas de faux enregistrement ni de loader permanent. **La personnalisation persistante n'est pas implémentée par ce lot.**
- `/partenaire` et `/partenaire/outils` calculaient l'origine navigateur pendant le premier rendu, contrairement au serveur. Réemploi du hook `useHydrated` existant, sans modification de ce hook. Lien indisponible explicite sans code, copies désactivées, QR non promis ; liens valides encodés et URL autoritative conservée. Le libellé long passe à la ligne sur mobile. Les doubles clics de copie sont testés avec un presse-papiers simulé.
- `/analytics` présentait le solde `profile.credits` comme des crédits utilisés. T01 a confirmé le contrat le 20/10 à 10:55 et autorisé le seul libellé « Solde de crédits ». Valeur, hook `useAnalytics`, nom interne `creditsUsed` et calculs inchangés. Vérification réelle Chromium : historique vide, solde 40 puis 43 aux deux largeurs. Le contre-exemple historique T08 sur le nom interne reste distinct ; le rendu ne parle plus de consommation.

## Recette navigateur gratuite et hors réseau

Chrome installé via Playwright, Next DEV webpack dans ce seul worktree, identité synthétique et véritable parcours de consentement de test existant. Environnement filtré synthétique, garde `qa/t08/offline.cjs`, requêtes externes bloquées, API inconnues à 503, aucune écriture métier autorisée. Pas de connexion OAuth, génération, publication, achat ou secret réel.

Commandes exactes, exécutées depuis la racine du worktree :

```sh
node --require ./qa/t08/offline.cjs qa/t07-ui-fcd-20261020/browser.mjs before
node --require ./qa/t08/offline.cjs qa/t07-ui-fcd-20261020/browser.mjs interaction-before /settings/notifications
node --require ./qa/t08/offline.cjs qa/t07-ui-fcd-20261020/browser.mjs after
node --require ./qa/t08/offline.cjs qa/t07-ui-fcd-20261020/browser.mjs after-targeted /partenariat /partenaire/outils
node --require ./qa/t08/offline.cjs qa/t07-ui-fcd-20261020/browser.mjs after-partner-success /partenariat /partenaire /partenaire/outils
node --require ./qa/t08/offline.cjs qa/t07-ui-fcd-20261020/browser.mjs after-analytics-balance /analytics
node --require ./qa/t08/offline.cjs qa/t07-ui-fcd-20261020/browser.mjs after-analytics-balance-fixed /analytics
```

Chaque exécution conserve ses résultats, logs et captures dans un dossier propre. Les labels déjà existants sont refusés : utiliser un nouveau label pour une reprise. Les modes de fixtures sont sélectionnés par les conditions nommées du harnais ; conserver le mode approprié lors d'une reprise.

| Exécution | Résultat brut |
|---|---|
| Avant, 51 routes × 375/1440 | 2 PASS / 100 FAIL ; 841 observations de nœuds axe, pas 841 bugs distincts |
| Reproduction sauvegarde fictive | 1 faux succès, 0 requête après sauvegarde ; 2 largeurs FAIL accessibilité |
| Après complet | 99 PASS / 3 FAIL ; 14 groupes d'interactions PASS |
| Ciblé après retour à la ligne | 2 PASS / 2 FAIL ; 4 interactions PASS |
| Partenariat stabilisé + partenaire valide | 6 PASS / 0 FAIL ; 6 interactions PASS ; sortie 0 |
| Analytics premier essai | Mobile PASS ; desktop bloqué par `window.axe` absent après rechargement ; sortie 1 conservée |
| Analytics harnais corrigé | 2 PASS / 0 FAIL ; 2 groupes d'interactions 40→43 PASS ; sortie 0 |

Le faux négatif `/partenariat` venait d'une mesure pendant l'apparition d'un ancêtre Framer Motion, après défilement/clavier. Le harnais attend maintenant l'opacité finale calculée de cet ancêtre, sans ignorer une violation axe. Le premier essai Analytics rechargeait la page sans réinjecter axe ; le harnais le réinjecte après chaque nouveau document. Les deux erreurs de harnais et leurs traces restent conservées.

`summary.json` sélectionne explicitement les reçus les plus récents pour chaque route affectée, sans additionner les répétitions : **100 lignes PASS / 2 FAIL, soit 50 routes sur 51 sans violation axe aux deux largeurs**. Les deux FAIL sont le bouton export de `/ma-memoire`, appartenant à T02. **20 groupes d'interactions distincts PASS**, 0 erreur d'hydratation/runtime observée après correction, 0 tentative d'écriture métier. Le run complet bloque 11 requêtes externes ; aucun accès fournisseur n'en résulte. Aucun débordement horizontal mesuré sur les 51 routes aux deux largeurs.

Les captures personnellement affichées sont listées dans `visual-review.json` ; toutes les captures ne sont pas déclarées visuellement certifiées. Le QR distant apparaît bloqué dans la fixture hors réseau : son chargement/téléchargement externe n'est pas validé. Les deux erreurs d'hydratation transitoires DEV observées avant sur contest/karma ne sont pas attribuées au correctif partenaire ni déclarées corrigées par causalité.

## Performance mesurée

Navigation DEV, 51 routes : médiane avant 1001 ms, après 971 ms ; maximum avant 1882 ms, après 1648 ms. Les caches de compilation et la charge ne sont pas contrôlés ; **aucun gain causal de 30 ms ni résultat de performance production n'est revendiqué**. L'amélioration déterministe est la suppression du GET `/api/settings` inutile sur les préférences de notifications : 1 avant, 0 après, avec suppression du faux chargement. Pas d'optimisation spéculative ni de mesure inventée du poids des pages.

## Qualité et provenance

- `node node_modules/typescript/bin/tsc --noEmit --incremental false` : PASS, `typecheck.json`. Après ce contrôle, seules une classe de retour à la ligne et une chaîne de libellé ont changé dans le produit ; les deux deltas ont été lintés et testés dans Chromium.
- ESLint ciblé des 65 sources : sortie 0, 30 avertissements existants conservés ; arguments exacts dans `lint.json`. Derniers deltas et harnais : `lint-final-delta.log`, `lint-analytics-final.log`, `lint-final-harness.log`, sorties 0.
- `node --check qa/t07-ui-fcd-20261020/browser.mjs` et `git diff --cached --check` : PASS.
- GitNexus impact préalable : nombreux chemins non résolus, `UNKNOWN`, index partiel/FTS dégradé. Les recherches non filtrées de certains composants renvoient le même périmètre CRITICAL 169 appelants/26 processus, annoncé avant édition ; aucune certification exhaustive du graphe. Revue directe du périmètre réservé et des appelants.
- `detect-changes --scope staged` : 315 fichiers alors préparés, 2 symboles reconnus (`CookieTable`, `CookiesPage`), 0 processus, LOW. C'est une couverture partielle. `detect-changes --scope compare --base-ref main` : historique complet 6217 fichiers, 3667 symboles, 399 processus, CRITICAL, liste plafonnée. Ce n'est pas le rayon d'impact du seul lot UI.
- Scan Gitleaks expurgé du diff et des preuves : reçu final séparé ; aucun fichier secret lu. Manifeste de livraison explicite, six dossiers GitNexus étrangers non suivis préservés.
- CI T01 `39406352519` sur fcd : manifeste final partagé lu, contrats 1302 PASS/7 SKIP externes hérités, qualité/DB PASS. Preuve attribuée à T01, non rejouée. Elle **ne couvre pas ce nouveau diff UI** ; T01 devra qualifier le nouveau SHA intégré.

## Réserves et suite propriétaire

**FAIL propriétaire T02/T01** : `/ma-memoire`, bouton export `bg-primary`, blanc sur `#a855f7`, ratio 3,95 au lieu de 4,5. Source `src/lib/legal/components/MaMemoirePage.tsx` intacte. T01 a routé la correction à T02. Pas de changement juridique ni d'autorité de consentement par T07.

**BLOQUÉ côté contrat** : personnalisation persistante des notifications absente ; l'interface est désormais explicite. **NON TESTÉS dans ce lot** : Safari/WebKit, appareil physique, lecteur d'écran natif, build production du nouveau diff, QR externe, intégrations réelles, disponibilité 24/7. Axe et clavier ciblé ne valent pas certification d'accessibilité complète.

L'ACK automatisation sur fcd reste livré séparément au commit `cabae2c155f54d095202df0494e2c17b41339e3d` : 42 contrats gratuits PASS, calendrier PASS, 19 SQL CI T1 revus avec provenance. Ses 13 contre-tests SQL T07 sont toujours NON EXÉCUTÉS localement (limite SysV 32/32) ; T01 a réservé leur raccord à la prochaine CI jetable. Aucun nouveau moteur, cron, publication, dépense ou changement T09. Compatibilité WanGP uniquement simulée par le port existant.

T01 importe ce seul delta, lance la gate du nouveau candidat et transmet son SHA ; T07/T08 pourront alors attester les seuls risques affectés. Aucune réception, fusion, intégration ou activation réelle n'est présumée.

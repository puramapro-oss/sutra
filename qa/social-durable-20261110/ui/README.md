# Suivi UI durable — qualification partielle

Le reçu conserve les empreintes des huit fichiers UI/harnais de ce travail et les commandes réellement exécutées. Le lint ciblé final et `git diff --check` sont PASS.

Les navigateurs locaux ont subi des fermetures de page et de processus GPU. Leur origine reste indéterminée. Un passage a observé dix groupes historiques, avant le dernier contrat de reprise explicite ; un autre a observé les six premiers groupes du nouveau banc sur les sources courantes. Aucun de ces résultats ne constitue un PASS complet des suites actuelles. Le dernier essai s’est interrompu avant le premier groupe. Les groupes de passages différents ne sont pas additionnés.

`browser-output-excerpts.log` contient des extraits des sorties d’outils, pas une archive exhaustive. Aucun bundle, secret, image ou donnée de compte réelle n’est joint.

La configuration par défaut des deux scripts reste celle de Playwright. Les drapeaux GPU/heap du reçu ont été injectés uniquement dans un lanceur temporaire désigné par `SUTRA_UI_CHROMIUM_PATH`, pour le diagnostic local. Ils ne sont pas imposés par le produit ni par les scripts versionnés.

À qualifier sur le candidat exact, dans un environnement navigateur opérationnel :

```sh
node scripts/test-social-multi-account-ui.mjs
node scripts/test-social-durable-ui.mjs
```

Les six groupes partiellement observés couvrent l’admission, le rechargement, la progression par lecture, les réponses incohérentes, la conservation des succès et la reprise explicitement autorisée. Les groupes suivants de fermeture/visibilité/annulation/changement de vidéo et les scénarios de récupération supplémentaires restent NON TESTÉS jusqu’au passage complet.

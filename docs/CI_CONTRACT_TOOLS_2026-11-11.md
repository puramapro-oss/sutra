# SUTRA contracts — dépendances natives sans APT

## État et périmètre

**PASS statique et contretests de gardes ; exécution native de ce candidat NON
TESTÉE avant son run CI.** Le changement conserve les commandes des tests de
contrats, médias, cinéma, diagnostics Salad et redteam. Il ne modifie aucun fichier
applicatif, test produit, fournisseur, secret ou autorisation GitHub.

La base relue est `0d051eb90d32bf8b055a5c6ea7923ac0026788f0`. Le précédent
[run vert 42973843753](https://github.com/puramapro-oss/sutra/actions/runs/42973843753),
job contracts `130368237180`, utilisait déjà Ubuntu **26.04.1**, image
`20261101.186.1`. Son journal confirme que `fonts-dejavu-core` était préinstallé,
puis que l'étape APT ajoutait FFmpeg **8.0.1** et Blender **5.0.1**. La dépendance
aux dépôts APT a ensuite empêché les tests de démarrer.

Le job utilise maintenant le label explicite **`ubuntu-26.04`**, un délai global
inchangé de 20 minutes et `shell: bash`. L'installation est remplacée par
`scripts/ci/prepare-contract-tools.py`. La configuration de `quality` relève d'un
lot distinct ; les tests PostgreSQL ne sont pas modifiés par ce changement.

## Provenance des outils

| Outil | Distribution choisie | Qualification disponible avant ce run SUTRA |
| --- | --- | --- |
| FFmpeg et ffprobe | Archive FFmpeg-Builds GPL, version `n8.1.3-27-g8dca1586f4-20261031` | Même pin que MUKTI, réellement exécuté dans son run `43055294523` ; les tests médias SUTRA doivent encore le qualifier |
| Blender | Archive officielle Linux x64 **4.5.16 LTS** | Taille de l'index et SHA256 officiel relus ; aucun téléchargement lourd ni rendu local effectué pour ce candidat |
| DejaVu Sans | Fonte système requise, issue de `fonts-dejavu-core` | Package présent dans le dernier runner vert ; fichier exact et sélection Fontconfig à revérifier à chaque run |

### FFmpeg

- [Archive versionnée](https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/download/autobuild-2026-10-31-12-59/ffmpeg-n8.1.3-27-g8dca1586f4-linux64-gpl-8.1.tar.xz)
- Asset GitHub : `695398022` ; taille : **152246308 octets**.
- SHA256 : `41e9c565594c390622cf968d82fa4135d9e9a11d06c1515644288cbc844e3380`.
- La variante contient le texte **GNU GPL version 3**, vérifié par son empreinte
  `8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903`.
- Le distributeur publie la recette au commit
  `5031c6f1082414e53688d39e521849905071070d`. Aucune attestation cryptographique de
  construction ou recompilation indépendante n'est revendiquée.

Cette archive est fournie par FFmpeg-Builds, référencé depuis FFmpeg, et non par le
projet FFmpeg lui-même. Les binaires sont des outils temporaires de CI et ne sont
pas intégrés aux artefacts produit ni aux rapports téléchargés.

### Blender

- [Archive officielle](https://download.blender.org/release/Blender4.5/blender-4.5.16-linux-x64.tar.xz)
- [Index officiel et taille](https://download.blender.org/release/Blender4.5/) :
  **377826288 octets**.
- [Fichier officiel SHA256](https://download.blender.org/release/Blender4.5/blender-4.5.16.sha256),
  récupéré comme texte de 880 octets pendant la préparation.
- SHA256 Linux x64 : `23432b064977908beb1ab4b7f32f024e7331105c875c187dce002aff84b10c11`.
- Le manifeste de licences livré est comparé au fichier officiel
  [`release/license/license.md` à `v4.5.16`](https://github.com/blender/blender/blob/v4.5.16/release/license/license.md),
  blob Git `d6e52afa75eba990a2d0b26752e5d285ae863ce5`, puis conservé avec son SHA256.
  La [page officielle des licences](https://www.blender.org/about/license/)
  décrit la licence GNU GPL version 3 ou ultérieure applicable à la distribution
  des binaires Blender et les licences de composants.

Le choix de cette branche LTS ne prouve pas à lui seul son équivalence avec le
Blender 5.0.1 du run précédent. L'export relu utilise Cycles CPU, AgX, `bmesh`,
des keyframes et des marqueurs. Le test réel de sauvegarde, réouverture et rendu
reste la condition d'acceptation de cette version.

## Préconditions et effets limités au runner

Le script refuse un contexte hors GitHub Actions, une architecture différente de
Linux x86_64, un système autre qu'Ubuntu 26.04 et un Python antérieur à 3.12.
Il vérifie avant les téléchargements :

- Le fichier `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`, sa taille et sa
  sélection exacte par `fc-match`. Son empreinte, la version du package et son
  texte de licence sont conservés.
- L'absence de **`/usr/bin/ffmpeg` et `/usr/bin/ffprobe`**, y compris de liens
  cassés. Toute présence est refusée ; aucun binaire existant n'est remplacé.

Ce dernier point est nécessaire : le shim conservé
`qa/t01-final-20261015/cpu-bin/ffmpeg` lance explicitement `/usr/bin/ffmpeg` sous
Linux. Publier seulement un répertoire dans PATH ne couvrirait pas ce test.
Après vérification des outils, le script crée deux liens par
`sudo -n ln -s -T`, sans option de remplacement. C'est sa seule opération
privilégiée. Les liens ciblent le répertoire temporaire privé du job ; aucune
configuration système, DNS ou TLS n'est changée.

Les téléchargements utilisent HTTPS, y compris les redirections, avec des délais
bornés, une limite de taille et un seul retry. Taille et SHA256 doivent correspondre
avant toute extraction ou exécution. Aucun alias `latest` ou miroir de secours
n'est utilisé.

Pour FFmpeg, seuls les deux fichiers exécutables réguliers et la licence attendue
sont extraits. Pour Blender, l'extraction refuse les chemins hors racine, les
chemins répétés, les fichiers spéciaux et les liens sortants ; le filtre `data`
de Python conserve les liens internes nécessaires aux bibliothèques. Nombre de
membres et taille totale décompressée sont bornés. Le manifeste de licences et les
empreintes des fichiers exécutés sont consignés.

## Contrôles exécutés par le candidat en CI

Avant les suites existantes, les outils sont sondés dans un environnement filtré
correspondant à celui des lanceurs isolés :

- Versions de FFmpeg, ffprobe et Blender conformes aux pins.
- Présence des filtres **`rubberband`, `drawtext`, `subtitles`** et de l'encodeur
  **`libx264`**.
- Exécution d'une image de test `drawtext` avec la fonte DejaVu Sans.
- Démarrage Blender en arrière-plan, configuration usine, auto-exécution désactivée,
  contrôle de la version 4.5.16 et de la disponibilité de Cycles CPU.

Blender est publié via PATH : `scripts/run-ci.mjs` conserve cette variable mais
retire `SUTRA_BLENDER_BIN`. Une seconde sonde `blender --version` utilise ce même
PATH filtré immédiatement avant le profil cinéma réel.

Le fichier de test existant peut ignorer le scénario lorsque Blender est absent.
Or le lanceur historique considère le code de sortie 0 comme un PASS. La nouvelle
garde lit donc **le vrai log**
`test-results/ci/cinema-blender/cinema-blender.log` après le profil. Elle exige le
titre exact du test, **1 test, 1 réussite, 0 échec, 0 annulation, 0 skip, 0 todo**.
Les formats Node `spec` et TAP sont acceptés ; une preuve absente, ambiguë ou
inconnue est refusée. Aucune modification du test produit n'est nécessaire.

## Vérification prépublication et limites

Les contrôles statiques et synthétiques ont réussi avec Node **24.22.1** :
syntaxe des étapes Bash et de la sonde Node ; vrais formats de sortie `spec` et
TAP ; refus du scénario ignoré même lorsque Node termine avec le code 0 ; refus
des preuves manquantes, d'un autre titre ou de résumés dupliqués ; refus d'un
Blender absent ou d'une mauvaise version par la sonde exacte du workflow ; refus
d'archives aux chemins, liens ou noms répétés dangereux, avec acceptation d'un
lien interne valide. **15 contrôles ciblés PASS.**

Ces contretests utilisent des sorties de reporter et des fichiers temporaires
synthétiques. Ils ne sont pas une qualification native de Blender, de FFmpeg ou
du produit. Aucun de ces deux outils n'a été téléchargé ou installé localement
pour ce candidat.

Le prochain run doit encore démontrer les contrats, les vraies mesures médias,
la sauvegarde/réouverture/rendu Blender et les autres étapes conservées. Les
rapports de préparation, versions et licences sont ajoutés à l'artefact existant
`sutra-contract-results`, sans y joindre les archives ni les binaires. Un échec
de préparation reste un échec de CI ; il ne déclenche ni APT ni contournement.

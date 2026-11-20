# SUTRA — Google Play Setup (3 minutes)

## Pré-requis
- Compte Google Play Console (25$ one-time)
- Service Account JSON (google-service-account.json)
- Relever l’UUID du projet **SUTRA** dans son tableau de bord Expo. Renseigner la même valeur dans la variable de dépôt GitHub `EAS_PROJECT_ID` et l’environnement Expo `production`. L’UUID est public et peut aussi être enregistré dans `expo.extra.eas.projectId` de `app.json`. Depuis `mobile`, vérifier l’association avec `node scripts/check-eas-project.cjs` avant un envoi.

## Étapes (3 min de clics)

### 1. Créer l'app (30 sec)
1. Google Play Console → **Créer une application**
2. Nom : `SUTRA - Création Vidéo IA`
3. Langue par défaut : `Français`
4. App ou jeu : `App`
5. Gratuite ou payante : `Gratuite`
6. Accepter les conditions → **Créer**

### 2. Fiche Store (1 min)
1. **Fiche principale** → Remplir :
   - Titre : `SUTRA - Création Vidéo IA`
   - Description courte : `Crée des vidéos virales avec l'IA en quelques secondes`
   - Description complète : *(copier depuis store.config.json → android → fr-FR → fullDescription)*
2. **Éléments graphiques** :
   - Icône 512×512 : `assets/icon.png` (redimensionner)
   - Image promotionnelle 1024×500 : `assets/feature-graphic.png`
   - Screenshots : *(captures Maestro depuis maestro/)*
3. **Enregistrer**

### 3. Catégorie & Coordonnées (30 sec)
1. **Catégorie** : `Outils vidéo` ou `Productivité`
2. **Coordonnées** :
   - Email : `matiss.frasne@gmail.com`
   - Site web : `https://sutra.purama.dev`
3. **Enregistrer**

### 4. Questionnaire de contenu (30 sec)
1. **Contenu de l'application** → Répondre aux questionnaires :
   - Classification de contenu → Démarrer → Tout le monde (pas de violence, etc.)
   - Public cible : 16+
   - Annonces : Non
   - Accès à l'application : Oui, tout le monde
2. **Enregistrer** chaque section

### 5. Service Account (30 sec)
1. Vérifier que `google-service-account.json` est dans `mobile/`
2. Dans Google Cloud Console : IAM → Service Account → Rôle `Éditeur` sur le projet
3. Dans Play Console : Paramètres → Accès API → Associer le projet → Accorder l'accès au service account

### 6. Premier build
```bash
cd mobile
eas build --platform android --profile production
eas submit --platform android --profile production
```

## C'est fait !
Les changements mobiles sur `main` déclenchent les builds et les soumissions via EAS Workflows si le dépôt est connecté au projet Expo. GitHub Actions gère la mise à jour OTA et permet de lancer un build manuel. Le développement local et les exports de vérification fonctionnent sans compte Expo.

## Commandes utiles
```bash
# Build preview (test interne)
eas build --platform android --profile preview

# Build production
eas build --platform android --profile production

# Submit au Play Store
eas submit --platform android --profile production

# OTA update (sans review)
eas update --channel production --message "Fix: description"
```

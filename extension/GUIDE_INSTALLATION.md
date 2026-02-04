# 📦 Guide d'Installation de l'Extension Chrome

Ce guide vous explique comment installer et utiliser l'extension Chrome pour l'analyse concurrentielle Etsy.

## 🎯 Prérequis

- Google Chrome (version 88 ou supérieure)
- Node.js et npm installés (pour compiler TypeScript)
- Accès au projet Etsmart

## 📋 Étape 1 : Compiler l'Extension

L'extension est écrite en TypeScript et doit être compilée en JavaScript avant d'être installée.

### Option A : Compilation automatique (recommandé)

Si vous avez `tsc` installé globalement :

```bash
cd extension
tsc
```

### Option B : Compilation manuelle

Si vous n'avez pas `tsc`, installez TypeScript globalement :

```bash
npm install -g typescript
cd extension
tsc
```

### Option C : Utiliser npx (sans installation globale)

```bash
cd extension
npx tsc
```

Après la compilation, vous devriez avoir :
- ✅ `content-script.js`
- ✅ `background.js`

## 🎨 Étape 2 : Créer les Icônes (Optionnel mais recommandé)

L'extension nécessite des icônes pour fonctionner correctement. Créez 3 fichiers PNG :

1. **icon16.png** - 16x16 pixels (barre d'outils)
2. **icon48.png** - 48x48 pixels (gestionnaire d'extensions)
3. **icon128.png** - 128x128 pixels (Chrome Web Store)

Placez-les dans le dossier `extension/`.

> 💡 **Astuce** : Vous pouvez utiliser des outils en ligne comme [Favicon.io](https://favicon.io/) ou [Canva](https://www.canva.com/) pour créer des icônes rapidement.

## 🔧 Étape 3 : Installer l'Extension dans Chrome

### Mode Développeur

1. **Ouvrez Chrome** et allez à `chrome://extensions/`
   - Ou : Menu Chrome → Plus d'outils → Extensions
   - Ou : Clic droit sur l'icône d'extensions → Gérer les extensions

2. **Activez le mode développeur**
   - En haut à droite, activez le toggle "Mode développeur"

3. **Chargez l'extension**
   - Cliquez sur "Charger l'extension non empaquetée"
   - Sélectionnez le dossier `extension/` (celui qui contient `manifest.json`)
   - Cliquez sur "Sélectionner le dossier"

4. **Vérifiez l'installation**
   - L'extension devrait apparaître dans la liste
   - Si vous voyez des erreurs, vérifiez la console (F12) pour plus de détails

## ✅ Étape 4 : Vérifier que l'Extension Fonctionne

1. **Ouvrez une page Etsy de recherche**
   - Allez sur https://www.etsy.com/search?q=exemple
   - Vous devriez voir un bouton flottant "Importer les boutiques" en bas à droite

2. **Testez le scraping**
   - Cliquez sur "Importer les boutiques"
   - L'extension devrait commencer à scraper les boutiques visibles
   - Vérifiez la console (F12) pour voir les logs

## 🚀 Étape 5 : Utiliser depuis le Dashboard

1. **Connectez-vous au dashboard**
   - Allez sur votre site Etsmart
   - Connectez-vous et allez dans le dashboard

2. **Ouvrez l'onglet "Analyse concurrentielle"**
   - Cliquez sur l'onglet "Analyse concurrentielle" dans le menu

3. **Remplissez le formulaire**
   - Sélectionnez une catégorie
   - Entrez votre niche (ex: "bijoux en argent")
   - Cliquez sur "Trouver les boutiques dominantes"

4. **Autorisez l'ouverture de l'onglet Etsy**
   - Chrome demandera la permission d'ouvrir un nouvel onglet
   - Autorisez l'action

5. **Sur la page Etsy**
   - L'extension ouvrira automatiquement une recherche Etsy
   - Le bouton "Importer les boutiques" apparaîtra
   - Cliquez dessus pour lancer le scraping

6. **Attendez l'analyse**
   - Les données sont envoyées au backend
   - GPT-4o analyse les boutiques
   - Vous êtes redirigé vers la page de résultats

## 🐛 Dépannage

### L'extension n'apparaît pas dans Chrome

- ✅ Vérifiez que vous avez compilé TypeScript (`tsc`)
- ✅ Vérifiez que `manifest.json` existe dans le dossier
- ✅ Vérifiez la console Chrome (`chrome://extensions/` → Détails → Erreurs)

### Le bouton "Importer les boutiques" n'apparaît pas

- ✅ Vérifiez que vous êtes sur une page de recherche Etsy (`/search`)
- ✅ Ouvrez la console (F12) et cherchez des erreurs
- ✅ Rechargez la page (F5)

### L'extension ne communique pas avec le backend

- ✅ Vérifiez que votre serveur local tourne (`npm run dev`)
- ✅ Vérifiez que l'URL dans `background.js` correspond à votre environnement
- ✅ Vérifiez la console Chrome pour les erreurs réseau

### Erreur "Extension context invalidated"

- ✅ Rechargez simplement l'extension dans `chrome://extensions/`
- ✅ Ou rechargez la page Etsy

## 🔒 Permissions de l'Extension

L'extension demande les permissions suivantes :

- **tabs** : Pour ouvrir des onglets Etsy
- **storage** : Pour sauvegarder temporairement les données
- **activeTab** : Pour accéder au contenu de la page active
- **scripting** : Pour injecter le script de scraping
- **Host permissions** : Pour accéder à `etsy.com` et votre backend

Ces permissions sont nécessaires pour le fonctionnement de l'extension.

## 📝 Notes pour les Développeurs

### Structure des Fichiers

```
extension/
├── manifest.json          # Configuration de l'extension
├── content-script.ts      # Script qui scrape Etsy (source)
├── content-script.js      # Version compilée
├── background.ts          # Service worker (source)
├── background.js          # Version compilée
├── types.ts               # Types TypeScript
├── popup.html             # Interface popup (optionnel)
├── popup.js               # Logique popup (optionnel)
├── tsconfig.json          # Configuration TypeScript
└── icon*.png              # Icônes (à créer)
```

### Recompiler après Modification

Chaque fois que vous modifiez `content-script.ts` ou `background.ts` :

```bash
cd extension
tsc
```

Puis rechargez l'extension dans Chrome (`chrome://extensions/` → icône de rechargement).

### Mode Développeur vs Production

- **Développement** : Utilisez le mode développeur (chargement non empaqueté)
- **Production** : Créez un fichier `.zip` du dossier `extension/` et publiez sur Chrome Web Store

## 🎉 C'est Prêt !

Votre extension est maintenant installée et prête à être utilisée. Retournez sur le dashboard et testez la fonctionnalité d'analyse concurrentielle !

---

**Besoin d'aide ?** Vérifiez les fichiers :
- `SETUP.md` - Guide de configuration
- `INTEGRATION.md` - Détails techniques d'intégration
- `FEATURE_COMPLETE.md` - Récapitulatif de la fonctionnalité


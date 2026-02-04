# Guide d'Installation et Configuration de l'Extension

## 📦 Installation

1. **Ouvrez Chrome** et allez dans `chrome://extensions/`
2. **Activez le "Mode développeur"** (toggle en haut à droite)
3. **Cliquez sur "Charger l'extension non empaquetée"**
4. **Sélectionnez le dossier `extension/`** de ce projet
5. ✅ L'extension est maintenant installée !

## 🔑 Obtenir l'ID de l'Extension

1. Après avoir chargé l'extension, allez dans `chrome://extensions/`
2. Trouvez l'extension "Etsmart - Analyseur de Boutiques Etsy"
3. **Copiez l'ID** (une longue chaîne de caractères, ex: `abcdefghijklmnopqrstuvwxyz123456`)
4. Remplacez `YOUR_EXTENSION_ID` dans :
   - `src/components/CompetitorFinder.tsx` (ligne avec `EXTENSION_ID`)
   - `extension/background.ts` (si vous utilisez la version TypeScript)

## 🎨 Créer les Icônes

L'extension nécessite 3 fichiers PNG :
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

**Option rapide** : Utilisez le logo Etsmart et redimensionnez-le aux bonnes tailles.

## ✅ Vérification

1. Rechargez la page web de votre application
2. Le composant `CompetitorFinder` devrait détecter l'extension
3. Testez en lançant une analyse

## 🐛 Dépannage

### L'extension n'est pas détectée
- Vérifiez que l'ID de l'extension est correct dans `CompetitorFinder.tsx`
- Rechargez la page web après avoir installé l'extension
- Vérifiez la console du navigateur pour les erreurs

### Le scraping ne fonctionne pas
- Vérifiez que vous êtes bien sur une page de recherche Etsy (`/search?q=...`)
- Ouvrez la console (F12) et cherchez les messages `[Etsmart]`
- Le bouton flottant "Importer les boutiques" devrait apparaître en bas à droite

### L'API ne reçoit pas les données
- Vérifiez que `API_BASE_URL` dans `background.js` correspond à votre URL
- Vérifiez la console du background script (chrome://extensions → Détails → Service worker)
- Assurez-vous que l'API `/api/competitors/import` est accessible


# Extension Chrome Etsmart

## Installation

1. Ouvrez Chrome et allez dans `chrome://extensions/`
2. Activez le "Mode développeur" (en haut à droite)
3. Cliquez sur "Charger l'extension non empaquetée"
4. Sélectionnez le dossier `extension/`

## Compilation TypeScript

Avant d'utiliser l'extension, compilez les fichiers TypeScript :

```bash
cd extension
npx tsc content-script.ts --outDir . --target ES2020 --module ESNext
npx tsc background.ts --outDir . --target ES2020 --module ESNext
```

Ou utilisez un build script automatique.

## Structure

- `manifest.json` : Configuration de l'extension
- `content-script.ts` : Script qui scrape les boutiques sur Etsy
- `background.ts` : Service worker qui gère la communication
- `types.ts` : Types TypeScript partagés
- `popup.html/js` : Interface popup simple

## Fonctionnement

1. Le frontend web envoie un message `START_IMPORT` avec la niche et l'URL de recherche
2. Le background ouvre un onglet Etsy
3. Le content script scrape les boutiques
4. Les données sont envoyées à l'API `/api/competitors/import`
5. La page de résultats s'ouvre automatiquement


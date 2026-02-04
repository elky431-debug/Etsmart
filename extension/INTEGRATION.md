# Guide d'Intégration de l'Analyse de Boutiques

## 📍 Où utiliser le composant CompetitorFinder

Le composant `CompetitorFinder` peut être intégré dans :

1. **Page Dashboard** : Ajoutez-le comme une nouvelle section
2. **Page dédiée** : Créez `/dashboard/competitors/finder` 
3. **Modal/Popup** : Ouvrir dans une modal depuis le dashboard

## 🔧 Intégration dans le Dashboard

Exemple d'intégration dans `src/app/dashboard/page.tsx` :

```tsx
import { CompetitorFinder } from '@/components/CompetitorFinder';

// Dans votre composant Dashboard
<CompetitorFinder 
  onAnalysisComplete={(data) => {
    // Rediriger vers la page de résultats
    router.push(`/dashboard/competitors?niche=${encodeURIComponent(data.niche)}`);
  }}
/>
```

## 🔄 Flux Complet

1. **Utilisateur** remplit le formulaire dans `CompetitorFinder`
2. **Frontend** envoie message `START_IMPORT` à l'extension
3. **Extension** ouvre Etsy et scrape les boutiques
4. **Extension** envoie les données à `/api/competitors/import`
5. **API** analyse avec GPT-4o et retourne les résultats
6. **Extension** ouvre `/dashboard/competitors` avec les données
7. **Page résultats** affiche l'analyse complète

## 🧪 Test sans Extension

Pour tester sans extension :
1. Utilisez le "Mode développeur" dans `CompetitorFinder`
2. L'extension ouvrira Etsy manuellement
3. Utilisez le bouton flottant "Importer les boutiques" sur Etsy
4. Les données seront envoyées à l'API

## ⚙️ Configuration Requise

- ✅ Extension Chrome installée et configurée
- ✅ `OPENAI_API_KEY` dans `.env.local`
- ✅ ID de l'extension mis à jour dans `CompetitorFinder.tsx`
- ✅ Icônes PNG créées (16x16, 48x48, 128x128)


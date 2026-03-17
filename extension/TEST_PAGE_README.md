# Page Secrète de Test pour Google

## 📍 URL de la page de test

**URL secrète** : `https://etsmart.app/test-extension`

Cette page est accessible uniquement via le lien direct et n'apparaît pas dans la navigation normale du SaaS.

## 🎯 Objectif

Cette page permet aux testeurs Google de tester l'extension Chrome Etsmart sans avoir besoin de :
- Créer un compte
- S'abonner
- Se connecter

## 🚀 Fonctionnalités

### 1. Test manuel
- Les testeurs peuvent entrer directement une URL de produit Etsy
- Cliquer sur "Analyser le produit" pour lancer l'analyse
- Les résultats s'affichent immédiatement

### 2. Test via l'extension
- L'extension peut rediriger vers cette page automatiquement
- Les données scrapées par l'extension sont affichées automatiquement
- Support des analyses de boutiques et de produits

## 📝 Instructions pour les testeurs

1. **Accéder à la page** : Ouvrir `https://etsmart.app/test-extension` dans le navigateur

2. **Test manuel** :
   - Entrer une URL de produit Etsy (ex: `https://www.etsy.com/listing/123456789/...`)
   - Cliquer sur "Analyser le produit"
   - Attendre les résultats

3. **Test avec l'extension** :
   - Installer l'extension Chrome
   - Aller sur une page de produit Etsy
   - Utiliser l'extension pour scraper
   - L'extension redirigera automatiquement vers cette page avec les résultats

## 🔧 Configuration de l'extension

Pour que l'extension redirige vers la page de test, il faut ajouter `useTestPage: true` dans les messages envoyés à l'extension.

**Exemple** :
```javascript
chrome.runtime.sendMessage({
  type: 'OPEN_ANALYZING_PAGE',
  niche: 'Test',
  useTestPage: true  // ← Activer la page de test
});
```

## 📊 Données affichées

La page affiche :
- Informations du produit analysé
- Score de potentiel de lancement (0-10)
- Score de confiance (0-10)
- Recommandations
- Liste des boutiques analysées (si analyse de concurrents)
- Données brutes en mode développement

## 🔒 Sécurité

- Cette page n'est pas indexée par les moteurs de recherche
- Aucune authentification requise
- Les données ne sont pas sauvegardées en base de données
- Utilisation uniquement pour les tests Google

## 🐛 Debug

En mode développement, la page affiche également les données brutes JSON pour faciliter le débogage.




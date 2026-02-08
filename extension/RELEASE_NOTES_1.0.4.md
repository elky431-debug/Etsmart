# Release Notes - Version 1.0.4

## 🎉 Améliorations Majeures

### ✨ Nouvelles Fonctionnalités
- **Extraction améliorée des ventes totales** : Support des formats "54.5k", "54k", etc.
- **Extraction améliorée des avis** : Support des formats "15.5k reviews"
- **Filtrage des listings gratuits** : Exclusion automatique des listings à 0€ ou < 1€
- **Scraping des prix amélioré** : Plusieurs méthodes d'extraction pour une meilleure précision
- **Détection du nombre total de listings** : Extraction depuis "Search all X items"

### 🐛 Corrections de Bugs
- **Correction extraction ventes** : Les ventes avec format "k" (ex: 54.5k) sont maintenant correctement converties
- **Correction extraction prix** : Amélioration de la détection des prix dans différents formats
- **Gestion d'erreurs améliorée** : Meilleure gestion des timeouts et erreurs serveur
- **Filtrage listings** : Exclusion des listings gratuits pour des statistiques plus précises

### 🔧 Améliorations Techniques
- **Logs de debug** : Ajout de logs pour faciliter le debugging
- **Robustesse** : Gestion améliorée des cas limites et erreurs
- **Performance** : Optimisation de l'extraction des données

## 📊 Impact Utilisateur

Les analyses de boutiques sont maintenant plus précises avec :
- ✅ Ventes totales correctement extraites (même pour les grandes boutiques)
- ✅ Prix moyens calculés uniquement sur les listings payants
- ✅ Statistiques plus fiables et représentatives

## 🔄 Migration depuis 1.0.3

Aucune action requise. L'extension se mettra à jour automatiquement.

---

**Date de publication** : À déterminer  
**Compatibilité** : Chrome, Edge, Brave (Chromium-based browsers)


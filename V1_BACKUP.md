# Etsmart V1 - Sauvegarde de l'état actuel

**Date de sauvegarde :** 5 février 2025  
**Version :** 1.0.0  
**État :** Version en production sur Netlify

## 📋 Résumé de la V1

### Fonctionnalités principales
- ✅ Authentification (email/password + Google OAuth)
- ✅ Système d'abonnement Stripe (SMART/PRO/SCALE)
- ✅ Analyse de produits avec IA (GPT-4o Vision)
- ✅ Génération de listings Etsy
- ✅ Génération d'images produits
- ✅ Dashboard avec historique
- ✅ Système de crédits/quota
- ✅ Paywall pour nouveaux utilisateurs

### Plans d'abonnement
- **SMART** : €19.99/mois - 30 crédits
- **PRO** : €29.99/mois - 60 crédits
- **SCALE** : €49.99/mois - 100 crédits

### Coûts en crédits
- Analyse de produit : 0.5 crédit
- Génération de listing : 0.5 crédit
- Génération d'images : 0.5 crédit

## 🔧 Configuration technique

### Stack
- **Framework** : Next.js 16.1.1
- **React** : 19.2.3
- **Base de données** : Supabase (PostgreSQL)
- **Paiements** : Stripe
- **IA** : OpenAI GPT-4o Vision
- **Génération d'images** : NanoBanana API

### Variables d'environnement critiques
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_APP_URL`

### Structure des données Supabase
- Table `users` : gestion des abonnements et quotas
- Table `analyses` : historique des analyses
- Table `products` : produits analysés

## 📁 Fichiers modifiés dans cette session

### Composants principaux
- `src/components/dashboard/ListingProductImport.tsx` - Import de produits avec exemple
- `src/app/dashboard/page.tsx` - Ajout des crédits nécessaires sur chaque page
- `src/components/dashboard/QuotaDisplay.tsx` - Affichage des crédits

### Modifications récentes
1. ✅ Correction erreur de parsing dans ListingProductImport.tsx
2. ✅ Ajout du nom de l'onglet en haut de chaque page (Listing/Images)
3. ✅ Ajout de l'exemple de capture d'écran (masqué par défaut)
4. ✅ Zoom sur la tasse pour le mode "images"
5. ✅ Affichage des crédits nécessaires sur chaque page principale
6. ✅ Renommage "Analyse concurrentielle" → "Boutiques concurrents"

## 🚀 Déploiement Netlify

### Configuration actuelle
- **Build command** : `next build`
- **Publish directory** : `.next`
- **Node version** : 20.x

### Webhooks Stripe
- URL : `https://[votre-domaine].netlify.app/api/webhooks/stripe`
- Événements : `checkout.session.completed`, `customer.subscription.*`

## 📝 Notes importantes

### Gestion des utilisateurs existants
- Les utilisateurs existants conservent leurs données
- Synchronisation automatique depuis Stripe
- Les quotas sont préservés et calculés correctement
- Les analyses historiques restent accessibles

### Flux de paiement
1. Création de compte → Paywall
2. Sélection d'un plan → Stripe Checkout
3. Paiement → Webhook Stripe
4. Activation → Redirection vers dashboard

### Système de crédits
- Calcul : `remaining = quota - used`
- Réinitialisation mensuelle automatique
- Modal QuotaExceeded quand quota atteint

## 🔄 Prochaines étapes après sauvegarde

1. Commit des modifications actuelles
2. Push vers le dépôt Git
3. Déploiement automatique sur Netlify
4. Vérification des webhooks Stripe
5. Test de bout en bout du flux de paiement

---

**⚠️ Important** : Cette sauvegarde représente l'état de la V1 avant le déploiement de la version locale actuelle sur Netlify.


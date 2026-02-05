# Guide de déploiement V1 sur Netlify

**Date :** 5 février 2025  
**Version à déployer :** Version locale actuelle (avec toutes les modifications récentes)

## 📋 État actuel sauvegardé

✅ **Sauvegarde créée** : `V1_BACKUP.md`  
✅ **Site Netlify ID** : `6b1db453-5ad9-4ea3-a025-ce9d134b442f`  
✅ **Dernier commit Git** : `8871406` (Style: Remplacement tous les fonds blancs par noir pur)

## 🚀 Étapes de déploiement

### 1. Vérifier les modifications locales

```bash
# Voir les fichiers modifiés
git status

# Voir les différences principales
git diff src/components/dashboard/ListingProductImport.tsx
git diff src/app/dashboard/page.tsx
```

### 2. Commiter les modifications

```bash
# Ajouter tous les fichiers modifiés
git add .

# Créer un commit avec les modifications récentes
git commit -m "feat: Ajout crédits nécessaires, correction exemple images, renommage Boutiques concurrents"

# Push vers le dépôt
git push origin main
```

### 3. Déploiement automatique Netlify

Si Netlify est connecté à GitHub, le déploiement se fera automatiquement après le push.

**Vérifier sur Netlify Dashboard :**
- Aller sur https://app.netlify.com
- Vérifier que le build est en cours
- Attendre la fin du build (environ 2-3 minutes)

### 4. Vérifications post-déploiement

#### ✅ Variables d'environnement
Vérifier que toutes les variables sont configurées dans Netlify :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_APP_URL` (URL de votre site Netlify)

#### ✅ Webhook Stripe
Vérifier que le webhook Stripe pointe vers :
```
https://[votre-domaine].netlify.app/api/webhooks/stripe
```

#### ✅ Tests fonctionnels
1. **Création de compte** : Tester l'inscription
2. **Paywall** : Vérifier l'affichage du paywall
3. **Paiement** : Tester un paiement test Stripe
4. **Activation** : Vérifier la redirection vers le dashboard
5. **Crédits** : Vérifier l'affichage des crédits sur chaque page
6. **Analyse** : Tester une analyse complète

## 📝 Modifications incluses dans ce déploiement

### Interface
- ✅ Nom de l'onglet affiché en haut (Listing/Images)
- ✅ Affichage des crédits nécessaires sur chaque page principale
- ✅ Exemple de capture d'écran masqué par défaut
- ✅ Zoom optimisé sur la tasse pour le mode "images"
- ✅ Renommage "Analyse concurrentielle" → "Boutiques concurrents"

### Corrections
- ✅ Correction erreur de parsing dans ListingProductImport.tsx
- ✅ Utilisation de l'exemple screenshot-example.png pour le mode images

## 🔍 Vérifications importantes

### Avant le déploiement
- [ ] Tous les tests locaux passent
- [ ] Les variables d'environnement sont à jour
- [ ] Le webhook Stripe est configuré
- [ ] Les crédits s'affichent correctement

### Après le déploiement
- [ ] Le site se charge correctement
- [ ] L'authentification fonctionne
- [ ] Le paywall s'affiche pour les nouveaux utilisateurs
- [ ] Les paiements Stripe fonctionnent
- [ ] Les crédits sont correctement calculés
- [ ] Les analyses fonctionnent

## 🆘 En cas de problème

### Build échoue
1. Vérifier les logs Netlify
2. Vérifier les variables d'environnement
3. Vérifier que toutes les dépendances sont dans package.json

### Webhook Stripe ne fonctionne pas
1. Vérifier l'URL du webhook dans Stripe Dashboard
2. Vérifier STRIPE_WEBHOOK_SECRET dans Netlify
3. Tester avec Stripe CLI en local

### Les crédits ne s'affichent pas
1. Vérifier la synchronisation avec Stripe
2. Vérifier les données dans Supabase
3. Vérifier les logs de l'API `/api/user/subscription`

---

**Note** : Ce déploiement remplace la V1 actuelle en production par la version locale avec toutes les améliorations récentes.


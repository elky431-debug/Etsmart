# Guide de Configuration Stripe - Etsmart

Ce guide vous explique comment configurer Stripe pour activer les abonnements sur Etsmart.

## 📋 Prérequis

- Un compte Stripe (https://stripe.com)
- Accès au tableau de bord Stripe
- Accès à votre environnement de déploiement (Netlify, Vercel, etc.)

---

## Étape 1 : Créer les Produits Stripe

### 1.1 Connexion à Stripe

1. Allez sur https://dashboard.stripe.com
2. Connectez-vous à votre compte Stripe

### 1.2 Créer le Produit "Etsmart Smart" ($29.99/mois)

1. Dans le menu de gauche, cliquez sur **"Products"** → **"Add product"**
2. Remplissez les informations :
   - **Name**: `Etsmart Smart`
   - **Description**: `For Etsy sellers starting out or intermediate, who want to test products seriously without multiplying errors.`
   - **Pricing**: 
     - **Pricing model**: `Standard pricing`
     - **Price**: `29.99`
     - **Currency**: `USD`
     - **Billing period**: `Monthly` (récurrence mensuelle)
     - Cochez **"Recurring"** si ce n'est pas déjà fait
3. Cliquez sur **"Save product"**
4. **Copiez le "Price ID"** (commence par `price_...`) - vous en aurez besoin
   - Exemple : `price_1SqHYZCn17QPHnzEGz8Ehdzz` (déjà configuré dans le code)

### 1.3 Créer le Produit "Etsmart Pro" ($49.99/mois)

1. Cliquez sur **"Add product"**
2. Remplissez :
   - **Name**: `Etsmart Pro`
   - **Description**: `For active sellers who want to structure their decisions and improve their marketing performance on Etsy.`
   - **Pricing**: 
     - **Price**: `49.99`
     - **Currency**: `USD`
     - **Billing period**: `Monthly`
     - **Recurring**: ✅
3. Cliquez sur **"Save product"**
4. **Copiez le "Price ID"** pour le plan Pro

### 1.4 Créer le Produit "Etsmart Scale" ($79.99/mois)

1. Cliquez sur **"Add product"**
2. Remplissez :
   - **Name**: `Etsmart Scale`
   - **Description**: `For advanced sellers, high-volume shops, or users who want to test many products strategically.`
   - **Pricing**: 
     - **Price**: `79.99`
     - **Currency**: `USD`
     - **Billing period**: `Monthly`
     - **Recurring**: ✅
3. Cliquez sur **"Save product"**
4. **Copiez le "Price ID"** pour le plan Scale

---

## Étape 2 : Configurer les Price IDs dans le Code

### 2.1 Mettre à jour `src/types/subscription.ts`

1. Ouvrez le fichier `src/types/subscription.ts`
2. Trouvez la section `STRIPE_PRICE_IDS`
3. Remplacez `null` par vos Price IDs :

```typescript
export const STRIPE_PRICE_IDS: Record<PlanId, string | null> = {
  smart: 'price_1SqHYZCn17QPHnzEGz8Ehdzz', // ✅ Déjà configuré
  pro: 'price_XXXXXXXXXXXXXX', // 🔄 Remplacez par votre Price ID Pro
  scale: 'price_XXXXXXXXXXXXXX', // 🔄 Remplacez par votre Price ID Scale
};
```

### 2.2 Commit et Push

```bash
git add src/types/subscription.ts
git commit -m "Add Stripe Price IDs for Pro and Scale plans"
git push origin main
```

---

## Étape 3 : Obtenir les Clés API Stripe

### 3.1 Clé Secrète (Secret Key)

1. Dans Stripe Dashboard, allez dans **"Developers"** → **"API keys"**
2. Vous verrez deux clés :
   - **Publishable key** (commence par `pk_test_...` ou `pk_live_...`)
   - **Secret key** (commence par `sk_test_...` ou `sk_live_...`)

⚠️ **Important** : Utilisez la clé **"Secret key"** (pas la publishable key)

3. **Pour le développement** : Utilisez la clé de **test** (`sk_test_...`)
4. **Pour la production** : Utilisez la clé **live** (`sk_live_...`)

### 3.2 Copier la Secret Key

- Cliquez sur **"Reveal test key"** ou **"Reveal live key"**
- **Copiez la clé** (vous ne pourrez plus la voir complètement après)

---

## Étape 4 : Configurer les Variables d'Environnement

### 4.1 Sur Netlify

1. Allez sur https://app.netlify.com
2. Sélectionnez votre site Etsmart
3. Allez dans **"Site settings"** → **"Environment variables"**
4. Cliquez sur **"Add variable"**
5. Ajoutez :
   - **Key**: `STRIPE_SECRET_KEY`
   - **Value**: `sk_test_...` (votre clé Stripe secrète)
   - **Scopes**: Sélectionnez tous les environnements nécessaires
6. Cliquez sur **"Save"**

### 4.2 Sur Vercel

1. Allez sur https://vercel.com
2. Sélectionnez votre projet Etsmart
3. Allez dans **"Settings"** → **"Environment Variables"**
4. Cliquez sur **"Add New"**
5. Ajoutez :
   - **Name**: `STRIPE_SECRET_KEY`
   - **Value**: `sk_test_...` (votre clé Stripe secrète)
   - **Environments**: Sélectionnez Production, Preview, Development
6. Cliquez sur **"Save"**

### 4.3 En Développement Local

Créez un fichier `.env.local` à la racine du projet :

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ **Important** : Ajoutez `.env.local` à `.gitignore` pour ne pas commiter vos clés secrètes !

---

## Étape 5 : Redéployer l'Application

Après avoir configuré les variables d'environnement :

### Sur Netlify

1. Allez dans **"Deploys"**
2. Cliquez sur **"Trigger deploy"** → **"Deploy site"**

### Sur Vercel

1. L'application se redéploie automatiquement
2. Ou allez dans **"Deployments"** et cliquez sur **"Redeploy"**

---

## Étape 6 : Tester l'Intégration

### 6.1 Tester en Mode Test (Recommandé)

1. Utilisez une carte de test Stripe :
   - **Numéro** : `4242 4242 4242 4242`
   - **Date d'expiration** : N'importe quelle date future (ex: `12/34`)
   - **CVC** : N'importe quel 3 chiffres (ex: `123`)
   - **Code postal** : N'importe quel code postal (ex: `12345`)

2. Allez sur votre site : `https://votre-site.com/pricing`
3. Cliquez sur un bouton "Choose Plan"
4. Vérifiez que vous êtes redirigé vers Stripe Checkout
5. Complétez le paiement avec la carte de test

### 6.2 Vérifier dans Stripe Dashboard

1. Allez dans **"Payments"** → Vous devriez voir la transaction de test
2. Allez dans **"Subscriptions"** → Vous devriez voir l'abonnement créé

---

## Étape 7 : Configurer les Webhooks (Optionnel - Pour la suite)

⚠️ **À venir** : Pour créer automatiquement l'abonnement dans Supabase après paiement, il faudra configurer les webhooks Stripe. Ce sera dans une prochaine étape.

---

## 🐛 Dépannage

### Erreur : "Stripe is not configured"

- **Solution** : Vérifiez que `STRIPE_SECRET_KEY` est bien configuré dans vos variables d'environnement
- Redéployez l'application après avoir ajouté la variable

### Erreur : "Stripe Price ID not configured"

- **Solution** : Vérifiez que les Price IDs sont bien configurés dans `src/types/subscription.ts`
- Assurez-vous d'avoir créé les produits dans Stripe Dashboard

### Le bouton ne redirige pas vers Stripe

- **Vérifiez** : Ouvrez la console du navigateur (F12) et regardez les erreurs
- **Vérifiez** : Que l'utilisateur est bien connecté (sinon redirection vers login)

### Les cartes de test ne fonctionnent pas

- **Vérifiez** : Que vous utilisez la clé de **test** (`sk_test_...`) et non la clé live
- **Vérifiez** : Que vous êtes en mode "Test" dans Stripe Dashboard (bascule en haut à droite)

---

## ✅ Checklist de Configuration

- [ ] Produit "Etsmart Smart" créé dans Stripe
- [ ] Produit "Etsmart Pro" créé dans Stripe
- [ ] Produit "Etsmart Scale" créé dans Stripe
- [ ] Price IDs copiés et configurés dans `src/types/subscription.ts`
- [ ] `STRIPE_SECRET_KEY` configuré dans l'environnement de déploiement
- [ ] Application redéployée
- [ ] Test avec une carte de test réussi

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs dans la console du navigateur
2. Vérifiez les logs du serveur (Netlify Functions ou Vercel)
3. Vérifiez les logs dans Stripe Dashboard → **"Developers"** → **"Logs"**

---

**Bon setup ! 🚀**









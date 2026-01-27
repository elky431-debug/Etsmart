# Guide de Test du Paywall 🧪

Ce guide explique comment tester le système de paywall sans payer réellement.

## Méthode 1 : Cartes de Test Stripe (Recommandée) 💳

### ⚠️ Important : Les cartes de test fonctionnent sur TOUS les environnements

Les cartes de test Stripe fonctionnent sur :
- ✅ **localhost** (http://localhost:3000)
- ✅ **etsmart.app** (production)
- ✅ **N'importe quel domaine**

**Condition** : Vous devez utiliser les **clés de test Stripe** (pas les clés de production)

### Configuration requise

1. **Vérifiez vos clés Stripe en mode test** :
   - `STRIPE_SECRET_KEY` doit commencer par `sk_test_...` (pas `sk_live_...`)
   - `STRIPE_WEBHOOK_SECRET` doit être celui du mode test

2. **En local (`.env.local`)** :
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. **Sur Netlify (etsmart.app)** :
   - Allez dans **Netlify Dashboard** → **Site settings** → **Environment variables**
   - Vérifiez que `STRIPE_SECRET_KEY` commence par `sk_test_...`
   - Si vous avez `sk_live_...`, remplacez-la par votre clé de test pour tester
   - ⚠️ **Important** : Remettez la clé de production (`sk_live_...`) avant de lancer en production réelle

### Cartes de test Stripe

Utilisez ces numéros de carte pour tester différents scénarios :

#### ✅ Carte de succès (par défaut)
- **Numéro** : `4242 4242 4242 4242`
- **Date d'expiration** : N'importe quelle date future (ex: `12/34`)
- **CVC** : N'importe quel code à 3 chiffres (ex: `123`)
- **Code postal** : N'importe quel code postal (ex: `12345`)

#### ❌ Carte refusée
- **Numéro** : `4000 0000 0000 0002`
- Utilisez cette carte pour tester les échecs de paiement

#### 🔐 Carte 3D Secure
- **Numéro** : `4000 0025 0000 3155`
- Nécessite une authentification supplémentaire

#### 💳 Autres cartes de test
- **Carte avec fonds insuffisants** : `4000 0000 0000 9995`
- **Carte expirée** : `4000 0000 0000 0069`
- **Carte invalide** : `4000 0000 0000 0002`

### Processus de test

#### Option A : Test sur localhost

1. **Lancez votre application en développement** :
   ```bash
   npm run dev
   ```

2. **Connectez-vous** avec un compte de test

3. **Tentez d'analyser un produit** pour déclencher le paywall

4. **Cliquez sur un plan** pour être redirigé vers Stripe Checkout

5. **Utilisez la carte de test** `4242 4242 4242 4242` avec :
   - Date d'expiration : `12/34`
   - CVC : `123`
   - Code postal : `12345`

#### Option B : Test sur etsmart.app (production)

1. **Vérifiez que les clés de test sont configurées sur Netlify** :
   - Netlify Dashboard → Site settings → Environment variables
   - `STRIPE_SECRET_KEY` doit être `sk_test_...` (pas `sk_live_...`)

2. **Allez sur https://etsmart.app**

3. **Connectez-vous** avec un compte de test

4. **Tentez d'analyser un produit** pour déclencher le paywall

5. **Cliquez sur un plan** → Redirection vers Stripe Checkout

6. **Utilisez la carte de test** `4242 4242 4242 4242` avec :
   - Date d'expiration : `12/34`
   - CVC : `123`
   - Code postal : `12345`

7. **Vérifiez le résultat** :
   - Redirection vers `/dashboard?success=true`
   - Notification de succès affichée
   - Abonnement activé dans la base de données

### 🔍 Comment vérifier quelle clé est utilisée ?

**Sur Netlify** :
1. Allez dans **Netlify Dashboard**
2. Sélectionnez votre site (etsmart)
3. **Site settings** → **Environment variables**
4. Cherchez `STRIPE_SECRET_KEY`
5. Si elle commence par `sk_test_` → ✅ Les cartes de test fonctionneront
6. Si elle commence par `sk_live_` → ❌ Les cartes de test ne fonctionneront PAS

### Tester les webhooks localement

Pour tester les webhooks Stripe en local, utilisez Stripe CLI :

```bash
# Installer Stripe CLI
# macOS
brew install stripe/stripe-cli/stripe

# Linux/Windows : voir https://stripe.com/docs/stripe-cli

# Se connecter
stripe login

# Écouter les webhooks et les forwarder vers votre localhost
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Cela vous donnera un `STRIPE_WEBHOOK_SECRET` à utiliser en local.

---

## Méthode 2 : Mode Développement (Bypass Paywall) 🚀

Si vous voulez bypasser complètement le paywall en développement, vous pouvez activer le mode dev.

### Option A : Variable d'environnement

Ajoutez dans votre `.env.local` :
```env
NEXT_PUBLIC_BYPASS_PAYWALL=true
```

Puis modifiez le code pour vérifier cette variable (voir ci-dessous).

### Option B : Bypass manuel dans le code

Modifiez temporairement `src/components/steps/ProductImport.tsx` :

```typescript
// Handle Analyze button click - check subscription before proceeding
const handleAnalyzeClick = () => {
  // MODE DEV : Bypass paywall (à retirer en production)
  const DEV_BYPASS = process.env.NODE_ENV === 'development';
  if (DEV_BYPASS) {
    console.warn('⚠️ DEV MODE: Bypassing paywall');
    setStep(3);
    return;
  }

  // Code normal...
  if (!user) {
    setError('Please sign in to analyze products');
    return;
  }
  // ...
};
```

⚠️ **Important** : Retirez ce code avant de déployer en production !

---

## Vérification des résultats

### Après un paiement de test réussi

1. **Vérifiez dans Stripe Dashboard** :
   - Allez sur https://dashboard.stripe.com/test/payments
   - Vous devriez voir le paiement de test

2. **Vérifiez dans votre base de données** :
   - La table `users` devrait avoir :
     - `subscriptionPlan` = le plan choisi (SMART, PRO, SCALE)
     - `subscriptionStatus` = 'active'
     - `analysisQuota` = le quota du plan
     - `analysisUsedThisMonth` = 0

3. **Vérifiez dans l'application** :
   - Le paywall ne devrait plus s'afficher
   - Vous devriez pouvoir analyser des produits
   - Le dashboard devrait afficher votre abonnement actif

---

## Dépannage

### Le paywall s'affiche toujours après le paiement

1. Vérifiez que les webhooks Stripe sont bien configurés
2. Vérifiez les logs du serveur pour voir si le webhook a été reçu
3. Vérifiez que `STRIPE_WEBHOOK_SECRET` est correct

### Le paiement fonctionne mais l'abonnement n'est pas activé

1. Vérifiez que le webhook `checkout.session.completed` est bien traité
2. Vérifiez les logs de l'API `/api/webhooks/stripe`
3. Vérifiez que les métadonnées (`plan_id`, `user_id`) sont bien présentes

### Erreur "Stripe is not configured"

1. Vérifiez que `STRIPE_SECRET_KEY` est défini dans `.env.local`
2. Redémarrez le serveur de développement après avoir modifié `.env.local`

---

## Ressources

- [Documentation Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)


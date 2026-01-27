# Comment créer les Price IDs de test Stripe 🔑

## Problème

Vous avez cette erreur :
```
No such price: 'price_1Sqx2bCn17QPHnzEaBolPd8R'; 
a similar object exists in live mode, but a test mode key was used
```

Cela signifie que vos Price IDs dans le code sont en mode **production** (live), mais vous utilisez une clé de **test**.

## Solution : Créer des Price IDs de test

### Étape 1 : Accéder au mode test dans Stripe

1. Allez sur [https://dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products)
   - Notez le `/test/` dans l'URL - c'est important !

2. Ou allez sur [https://dashboard.stripe.com/test](https://dashboard.stripe.com/test) puis **Products**

### Étape 2 : Créer les produits de test

Pour chaque plan, créez un produit :

#### Plan SMART ($19.99/mois)

1. Cliquez sur **"+ Add product"** (ou **"+ Ajouter un produit"**)
2. **Name** : `Etsmart Smart`
3. **Description** : `Etsmart Smart Plan - 30 analyses per month`
4. Cliquez sur **"Save product"**

Ensuite, créez le prix :
1. Dans le produit créé, cliquez sur **"+ Add price"**
2. **Pricing model** : `Standard pricing`
3. **Price** : `19.99`
4. **Billing period** : `Monthly` (recurring)
5. Cliquez sur **"Add price"**
6. **Copiez le Price ID** qui commence par `price_1...` (il sera différent de celui en production)

#### Plan PRO ($29.99/mois)

1. Créez un produit : `Etsmart Pro`
2. Créez un prix récurrent mensuel : `29.99`
3. **Copiez le Price ID**

#### Plan SCALE ($49.99/mois)

1. Créez un produit : `Etsmart Scale`
2. Créez un prix récurrent mensuel : `49.99`
3. **Copiez le Price ID**

### Étape 3 : Mettre à jour le code

Modifiez le fichier `src/types/subscription.ts` :

```typescript
// Stripe Price IDs for each plan (TEST MODE)
export const STRIPE_PRICE_IDS: Record<PlanId, string | null> = {
  FREE: null,
  SMART: 'price_1VotreNouveauPriceIDTestSMART', // Remplacez par votre Price ID de test
  PRO: 'price_1VotreNouveauPriceIDTestPRO',     // Remplacez par votre Price ID de test
  SCALE: 'price_1VotreNouveauPriceIDTestSCALE',  // Remplacez par votre Price ID de test
};
```

### Étape 4 : Solution alternative - Variables d'environnement

Pour gérer test/production automatiquement, vous pouvez utiliser des variables d'environnement :

1. Créez un fichier `.env.local` pour le développement :
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID_SMART=price_1VotrePriceIDTestSMART
STRIPE_PRICE_ID_PRO=price_1VotrePriceIDTestPRO
STRIPE_PRICE_ID_SCALE=price_1VotrePriceIDTestSCALE
```

2. Sur Netlify, ajoutez les mêmes variables dans **Environment variables**

3. Modifiez `src/types/subscription.ts` pour utiliser les variables d'environnement :

```typescript
export const STRIPE_PRICE_IDS: Record<PlanId, string | null> = {
  FREE: null,
  SMART: process.env.STRIPE_PRICE_ID_SMART || 'price_1Sqx4XCn17QPHnzEfQyRGJN4',
  PRO: process.env.STRIPE_PRICE_ID_PRO || 'price_1Sqx2bCn17QPHnzEaBolPd8R',
  SCALE: process.env.STRIPE_PRICE_ID_SCALE || 'price_1Sqx01Cn17QPHnzEa3ekDcOD',
};
```

---

## Vérification rapide

Pour vérifier que vos Price IDs de test fonctionnent :

1. Utilisez la carte de test : `4242 4242 4242 4242`
2. Essayez de souscrire à un plan
3. Si ça fonctionne, vous verrez le paiement dans [Stripe Dashboard Test Mode](https://dashboard.stripe.com/test/payments)

---

## Note importante

- Les Price IDs de **test** commencent par `price_1...` mais sont différents des Price IDs de **production**
- Vous devez avoir **deux sets** de Price IDs :
  - Un pour le développement/test (avec `sk_test_...`)
  - Un pour la production (avec `sk_live_...`)


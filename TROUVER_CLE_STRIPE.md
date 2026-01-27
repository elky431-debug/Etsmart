# Comment trouver votre clé de test Stripe 🔑

Ce guide vous explique comment récupérer vos clés Stripe de test (`sk_test_...`).

## Étapes pour trouver votre clé de test Stripe

### Option 1 : Si vous voyez un toggle Test/Live mode

1. **Connectez-vous à Stripe Dashboard** : [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. **Cherchez le toggle** en haut à droite qui dit "Test mode" / "Live mode"
3. **Basculez en "Test mode"**
4. Allez dans **Developers** → **API keys**
5. Vous verrez les clés de test (`sk_test_...`)

### Option 2 : Créer une clé de test manuellement (si pas de toggle)

Si vous ne voyez pas de toggle ou de clés de test, créez-en une :

1. **Allez dans Developers** → **API keys** (vous êtes déjà là !)
2. Dans la section **"Clés standard"**, cliquez sur **"+ Créer une clé secrète"** (ou **"+ Create secret key"**)
3. **Important** : Lors de la création, vous devriez voir une option pour choisir entre :
   - **"Test mode"** (Mode test) ⬅️ **Choisissez celui-ci !**
   - **"Live mode"** (Mode production)
4. Donnez un nom à votre clé (ex: "etsmart-test")
5. Cliquez sur **"Créer"** (ou **"Create"**)
6. **Copiez immédiatement** la clé qui s'affiche (elle commence par `sk_test_...`)
   - ⚠️ **Attention** : Vous ne pourrez la voir qu'une seule fois !

### Option 3 : Vérifier si les clés de test existent déjà

Parfois les clés de test sont créées automatiquement mais pas visibles. Essayez :

1. **URL directe pour le mode test** : [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
2. Ou ajoutez `/test/` dans l'URL après `dashboard.stripe.com`
3. Vous devriez voir les clés de test si elles existent

### 4. Révéler la clé secrète existante

Si vous avez déjà une clé secrète de test :

1. Dans la section **"Clés standard"**, trouvez la clé qui commence par `sk_test_...`
2. Cliquez sur **"Révéler"** (ou **"Reveal"**) à côté de la clé
3. La clé complète s'affichera : `sk_test_51...` (environ 100 caractères)

### 5. Copier la clé

1. Cliquez sur **"Copy"** (ou **"Copier"**) à côté de la clé
2. ⚠️ **Important** : Ne partagez JAMAIS cette clé publiquement !

---

## Configuration dans votre projet

### Pour le développement local (`.env.local`)

Créez ou modifiez le fichier `.env.local` à la racine de votre projet :

```env
STRIPE_SECRET_KEY=sk_test_51VotreCleCompleteIci...
STRIPE_WEBHOOK_SECRET=whsec_VotreWebhookSecretIci...
```

### Pour Netlify (etsmart.app)

1. Allez sur [Netlify Dashboard](https://app.netlify.com)
2. Sélectionnez votre site (etsmart)
3. **Site settings** → **Environment variables**
4. Cliquez sur **"Add a variable"**
5. Ajoutez :
   - **Key** : `STRIPE_SECRET_KEY`
   - **Value** : `sk_test_51VotreCleCompleteIci...`
6. Cliquez sur **"Save"**

---

## Trouver le Webhook Secret

Pour tester les webhooks, vous avez aussi besoin de `STRIPE_WEBHOOK_SECRET` :

### En local (avec Stripe CLI)

1. Installez Stripe CLI :
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Ou téléchargez depuis https://stripe.com/docs/stripe-cli
   ```

2. Connectez-vous :
   ```bash
   stripe login
   ```

3. Écoutez les webhooks :
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Stripe CLI affichera un secret comme : `whsec_...`
   - Copiez ce secret dans votre `.env.local` comme `STRIPE_WEBHOOK_SECRET`

### Sur Netlify (production)

1. Dans Stripe Dashboard → **Developers** → **Webhooks**
2. Cliquez sur votre endpoint webhook (ou créez-en un)
3. Cliquez sur **"Reveal"** à côté de **"Signing secret"**
4. Copiez le secret : `whsec_...`
5. Ajoutez-le dans Netlify comme variable d'environnement `STRIPE_WEBHOOK_SECRET`

---

## Vérification

Pour vérifier que votre clé fonctionne :

1. **Vérifiez le préfixe** :
   - ✅ `sk_test_...` → Mode test (pour développement)
   - ✅ `sk_live_...` → Mode production (pour le vrai site)

2. **Testez avec une requête** :
   ```bash
   curl https://api.stripe.com/v1/charges \
     -u sk_test_VotreCle: \
     --silent
   ```
   Si ça fonctionne, vous verrez une liste de charges (vide si vous n'avez pas encore de transactions de test)

---

## ⚠️ Sécurité importante

- ❌ **NE COMMITEZ JAMAIS** votre clé secrète dans Git
- ✅ Vérifiez que `.env.local` est dans `.gitignore`
- ✅ Utilisez `sk_test_...` pour le développement
- ✅ Utilisez `sk_live_...` uniquement en production
- ✅ Ne partagez jamais vos clés secrètes publiquement

---

## Liens utiles

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe API Keys Documentation](https://stripe.com/docs/keys)
- [Stripe Testing Guide](https://stripe.com/docs/testing)


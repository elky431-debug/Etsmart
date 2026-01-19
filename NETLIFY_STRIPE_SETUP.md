# 💳 Configuration Stripe sur Netlify

## ❌ Problème actuel
L'erreur affiche : **"Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable."**

Cela signifie que la variable d'environnement Stripe n'est pas configurée sur Netlify.

---

## ✅ Solution : Ajouter STRIPE_SECRET_KEY sur Netlify

### 📋 ÉTAPE 1 : Récupérer votre clé Stripe

#### 🔗 Lien direct :
**https://dashboard.stripe.com/test/apikeys**

(Utilisez la clé **LIVE** pour la production, ou la clé **TEST** pour les tests)

#### 📝 Étapes :
1. Allez sur https://dashboard.stripe.com
2. Connectez-vous à votre compte Stripe
3. **Basculez en mode LIVE** (en haut à droite, au lieu de "Test mode")
4. Allez dans **Developers** → **API keys**
   (Ou directement : https://dashboard.stripe.com/apikeys)
5. Dans la section **"Secret key"**, cliquez sur **"Reveal test key"** ou **"Reveal live key"**
6. **Copiez la clé secrète** qui commence par :
   - **Test :** `sk_test_...`
   - **LIVE :** `sk_live_...`

**⚠️ IMPORTANT :** 
- Pour la production, utilisez la clé **LIVE** (`sk_live_...`)
- Ne partagez jamais cette clé publiquement !
- Cette clé est différente de la clé publique (`pk_...`)

---

### 📋 ÉTAPE 2 : Ajouter la variable sur Netlify

#### 🔗 Lien direct :
**https://app.netlify.com/sites/etsmart/configuration/env**

(Remplacez `etsmart` par le nom de votre site Netlify si différent)

#### 📝 Étapes :
1. Allez sur : https://app.netlify.com/sites/etsmart/configuration/env
2. Cliquez sur **"Add variable"** (en haut à droite)
3. Remplissez le formulaire :
   - **Key :** `STRIPE_SECRET_KEY`
   - **Value :** Collez votre clé Stripe (`sk_live_...` ou `sk_test_...`)
   - **Secret :** ✅ **Cochez cette case !** (c'est une clé secrète, pas publique)
   - **Scopes :** All scopes
   - **Values :** Same value for all deploy contexts
4. Cliquez sur **"Create variable"**

**⚠️ Important :** Cochez bien **"Secret"** car c'est une clé privée !

---

### 📋 ÉTAPE 3 : Redéployer le site

#### 🔗 Lien direct :
**https://app.netlify.com/sites/etsmart/deploys**

#### 📝 Étapes :
1. Allez sur : https://app.netlify.com/sites/etsmart/deploys
2. Cliquez sur **"Trigger deploy"** (en haut à droite)
3. Sélectionnez **"Deploy site"**
4. Attendez 2-3 minutes que le déploiement se termine
5. Rechargez votre site `etsmart.app`

---

## ✅ Vérification

Après le redéploiement :

- ✅ L'erreur "Stripe is not configured" devrait disparaître
- ✅ Le bouton "Choose Plan" devrait fonctionner
- ✅ Vous devriez être redirigé vers Stripe Checkout

---

## 📋 Récapitulatif des variables maintenant configurées

Vous devriez maintenant avoir **4 variables** sur Netlify :

1. ✅ `NEXT_PUBLIC_SUPABASE_URL` = `https://drjfsqsxxpsjzmabafas.supabase.co`
2. ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_...`
3. ✅ `STRIPE_SECRET_KEY` = `sk_live_...` (à ajouter maintenant)
4. ⏳ `OPENAI_API_KEY` = `sk-proj-...` (optionnel, pour les analyses IA)

---

## 🔍 Distinction importante : Test vs Live

### Mode TEST (pour le développement)
- Clé commence par : `sk_test_...`
- Utilisez pour tester sans frais réels
- Les paiements sont simulés

### Mode LIVE (pour la production)
- Clé commence par : `sk_live_...`
- **Utilisez celle-ci pour etsmart.app en production !**
- Les paiements sont réels

**Pour passer en mode LIVE dans Stripe :**
1. Allez sur https://dashboard.stripe.com
2. En haut à droite, cliquez sur **"Test mode"** pour le désactiver
3. Vous êtes maintenant en mode **LIVE**

---

## 🆘 Si vous n'avez pas encore de compte Stripe

1. Allez sur https://dashboard.stripe.com/register
2. Créez un compte Stripe
3. Complétez la configuration de votre compte
4. Une fois configuré, allez dans **Developers** → **API keys**
5. Suivez les étapes ci-dessus

---

## 💡 Notes importantes

- ⚠️ **Ne partagez jamais votre clé secrète Stripe publiquement**
- ✅ Cochez **"Secret"** dans Netlify pour cette variable
- ✅ Pour la production, utilisez toujours la clé **LIVE** (`sk_live_...`)
- ⚠️ Si vous changez la clé, vous devez **redéployer** pour que les changements prennent effet

---

## ✅ Checklist finale

- [ ] ✅ Clé Stripe récupérée depuis https://dashboard.stripe.com/apikeys
- [ ] ✅ Variable `STRIPE_SECRET_KEY` ajoutée sur Netlify
- [ ] ✅ Case **"Secret"** cochée dans Netlify
- [ ] ✅ Site redéployé sur Netlify
- [ ] ✅ Site testé - le bouton "Choose Plan" fonctionne

---

**Besoin d'aide supplémentaire ?** Consultez :
- `QUICK_STRIPE_SETUP.md` pour un guide rapide
- `STRIPE_SETUP_GUIDE.md` pour un guide complet



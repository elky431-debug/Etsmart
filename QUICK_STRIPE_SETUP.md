# Configuration Rapide Stripe - Développement Local

## ⚡ Étapes Rapides

### 1. Obtenir votre Clé Stripe (2 minutes)

1. Allez sur https://dashboard.stripe.com/test/apikeys
2. Si vous n'avez pas encore de clé de test, cliquez sur **"Create test key"**
3. **Copiez la "Secret key"** (commence par `sk_test_...`)
   - ⚠️ **Ne copiez PAS la "Publishable key"** (commence par `pk_test_...`)

### 2. Ajouter la Clé dans `.env.local`

1. Ouvrez le fichier `.env.local` à la racine du projet
2. Trouvez la ligne : `STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY_HERE`
3. Remplacez `sk_test_YOUR_STRIPE_SECRET_KEY_HERE` par votre vraie clé Stripe

Exemple :
```bash
STRIPE_SECRET_KEY=sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890...
```

### 3. Redémarrer le Serveur

1. Arrêtez le serveur (Ctrl+C dans le terminal)
2. Relancez : `npm run dev`
3. Rechargez la page dans le navigateur

### 4. Tester

1. Allez sur http://localhost:3000/pricing
2. Cliquez sur "Choose Plan" pour Smart
3. Vous devriez être redirigé vers Stripe Checkout (pas d'erreur !)

---

## 🧪 Cartes de Test Stripe

Pour tester les paiements, utilisez ces cartes :

**Carte de test réussie :**
- Numéro : `4242 4242 4242 4242`
- Date : `12/34` (n'importe quelle date future)
- CVC : `123`
- Code postal : `12345`

**Carte refusée :**
- Numéro : `4000 0000 0000 0002`

---

## ⚠️ Important

- ✅ Utilisez la clé **TEST** (`sk_test_...`) pour le développement
- ✅ Ne commitez JAMAIS votre `.env.local` (déjà dans `.gitignore`)
- ✅ Pour la production, utilisez la clé **LIVE** (`sk_live_...`) dans Netlify/Vercel

---

## 🐛 Si ça ne fonctionne toujours pas

1. Vérifiez que vous avez bien redémarré le serveur après avoir modifié `.env.local`
2. Vérifiez que la clé commence bien par `sk_test_...` (pas `pk_test_...`)
3. Vérifiez dans la console du navigateur (F12) s'il y a d'autres erreurs
4. Vérifiez les logs du serveur dans le terminal

---

**C'est tout ! 🚀**


























































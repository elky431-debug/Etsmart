# 🚀 Guide de Déploiement Netlify

## Variables d'environnement requises

Configurez ces variables dans Netlify Dashboard → Site Settings → Environment Variables :

### ⚠️ OBLIGATOIRES

1. **Supabase**
   - `NEXT_PUBLIC_SUPABASE_URL` - URL de votre projet Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Clé anonyme Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` - Clé service role Supabase (pour les opérations admin)

2. **OpenAI** (pour l'analyse IA)
   - `OPENAI_API_KEY` - Votre clé API OpenAI (commence par `sk-`)

### 🔧 OPTIONNELLES (pour le scraping)

3. **Scraping APIs** (pour parser les produits AliExpress/Alibaba)
   - `SCRAPER_API_KEY` - Clé ScraperAPI (optionnel)
   - `SCRAPINGBEE_API_KEY` - Clé ScrapingBee (optionnel)
   - `ZENROWS_API_KEY` - Clé ZenRows (optionnel)
   - `PROXY_LIST` - Liste de proxies séparés par virgules (optionnel)

4. **Stripe** (pour les paiements)
   - `STRIPE_SECRET_KEY` - Clé secrète Stripe (commence par `sk_`)
   - `NEXT_PUBLIC_APP_URL` - URL de votre app Netlify (ex: `https://votre-app.netlify.app`)

## 📋 Étapes de déploiement

### Méthode 1 : Via Netlify CLI (Recommandé)

```bash
# 1. Installer Netlify CLI globalement
npm install -g netlify-cli

# 2. Se connecter à Netlify
netlify login

# 3. Initialiser le projet (si première fois)
netlify init

# 4. Déployer
netlify deploy --prod
```

### Méthode 2 : Via Git (Automatique)

1. **Connecter votre repo GitHub à Netlify**
   - Allez sur [app.netlify.com](https://app.netlify.com)
   - Cliquez sur "Add new site" → "Import an existing project"
   - Connectez votre repo GitHub
   - Netlify détectera automatiquement Next.js

2. **Configurer les variables d'environnement**
   - Site Settings → Environment Variables
   - Ajoutez toutes les variables listées ci-dessus

3. **Déployer**
   - Netlify déploiera automatiquement à chaque push sur `main`/`master`

### Méthode 3 : Via Netlify Dashboard

1. **Drag & Drop**
   ```bash
   # Build localement
   npm run build
   
   # Le dossier .next sera créé
   # Glissez-le sur netlify.com/drop
   ```

## ⚙️ Configuration Netlify

Le fichier `netlify.toml` est déjà configuré avec :
- ✅ Build command: `npm run build`
- ✅ Publish directory: `.next`
- ✅ Next.js plugin: `@netlify/plugin-nextjs`
- ✅ Timeout: 45s (pour éviter le timeout Netlify de 50s)

## 🔍 Vérification post-déploiement

1. **Vérifier les logs**
   ```bash
   netlify logs
   ```

2. **Tester l'API**
   - `https://votre-app.netlify.app/api/ai-analyze` (GET)
   - Devrait retourner le statut de l'API

3. **Vérifier les variables d'environnement**
   - Netlify Dashboard → Site Settings → Environment Variables
   - Toutes les variables doivent être présentes

## 🐛 Dépannage

### Build échoue
- Vérifiez que toutes les dépendances sont dans `package.json`
- Vérifiez les logs Netlify pour les erreurs spécifiques

### API ne répond pas
- Vérifiez que `OPENAI_API_KEY` est configurée
- Vérifiez les logs Netlify Functions
- Testez avec `curl https://votre-app.netlify.app/api/ai-analyze`

### Timeout sur l'API
- Le timeout est configuré à 45s
- Vérifiez les logs pour voir si c'est un timeout Netlify ou OpenAI
- Le prompt a été optimisé pour répondre en <45s

## 📝 Notes importantes

- ⚠️ Le timeout Netlify Pro est de 50 secondes maximum
- ⚠️ Le code utilise un timeout de 45s pour laisser une marge
- ⚠️ Les variables `NEXT_PUBLIC_*` sont exposées au client (sécurité)
- ⚠️ Ne commitez JAMAIS les clés API dans Git

## 🔗 Liens utiles

- [Netlify Docs](https://docs.netlify.com/)
- [Next.js on Netlify](https://docs.netlify.com/integrations/frameworks/next-js/)
- [Netlify CLI](https://cli.netlify.com/)




























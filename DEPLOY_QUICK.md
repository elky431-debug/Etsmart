# ⚡ Déploiement Rapide sur Netlify

## 🚀 Déploiement en 3 Étapes

### 1️⃣ Préparer le Code

```bash
# S'assurer que tout est commité
git add .
git commit -m "Préparation déploiement Netlify"
git push
```

### 2️⃣ Connecter à Netlify

**Option A : Via l'interface (Recommandé)**
1. Allez sur [app.netlify.com](https://app.netlify.com)
2. **Add new site** → **Import an existing project**
3. Connectez votre repository GitHub/GitLab/Bitbucket
4. Sélectionnez le repository **Etsmart**
5. Netlify détectera automatiquement Next.js

**Option B : Via CLI**
```bash
netlify init
```

### 3️⃣ Configurer les Variables d'Environnement

Dans Netlify : **Site settings** → **Environment variables** → Ajoutez :

#### ⚠️ Variables OBLIGATOIRES :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role
OPENAI_API_KEY=sk-...
NANONBANANA_API_KEY=758a24cfaef8c64eed9164858b941ecc
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://votre-site.netlify.app
NEXT_PUBLIC_SITE_URL=https://votre-site.netlify.app
```

### ✅ C'est Tout !

Netlify déploiera automatiquement votre site. Consultez `DEPLOY_NETLIFY_COMPLETE.md` pour plus de détails.


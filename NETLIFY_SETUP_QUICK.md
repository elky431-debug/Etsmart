# 🚀 Configuration Rapide Netlify - Variables d'environnement

## ⚠️ Problème actuel
L'application affiche : **"Supabase is not configured"** car les variables d'environnement ne sont pas configurées sur Netlify.

## ✅ Solution (5 minutes)

### Étape 1 : Récupérer vos clés Supabase

1. Allez sur [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **Project Settings** → **API**
4. Copiez les valeurs suivantes :
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public key** → `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Étape 2 : Configurer sur Netlify

1. Allez sur [Netlify Dashboard](https://app.netlify.com)
2. Sélectionnez votre site **Etsmart**
3. Allez dans **Site settings** → **Environment variables**
4. Cliquez sur **Add variable** et ajoutez chaque variable :

   **Variable 1:**
   - Key: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://xxxxx.supabase.co` (votre URL Supabase)
   - Scopes: **All scopes**
   
   **Variable 2:**
   - Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (votre clé anon)
   - Scopes: **All scopes**

   **Variable 3 (optionnel mais recommandé):**
   - Key: `OPENAI_API_KEY`
   - Value: `sk-...` (votre clé API OpenAI pour les analyses IA)
   - Scopes: **All scopes**

### Étape 3 : Redéployer

1. Dans Netlify, allez dans **Deploys**
2. Cliquez sur **Trigger deploy** → **Deploy site**
3. Attendez que le déploiement se termine (2-3 minutes)
4. Rechargez `etsmart.app` - l'erreur devrait disparaître !

## 🔍 Vérification

Après le déploiement, vérifiez :
- ✅ La page de connexion fonctionne sans erreur
- ✅ Vous pouvez vous inscrire/connecter
- ✅ Les analyses fonctionnent (nécessite OpenAI API key)

## ⚡ Commandes rapides (si vous avez Netlify CLI)

```bash
# Installer Netlify CLI (si pas déjà fait)
npm install -g netlify-cli

# Se connecter
netlify login

# Ajouter les variables (remplacez les valeurs)
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://xxxxx.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Redéployer
netlify deploy --prod
```

## 🆘 Si ça ne fonctionne toujours pas

1. Vérifiez que les noms des variables sont **exactement** identiques (sensible à la casse)
2. Vérifiez qu'il n'y a pas d'espaces avant/après les valeurs
3. Vérifiez les logs de build dans Netlify pour voir d'éventuelles erreurs
4. Attendez 2-3 minutes après avoir ajouté les variables avant de redéployer

---

**Besoin d'aide ?** Consultez `NETLIFY_ENV_SETUP.md` pour plus de détails.





















































# 📋 Valeurs des Variables d'Environnement Netlify

## 🔑 Où trouver chaque valeur

### Variable 1 : `NEXT_PUBLIC_SUPABASE_URL`

**Où :** Supabase Dashboard → Project Settings → API

**Format :** `https://xxxxxxxxxxxxx.supabase.co`

**Exemple :**
```
https://abcdefghijklmnop.supabase.co
```

**Étapes :**
1. Allez sur https://app.supabase.com
2. Sélectionnez votre projet
3. Cliquez sur ⚙️ **Project Settings** (en bas du menu gauche)
4. Cliquez sur **API** dans le menu de gauche
5. Dans la section **Project URL**, copiez l'URL complète (commence par `https://`)

**⚠️ Important :** Copiez l'URL complète avec `https://` et `.supabase.co` à la fin

---

### Variable 2 : `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Où :** Supabase Dashboard → Project Settings → API → Project API keys

**Format :** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjI3OTIyMCwiZXhwIjoxOTMxODU1MjIwfQ...`

**Exemple (tronqué) :**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjI3OTIyMCwiZXhwIjoxOTMxODU1MjIwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Étapes :**
1. Allez sur https://app.supabase.com
2. Sélectionnez votre projet
3. Cliquez sur ⚙️ **Project Settings** → **API**
4. Descendez jusqu'à la section **Project API keys**
5. Cherchez la ligne avec :
   - **Key type :** `anon`
   - **Role :** `public`
6. Cliquez sur l'icône 📋 de copie à droite de la clé
7. Cette clé est très longue (environ 200-300 caractères), copiez-la entièrement

**⚠️ Important :** C'est une clé **publique**, c'est normal qu'elle soit visible. Ne copiez PAS la clé `service_role` (celle-ci est secrète).

---

### Variable 3 : `OPENAI_API_KEY` (Optionnel mais nécessaire pour les analyses IA)

**Où :** OpenAI Platform → API Keys

**Format :** `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Exemple (tronqué) :**
```
sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890def123
```

**Étapes :**
1. Allez sur https://platform.openai.com/api-keys
2. Connectez-vous à votre compte OpenAI
3. Si vous n'avez pas de clé :
   - Cliquez sur **Create new secret key**
   - Donnez-lui un nom (ex: "Etsmart Production")
   - Cliquez sur **Create secret key**
   - **⚠️ IMPORTANT :** Copiez la clé immédiatement, vous ne pourrez plus la voir après !
4. Si vous avez déjà une clé :
   - Cliquez sur l'icône 📋 à droite pour la copier

**⚠️ Important :** Si vous perdez cette clé, vous devrez en créer une nouvelle.

---

## 📝 Résumé des valeurs à copier

| Variable | Où la trouver | Format | Longueur approximative |
|----------|---------------|--------|------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | `https://xxxxx.supabase.co` | ~40 caractères |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key | `eyJhbG...` | ~200-300 caractères |
| `OPENAI_API_KEY` | OpenAI Platform → API Keys | `sk-proj-...` | ~50-60 caractères |

---

## ✅ Comment vérifier que vous avez les bonnes valeurs

### Pour Supabase :
- **URL :** Doit commencer par `https://` et se terminer par `.supabase.co`
- **ANON KEY :** Doit commencer par `eyJ` et être très longue (200+ caractères)

### Pour OpenAI :
- **API KEY :** Doit commencer par `sk-` et faire environ 50-60 caractères

---

## 🚨 Erreurs communes

1. **Oublier le `https://` dans l'URL Supabase**
   - ❌ `abcdefghijklmnop.supabase.co`
   - ✅ `https://abcdefghijklmnop.supabase.co`

2. **Copier la mauvaise clé Supabase**
   - ❌ `service_role` (clé secrète)
   - ✅ `anon` `public` (clé publique)

3. **Oublier de copier toute la clé Supabase**
   - Les clés sont très longues, assurez-vous de tout copier !

4. **Espaces avant/après les valeurs**
   - Netlify ne doit pas avoir d'espaces au début ou à la fin des valeurs

---

## 🔍 Comment trouver votre projet Supabase si vous ne savez pas lequel utiliser

1. Allez sur https://app.supabase.com
2. Vous verrez la liste de tous vos projets
3. Cliquez sur le projet que vous utilisez pour Etsmart
4. Si vous n'en avez pas, créez-en un nouveau :
   - Cliquez sur **New Project**
   - Choisissez une organisation
   - Donnez un nom (ex: "Etsmart")
   - Choisissez un mot de passe pour la base de données
   - Cliquez sur **Create new project**

---

## 💡 Astuce : Utiliser Netlify CLI

Si vous préférez utiliser la ligne de commande :

```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Se connecter
netlify login

# Ajouter les variables (remplacez les valeurs par les vôtres)
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://xxxxx.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "eyJhbG..."
netlify env:set OPENAI_API_KEY "sk-proj-..."

# Vérifier que les variables sont bien définies
netlify env:list

# Redéployer
netlify deploy --prod
```

---

**Besoin d'aide ?** Si vous avez des difficultés à trouver vos clés, consultez :
- [Documentation Supabase - API Keys](https://supabase.com/docs/guides/api/api-keys)
- [Documentation OpenAI - API Keys](https://platform.openai.com/docs/guides/api-keys)








































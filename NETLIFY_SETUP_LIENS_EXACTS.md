# 🔗 Liens Exact pour Configuration Netlify - Guide Étape par Étape

## 🎯 Objectif
Configurer les variables d'environnement Supabase et OpenAI sur Netlify pour que votre application fonctionne.

---

## 📋 ÉTAPE 1 : Récupérer NEXT_PUBLIC_SUPABASE_URL

### 🔗 Lien direct :
**https://app.supabase.com/project/_/settings/api**

### 📝 Étapes détaillées :
1. Cliquez sur le lien ci-dessus (ou allez sur https://app.supabase.com)
2. Si vous n'êtes pas connecté, connectez-vous
3. **Sélectionnez votre projet** Etsmart dans la liste
4. Si la page ne s'ouvre pas directement sur les paramètres API :
   - Cliquez sur ⚙️ **Settings** (en bas du menu de gauche)
   - Cliquez sur **API** dans le sous-menu
5. Dans la section **Project URL**, vous verrez une URL comme :
   ```
   https://abcdefghijklmnop.supabase.co
   ```
6. **Copiez cette URL complète** (cliquez sur l'icône 📋 à droite pour copier)

### ✅ Valeur à copier :
```
https://xxxxxxxxxxxxx.supabase.co
```

---

## 📋 ÉTAPE 2 : Récupérer NEXT_PUBLIC_SUPABASE_ANON_KEY

### 🔗 Lien direct :
**https://app.supabase.com/project/_/settings/api**

(C'est la même page que l'étape 1)

### 📝 Étapes détaillées :
1. Vous êtes toujours sur la même page (Settings → API)
2. **Descendez** jusqu'à la section **Project API keys**
3. Vous verrez un tableau avec plusieurs clés
4. Cherchez la ligne avec :
   - **Key type :** `anon`
   - **Role :** `public`
   - **Name :** `anon` `public` (ou similaire)
5. Cliquez sur l'icône 📋 **Copy** à droite de cette clé
6. Cette clé est très longue (200-300 caractères), assurez-vous de tout copier !

### ✅ Valeur à copier :
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjI3OTIyMCwiZXhwIjoxOTMxODU1MjIwfQ...
```
(Beaucoup plus long que ça - environ 200-300 caractères au total)

### ⚠️ Attention :
- Copiez la clé `anon` `public` (clé publique)
- **NE copiez PAS** la clé `service_role` (c'est la clé secrète)

---

## 📋 ÉTAPE 3 : Récupérer OPENAI_API_KEY (Optionnel mais recommandé)

### 🔗 Lien direct :
**https://platform.openai.com/api-keys**

### 📝 Étapes détaillées :
1. Cliquez sur le lien ci-dessus
2. Si vous n'êtes pas connecté, connectez-vous avec votre compte OpenAI
3. Si vous avez déjà une clé :
   - Vous verrez une liste de vos clés API
   - Cliquez sur l'icône 📋 **Copy** à droite de la clé que vous voulez utiliser
4. Si vous n'avez pas de clé :
   - Cliquez sur le bouton **+ Create new secret key** (en haut à droite)
   - Donnez un nom (ex: "Etsmart Production")
   - Cliquez sur **Create secret key**
   - **⚠️ IMPORTANT :** Copiez la clé immédiatement ! Vous ne pourrez plus la voir après avoir fermé cette fenêtre

### ✅ Valeur à copier :
```
sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
(Environ 50-60 caractères, commence par `sk-`)

---

## 📋 ÉTAPE 4 : Ajouter les variables sur Netlify

### 🔗 Lien direct (remplacez `etsmart` par votre nom de site Netlify) :
**https://app.netlify.com/sites/etsmart/configuration/env**

Ou suivez ces étapes :

### 📝 Méthode 1 : Navigation manuelle
1. Allez sur **https://app.netlify.com**
2. Cliquez sur votre site **etsmart** (ou le nom de votre site)
3. Dans le menu de gauche, cliquez sur **Site settings**
4. Dans le menu de gauche du panneau Site settings, cliquez sur **Environment variables**

### 📝 Méthode 2 : Lien direct
1. Allez sur **https://app.netlify.com/sites/etsmart/configuration/env**
   (Remplacez `etsmart` par le nom de votre site Netlify si différent)

### 📝 Ajouter les variables :

#### Variable 1 : NEXT_PUBLIC_SUPABASE_URL
1. Cliquez sur le bouton **Add variable** (en haut à droite)
2. **Key :** `NEXT_PUBLIC_SUPABASE_URL`
3. **Value :** Collez l'URL que vous avez copiée à l'étape 1 (ex: `https://xxxxx.supabase.co`)
4. **Scopes :** Sélectionnez **All scopes** (ou laissez par défaut)
5. Cliquez sur **Save**

#### Variable 2 : NEXT_PUBLIC_SUPABASE_ANON_KEY
1. Cliquez sur **Add variable** à nouveau
2. **Key :** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Value :** Collez la clé anon que vous avez copiée à l'étape 2
4. **Scopes :** Sélectionnez **All scopes**
5. Cliquez sur **Save**

#### Variable 3 : OPENAI_API_KEY
1. Cliquez sur **Add variable** à nouveau
2. **Key :** `OPENAI_API_KEY`
3. **Value :** Collez la clé OpenAI que vous avez copiée à l'étape 3
4. **Scopes :** Sélectionnez **All scopes**
5. Cliquez sur **Save**

---

## 📋 ÉTAPE 5 : Redéployer le site

### 🔗 Lien direct (remplacez `etsmart` par votre nom de site) :
**https://app.netlify.com/sites/etsmart/deploys**

### 📝 Étapes :
1. Allez sur **https://app.netlify.com/sites/etsmart/deploys**
   (Ou : Site → **Deploys** dans le menu de gauche)
2. Cliquez sur le bouton **Trigger deploy** (en haut à droite)
3. Sélectionnez **Deploy site**
4. Attendez 2-3 minutes que le déploiement se termine
5. Une fois terminé, rechargez votre site `etsmart.app`

### ✅ Vérification :
- L'erreur "Supabase is not configured" devrait disparaître
- Vous devriez pouvoir vous connecter/inscrire
- Les analyses devraient fonctionner (si OPENAI_API_KEY est configurée)

---

## 📋 RÉCAPITULATIF DES LIENS

### Supabase :
- **Paramètres API :** https://app.supabase.com/project/_/settings/api
  (Remplacez `_` par l'ID de votre projet si nécessaire)

### OpenAI :
- **Créer/Gérer les clés API :** https://platform.openai.com/api-keys

### Netlify :
- **Variables d'environnement :** https://app.netlify.com/sites/etsmart/configuration/env
  (Remplacez `etsmart` par votre nom de site)
- **Déploiements :** https://app.netlify.com/sites/etsmart/deploys
  (Remplacez `etsmart` par votre nom de site)
- **Tableau de bord principal :** https://app.netlify.com

---

## 🆘 Si vous ne trouvez pas votre projet Supabase

### 🔗 Liste de tous vos projets :
**https://app.supabase.com/projects**

1. Cliquez sur ce lien
2. Vous verrez la liste de tous vos projets
3. Cliquez sur le projet que vous utilisez pour Etsmart
4. Si vous n'en avez pas, cliquez sur **New Project** pour en créer un

---

## ✅ Checklist finale

- [ ] ✅ `NEXT_PUBLIC_SUPABASE_URL` ajoutée sur Netlify
- [ ] ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ajoutée sur Netlify
- [ ] ✅ `OPENAI_API_KEY` ajoutée sur Netlify (optionnel)
- [ ] ✅ Site redéployé sur Netlify
- [ ] ✅ Site testé - l'erreur a disparu

---

## 💡 Astuce : Trouver l'ID de votre projet Supabase

Si les liens avec `_` ne fonctionnent pas :

1. Allez sur https://app.supabase.com/projects
2. Cliquez sur votre projet
3. L'URL dans votre navigateur sera : `https://app.supabase.com/project/[ID-DU-PROJET]`
4. Notez cet ID et utilisez-le dans les liens ci-dessus

Exemple : Si votre URL est `https://app.supabase.com/project/abcdefghijklmnop`
Alors utilisez : `https://app.supabase.com/project/abcdefghijklmnop/settings/api`

---

**Besoin d'aide supplémentaire ?** Consultez :
- `NETLIFY_SETUP_QUICK.md` pour un guide rapide
- `NETLIFY_VARIABLES_VALUES.md` pour plus de détails sur les valeurs























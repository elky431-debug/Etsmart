# 🔗 Liens Exact pour VOTRE Projet Supabase

## ✅ Votre ID de Projet Supabase
D'après votre dashboard, votre ID de projet est : **`drjfsqsxxpsjzmabafas`**

---

## 📋 ÉTAPE 1 : Récupérer NEXT_PUBLIC_SUPABASE_URL

### 🔗 Lien DIRECT pour votre projet :
**https://supabase.com/dashboard/project/drjfsqsxxpsjzmabafas/settings/api**

**Ou via app.supabase.com :**
**https://app.supabase.com/project/drjfsqsxxpsjzmabafas/settings/api**

### 📝 Étapes :
1. Cliquez sur le lien ci-dessus
2. Vous arriverez directement sur la page **Settings → API**
3. Dans la section **Project URL**, vous verrez quelque chose comme :
   ```
   https://drjfsqsxxpsjzmabafas.supabase.co
   ```
4. **Copiez cette URL complète** (cliquez sur l'icône 📋 pour copier)

### ✅ Valeur à copier :
```
https://drjfsqsxxpsjzmabafas.supabase.co
```
(C'est probablement votre URL - elle correspond à votre ID de projet)

---

## 📋 ÉTAPE 2 : Récupérer NEXT_PUBLIC_SUPABASE_ANON_KEY

### 🔗 Même lien que l'étape 1 :
**https://supabase.com/dashboard/project/drjfsqsxxpsjzmabafas/settings/api**

### 📝 Étapes :
1. Vous êtes toujours sur la même page (Settings → API)
2. **Descendez** dans la page jusqu'à la section **Project API keys**
3. Vous verrez un tableau avec plusieurs clés
4. Cherchez la ligne avec :
   - **Key type :** `anon`
   - **Role :** `public`
5. Cliquez sur l'icône 📋 **Copy** à droite de cette clé
6. Cette clé est très longue (200-300 caractères), copiez-la entièrement

### ✅ Valeur à copier :
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
(Beaucoup plus long - environ 200-300 caractères au total)

---

## 📋 ÉTAPE 3 : Configurer sur Netlify

### 🔗 Lien Netlify pour les variables d'environnement :
**https://app.netlify.com/sites/etsmart/configuration/env**

(Remplacez `etsmart` par le nom exact de votre site Netlify si différent)

### 📝 Ajouter les variables :

1. **Variable 1 : NEXT_PUBLIC_SUPABASE_URL**
   - Key : `NEXT_PUBLIC_SUPABASE_URL`
   - Value : `https://drjfsqsxxpsjzmabafas.supabase.co` (votre URL copiée)

2. **Variable 2 : NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Key : `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value : (votre clé anon copiée - très longue)

3. **Variable 3 : OPENAI_API_KEY** (optionnel)
   - Key : `OPENAI_API_KEY`
   - Value : (votre clé OpenAI depuis https://platform.openai.com/api-keys)

---

## 📋 ÉTAPE 4 : Redéployer

### 🔗 Lien Netlify pour redéployer :
**https://app.netlify.com/sites/etsmart/deploys**

1. Cliquez sur **Trigger deploy** → **Deploy site**
2. Attendez 2-3 minutes
3. Rechargez votre site

---

## 🔗 RÉCAPITULATIF - LIENS DIRECTS

### Supabase (Votre Projet) :
- **Paramètres API :** https://supabase.com/dashboard/project/drjfsqsxxpsjzmabafas/settings/api
- **Alternative :** https://app.supabase.com/project/drjfsqsxxpsjzmabafas/settings/api

### OpenAI :
- **Créer/Gérer les clés API :** https://platform.openai.com/api-keys

### Netlify :
- **Variables d'environnement :** https://app.netlify.com/sites/etsmart/configuration/env
- **Déploiements :** https://app.netlify.com/sites/etsmart/deploys

---

## ✅ Checklist Rapide

1. [ ] Aller sur : https://supabase.com/dashboard/project/drjfsqsxxpsjzmabafas/settings/api
2. [ ] Copier **Project URL** (probablement `https://drjfsqsxxpsjzmabafas.supabase.co`)
3. [ ] Copier la clé **anon public** (très longue, 200-300 caractères)
4. [ ] Aller sur : https://app.netlify.com/sites/etsmart/configuration/env
5. [ ] Ajouter `NEXT_PUBLIC_SUPABASE_URL` avec votre URL
6. [ ] Ajouter `NEXT_PUBLIC_SUPABASE_ANON_KEY` avec votre clé
7. [ ] (Optionnel) Ajouter `OPENAI_API_KEY` avec votre clé OpenAI
8. [ ] Redéployer sur Netlify : https://app.netlify.com/sites/etsmart/deploys
9. [ ] Vérifier que l'erreur a disparu sur votre site

---

**💡 Astuce :** Vous pouvez accéder directement aux paramètres API depuis votre dashboard Supabase actuel :
- Dans le menu de gauche, cliquez sur **Project Settings** (en bas)
- Puis cliquez sur **API** dans le sous-menu





































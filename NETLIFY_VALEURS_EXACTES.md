# ✅ Valeurs Exactes pour Netlify - Votre Projet

## 📍 Vous êtes sur la bonne page !
Vous êtes actuellement sur : **https://app.supabase.com/project/drjfsqsxxpsjzmabafas/settings/api**

---

## 🔑 Variable 1 : NEXT_PUBLIC_SUPABASE_URL

### ✅ Valeur à copier :
```
https://drjfsqsxxpsjzmabafas.supabase.co
```

**Comment obtenir :**
- Votre ID de projet est : `drjfsqsxxpsjzmabafas`
- L'URL est toujours : `https://[ID-DU-PROJET].supabase.co`
- Donc : `https://drjfsqsxxpsjzmabafas.supabase.co`

**Note :** Vous pouvez aussi trouver cette URL en haut de la page des paramètres API, dans la section "Project URL" ou dans l'onglet "General" des settings.

---

## 🔑 Variable 2 : NEXT_PUBLIC_SUPABASE_ANON_KEY

### ✅ Valeur à copier :
Sur la page où vous êtes, dans la section **"Publishable key"**, vous voyez :

**API KEY :** `sb_publishable_CjzHvoNZLYEGHNDqFc14XA_oug2R...`

### 📝 Étapes :
1. Dans la section **"Publishable key"** (en haut de la page)
2. Vous verrez une ligne avec :
   - **NAME :** `default`
   - **API KEY :** `sb_publishable_CjzHvoNZLYEGHNDqFc14XA_oug2R...`
3. **Cliquez sur l'icône 📋 (copie)** à droite de la clé
4. **Copiez la clé ENTIÈRE** (elle commence par `sb_publishable_` et est assez longue)

### ⚠️ Important :
- Supabase a mis à jour ses clés API récemment
- Les nouvelles clés commencent par `sb_publishable_` ou `sb_secret_`
- Si vous avez des problèmes, vérifiez l'onglet **"Legacy anon, service_role API keys"** (voir ci-dessous)

---

## 🔄 Si vous avez besoin des anciennes clés (Legacy)

Si le code utilise encore les anciennes clés, ou si vous préférez :

1. Sur la page API, cliquez sur l'onglet **"Legacy anon, service_role API keys"**
2. Vous verrez deux clés :
   - **anon public** : Pour `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** : Pour `SUPABASE_SERVICE_ROLE_KEY` (optionnel)

**Note :** Les nouvelles clés `sb_publishable_` devraient fonctionner normalement, mais si vous avez des problèmes, utilisez les clés Legacy.

---

## 📋 Récapitulatif des valeurs à mettre sur Netlify

### Sur Netlify : https://app.netlify.com/sites/etsmart/configuration/env

Ajoutez ces 2 variables :

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Key : `NEXT_PUBLIC_SUPABASE_URL`
   - Value : `https://drjfsqsxxpsjzmabafas.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Key : `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value : La clé **Publishable key** que vous voyez sur la page (commence par `sb_publishable_...`)

3. **OPENAI_API_KEY** (optionnel mais recommandé)
   - Key : `OPENAI_API_KEY`
   - Value : Votre clé OpenAI depuis https://platform.openai.com/api-keys

---

## ✅ Checklist

- [ ] ✅ URL Supabase : `https://drjfsqsxxpsjzmabafas.supabase.co`
- [ ] ✅ Clé Publishable : `sb_publishable_...` (copiée depuis Supabase)
- [ ] ✅ Clé OpenAI : `sk-proj-...` (si vous l'utilisez)
- [ ] ✅ Variables ajoutées sur Netlify
- [ ] ✅ Site redéployé sur Netlify

---

## 🔍 Vérification

Après avoir ajouté les variables sur Netlify :

1. Allez sur : **https://app.netlify.com/sites/etsmart/deploys**
2. Cliquez sur **Trigger deploy** → **Deploy site**
3. Attendez 2-3 minutes
4. Rechargez votre site `etsmart.app`
5. L'erreur "Supabase is not configured" devrait disparaître !

---

## 🆘 Si ça ne fonctionne pas

1. **Vérifiez que vous avez copié la clé ENTIÈRE** (les nouvelles clés peuvent être longues)
2. **Vérifiez qu'il n'y a pas d'espaces** avant/après les valeurs
3. **Essayez les clés Legacy** : Onglet "Legacy anon, service_role API keys"
4. **Redéployez** : Les changements de variables nécessitent un redéploiement

---

**Besoin d'aide ?** Consultez les autres guides :
- `NETLIFY_SETUP_QUICK.md` pour un guide rapide
- `NETLIFY_SETUP_MON_PROJET.md` pour les liens spécifiques à votre projet
























































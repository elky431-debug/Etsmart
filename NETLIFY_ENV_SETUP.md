# Configuration des variables d'environnement sur Netlify

## ✅ Problème résolu

Le build Netlify échouait car les variables d'environnement Supabase n'étaient pas disponibles pendant le pré-rendu. Le code a été modifié pour gérer gracieusement l'absence de ces variables pendant le build.

**Cependant**, pour que l'application fonctionne correctement en production, vous devez configurer les variables d'environnement sur Netlify.

## 📋 Variables d'environnement requises

Vous devez ajouter les variables suivantes dans Netlify :

1. **`NEXT_PUBLIC_SUPABASE_URL`**
   - Votre URL Supabase (ex: `https://xxxxx.supabase.co`)
   - Trouvable dans : Supabase Dashboard → Project Settings → API → Project URL

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - Votre clé anonyme Supabase (clé publique)
   - Trouvable dans : Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`

3. **`SUPABASE_SERVICE_ROLE_KEY`** (optionnel, pour les opérations admin)
   - Votre clé service role Supabase (clé privée, à garder secrète)
   - Trouvable dans : Supabase Dashboard → Project Settings → API → Project API keys → `service_role` `secret`
   - ⚠️ **Ne jamais exposer cette clé côté client !**

4. **`OPENAI_API_KEY`** (requis pour l'analyse IA)
   - Votre clé API OpenAI
   - Trouvable sur : https://platform.openai.com/api-keys

5. **`GEMINI_API_KEY`** (recommandé pour la génération d’images)
   - Clé Google AI Studio / Gemini utilisée par `/api/generate-images`.

6. **`GEMINI_PRO_IMAGE_NATIVE`** (optionnel, défaut : désactivé)
   - Si `true` ou `1` : le bouton **Pro** utilise d’abord **Gemini 3 Pro Image** (quota journalier souvent très bas).
   - Si absent / `false` : le bouton **Pro** utilise **Gemini 3.1 Flash Image** (`gemini-3.1-flash-image-preview`) puis repli sur **2.5 Flash Image** — mieux pour des lots (ex. 7 images).

7. **`GEMINI_CHUNK_SINGLE_WALL_MS`** (optionnel, défaut : `21000`)
   - Budget temps (ms) pour **une** requête « 1 image » (génération rapide). Sur Netlify gratuit, le gateway coupe vers **~26 s** : le défaut laisse de la marge pour auth + sharp + JSON. Sur Vercel / Netlify Pro (fonctions longues), tu peux monter (ex. `52000`).

## 🔧 Comment configurer sur Netlify

### Étape 1 : Accéder aux paramètres d'environnement

1. Connectez-vous à [Netlify](https://app.netlify.com)
2. Sélectionnez votre projet **Etsmart**
3. Allez dans **Site settings** (Paramètres du site)
4. Dans le menu de gauche, cliquez sur **Build & deploy** → **Environment** → **Environment variables**

### Étape 2 : Ajouter les variables

Pour chaque variable, cliquez sur **Add variable** et ajoutez :

- **Key** : Le nom de la variable (ex: `NEXT_PUBLIC_SUPABASE_URL`)
- **Value** : La valeur de la variable
- **Scopes** : Sélectionnez **All scopes** (ou spécifiez selon vos besoins)

### Étape 3 : Redéployer

Après avoir ajouté toutes les variables :

1. Allez dans **Deploys** (Déploiements)
2. Cliquez sur **Trigger deploy** → **Deploy site**
3. Le build devrait maintenant réussir et l'application fonctionnera correctement

## 🔍 Vérification

Après le déploiement, vérifiez que :

1. ✅ Le build passe sans erreur
2. ✅ L'application se charge correctement
3. ✅ L'authentification fonctionne (connexion/inscription)
4. ✅ Les analyses de produits fonctionnent (nécessite OpenAI API key)

## ⚠️ Notes importantes

- Les variables commençant par `NEXT_PUBLIC_` sont exposées côté client
- Ne partagez jamais vos clés API publiquement
- Si vous changez les variables, vous devez redéployer pour que les changements prennent effet
- Le build passera maintenant même sans les variables, mais l'application ne fonctionnera pas correctement à l'exécution sans elles

## 🆘 En cas de problème

Si le build échoue encore :

1. Vérifiez que les noms des variables sont **exactement** identiques (sensible à la casse)
2. Vérifiez que les valeurs sont correctes (pas d'espaces en début/fin)
3. Vérifiez les logs de build dans Netlify pour voir les erreurs spécifiques
4. Assurez-vous que toutes les variables requises sont présentes



























































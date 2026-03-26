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

5. **`GEMINI_API_KEY`** (recommandé — **visuels listing** `/api/generate-images`, **bannière** `/api/generate-banner`, **logo** `/api/generate-logo`)
   - Clé [Google AI Studio](https://aistudio.google.com/apikey) ou Google Cloud — modèle image `gemini-2.5-flash-image`.

6. **`STABILITY_API_KEY`** (optionnel — module legacy non utilisé par bannière/logo ni par le flux Gemini des visuels)
   - Tu peux l’omettre si tout passe par Gemini.

7. **`GEMINI_CHUNK_SINGLE_WALL_MS`** (optionnel)
   - Sur **Netlify**, défaut interne **~25 s** (budget batch interne).
   - Hors Netlify, budgets longs (flash / pro).
   - Plage si tu forces la variable : `12000`–`120000`.

8. **`GEMINI_NETLIFY_FAST_HTTP_MS`** (optionnel)
   - Timeout **une** requête HTTP vers Gemini pour **1 image** en mode chunked sur Netlify.
   - Défaut **22000** (22 s). Plage **12000**–**26000** si tu la définis (laisse de la marge pour auth + sharp + upload **dans** le même plafond gateway ~26 s).
   - Si Nano Banana 2 dépasse souvent ce budget → **Vercel** ou modèle **2.5** sur Netlify.

9. **`NEXT_PUBLIC_IMAGE_PRO_CONCURRENCY`** (optionnel)
   - Sur le site déployé, le client lance **2** requêtes image en parallèle en mode **Pro** (accélère les lots type 7 images).
   - Mets **`1`** pour revenir au comportement séquentiel si tu vois trop de **504** ou **429**.

10. **`ALIEXPRESS_APP_KEY`** (requis pour importer les commandes AliExpress)
   - Clé application AliExpress Open Platform.

11. **`ALIEXPRESS_APP_SECRET`** (requis pour la signature MD5 AliExpress)
   - Secret application AliExpress Open Platform.

12. **`ALIEXPRESS_ACCESS_TOKEN`** (requis comme fallback serveur)
   - Token AliExpress global utilisé si l’utilisateur n’a pas encore connecté son OAuth.

13. **`PARCELSAPP_API_KEY`** (requis pour l’enregistrement tracking)
   - Clé API Parcelsapp utilisée par `/api/orders/add` et `/api/orders/poll`.

14. **`CRON_SECRET`** (requis pour sécuriser le cron)
   - Secret envoyé dans le header `x-cron-secret` vers `/api/orders/poll`.

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



























































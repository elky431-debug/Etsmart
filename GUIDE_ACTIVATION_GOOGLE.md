# 🚀 Guide d'activation de la connexion Google - Étape par étape

## 📍 Étape 1 : Activer Google dans Supabase

### 1.1 Aller sur la page des Providers

Dans votre dashboard Supabase (où vous êtes actuellement) :

1. **Dans le menu de gauche**, sous "CONFIGURATION"
2. **Cliquez sur "Sign In / Providers"** (juste au-dessus de "OAuth Server" où vous êtes)
3. Vous verrez une liste de providers (Email, Google, GitHub, etc.)

### 1.2 Activer Google

1. **Trouvez "Google"** dans la liste
2. **Cliquez sur le toggle** pour l'activer (il passera en vert)
3. **Ne fermez pas cette page**, vous en aurez besoin après

---

## 📍 Étape 2 : Créer les identifiants Google OAuth

### 2.1 Aller sur Google Cloud Console

1. **Allez sur** : https://console.cloud.google.com/
2. **Connectez-vous** avec votre compte Google
3. **Créez un projet** ou **sélectionnez un projet existant** :
   - Cliquez sur le sélecteur de projet en haut
   - Cliquez sur "New Project"
   - Donnez un nom (ex: "Etsmart OAuth")
   - Cliquez sur "Create"

### 2.2 Activer l'API Google+

1. **Allez dans** "APIs & Services" > "Library" (ou "Bibliothèque")
2. **Recherchez** "Google+ API"
3. **Cliquez dessus** et **activez-la** (bouton "Enable")

### 2.3 Créer les identifiants OAuth

1. **Allez dans** "APIs & Services" > "Credentials" (ou "Identifiants")
2. **Cliquez sur** "Create Credentials" > "OAuth client ID"
3. **Si c'est la première fois**, configurez l'écran de consentement :
   - Choisissez "External" (ou "Externe")
   - Remplissez les informations de base
   - Continuez jusqu'à la fin

4. **Créez l'OAuth client ID** :
   - **Application type** : Sélectionnez "Web application"
   - **Name** : Donnez un nom (ex: "Etsmart Web")
   
   - **Authorized JavaScript origins** : Ajoutez ces URLs :
     ```
     http://localhost:3000
     https://etsmart.app
     ```
   
   - **Authorized redirect URIs** : Ajoutez cette URL :
     ```
     https://[VOTRE_PROJET_ID].supabase.co/auth/v1/callback
     ```
     
     **⚠️ IMPORTANT** : Remplacez `[VOTRE_PROJET_ID]` par votre ID de projet Supabase.
     
     **Pour trouver votre ID** :
     - Dans Supabase Dashboard, regardez l'URL de votre projet
     - Format : `https://[PROJECT_ID].supabase.co`
     - Exemple : Si votre URL est `https://abcdefghijklmnop.supabase.co`, alors votre redirect URI sera :
       ```
       https://abcdefghijklmnop.supabase.co/auth/v1/callback
       ```

5. **Cliquez sur "Create"**
6. **Copiez les identifiants** :
   - **Client ID** (vous en aurez besoin)
   - **Client Secret** (vous en aurez besoin)

---

## 📍 Étape 3 : Configurer Google dans Supabase

### 3.1 Retourner sur Supabase

1. **Retournez sur** la page "Sign In / Providers" dans Supabase
2. **Cliquez sur "Google"** pour ouvrir la configuration

### 3.2 Ajouter les identifiants

1. **Collez le Client ID** dans le champ "Client ID (for OAuth)"
2. **Collez le Client Secret** dans le champ "Client Secret (for OAuth)"
3. **Cliquez sur "Save"** en bas de la page

---

## 📍 Étape 4 : Vérifier les URLs de redirection

### 4.1 Dans Supabase

1. **Allez dans** "Authentication" > "URL Configuration"
2. **Vérifiez que "Site URL"** contient :
   ```
   https://etsmart.app
   ```
3. **Dans "Redirect URLs"**, assurez-vous d'avoir :
   ```
   https://etsmart.app/auth/callback
   http://localhost:3000/auth/callback
   ```
4. **Cliquez sur "Save"** si vous avez fait des modifications

---

## ✅ Test

### Test en local

1. **Lancez votre application** :
   ```bash
   npm run dev
   ```

2. **Allez sur** : http://localhost:3000/login
3. **Cliquez sur** "Continuer avec Google"
4. **Connectez-vous** avec votre compte Google
5. **Vous devriez être redirigé** vers le dashboard ou la page de pricing

### Test en production

1. **Allez sur** : https://etsmart.app/login
2. **Cliquez sur** "Continuer avec Google"
3. **Connectez-vous** avec votre compte Google

---

## 🔍 Dépannage

### Erreur "redirect_uri_mismatch"

**Problème** : L'URL de redirection dans Google Cloud Console ne correspond pas à celle de Supabase.

**Solution** :
1. Vérifiez que l'URL dans Google Cloud Console est exactement :
   ```
   https://[VOTRE_PROJET_ID].supabase.co/auth/v1/callback
   ```
2. Pas de `/` à la fin
3. Pas d'espaces
4. Vérifiez que vous avez bien remplacé `[VOTRE_PROJET_ID]`

### Le bouton Google ne fonctionne pas

**Vérifications** :
1. ✅ Google est activé dans Supabase (toggle vert)
2. ✅ Client ID et Client Secret sont remplis
3. ✅ Les URLs de redirection sont correctes
4. ✅ L'API Google+ est activée dans Google Cloud Console

### L'utilisateur n'est pas créé

**Vérifications** :
1. Vérifiez les logs dans Supabase Dashboard > Logs > Auth
2. Vérifiez que le trigger de base de données est configuré (normalement automatique)

---

## 📝 Résumé rapide

1. **Supabase** : Authentication > Sign In / Providers > Activer Google
2. **Google Cloud** : Créer OAuth Client ID avec redirect URI vers Supabase
3. **Supabase** : Ajouter Client ID et Client Secret
4. **Tester** : Se connecter avec Google

---

**✅ Une fois ces étapes terminées, la connexion Google sera active !**


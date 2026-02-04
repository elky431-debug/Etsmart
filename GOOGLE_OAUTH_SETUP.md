# 🔐 Configuration de l'authentification Google OAuth

## ✅ Implémentation terminée

L'authentification Google a été ajoutée aux pages de connexion et d'inscription. Les utilisateurs peuvent maintenant se connecter ou s'inscrire avec leur compte Google.

## 📋 Configuration requise dans Supabase

Pour que l'authentification Google fonctionne, vous devez configurer le provider Google dans Supabase :

### 1. Activer Google OAuth dans Supabase

1. **Allez sur** : https://supabase.com/dashboard/project/[VOTRE_PROJET]/auth/providers
2. **Trouvez "Google"** dans la liste des providers
3. **Cliquez sur "Enable"**

### 2. Configurer Google OAuth (Google Cloud Console)

1. **Créez un projet dans Google Cloud Console** :
   - Allez sur : https://console.cloud.google.com/
   - Créez un nouveau projet ou sélectionnez un projet existant

2. **Activez l'API Google+** :
   - Allez dans "APIs & Services" > "Library"
   - Recherchez "Google+ API" et activez-la

3. **Créez des identifiants OAuth 2.0** :
   - Allez dans "APIs & Services" > "Credentials"
   - Cliquez sur "Create Credentials" > "OAuth client ID"
   - Sélectionnez "Web application"
   - **Authorized JavaScript origins** :
     ```
     http://localhost:3000
     https://etsmart.app
     ```
   - **Authorized redirect URIs** :
     ```
     https://[VOTRE_PROJET_ID].supabase.co/auth/v1/callback
     ```
     (Trouvez votre URL de callback dans Supabase Dashboard > Authentication > URL Configuration)

4. **Copiez les identifiants** :
   - Client ID
   - Client Secret

### 3. Configurer dans Supabase

1. **Retournez dans Supabase Dashboard** > Authentication > Providers > Google
2. **Collez les identifiants** :
   - Client ID (Google)
   - Client Secret (Google)
3. **Sauvegardez**

### 4. Configurer les URLs de redirection

Dans Supabase Dashboard > Authentication > URL Configuration :

**Site URL** :
```
https://etsmart.app
```

**Redirect URLs** (ajoutez ces URLs) :
```
https://etsmart.app/auth/callback
http://localhost:3000/auth/callback
```

## ✅ Fonctionnalités implémentées

- ✅ Bouton "Continuer avec Google" sur la page de connexion
- ✅ Bouton "Continuer avec Google" sur la page d'inscription
- ✅ Gestion automatique des nouveaux utilisateurs (redirection vers `/pricing`)
- ✅ Gestion automatique des utilisateurs existants (redirection vers `/dashboard`)
- ✅ Création automatique du profil utilisateur dans la table `users`
- ✅ Extraction du nom complet depuis les métadonnées Google

## 🧪 Test

1. **Testez en local** :
   ```bash
   npm run dev
   ```
   - Allez sur `http://localhost:3000/login` ou `/register`
   - Cliquez sur "Continuer avec Google"
   - Connectez-vous avec votre compte Google

2. **Testez en production** :
   - Allez sur `https://etsmart.app/login` ou `/register`
   - Cliquez sur "Continuer avec Google"
   - Connectez-vous avec votre compte Google

## 🔍 Dépannage

### L'authentification Google ne fonctionne pas

1. **Vérifiez que Google OAuth est activé** dans Supabase Dashboard
2. **Vérifiez les URLs de redirection** dans Google Cloud Console
3. **Vérifiez les URLs de callback** dans Supabase Dashboard
4. **Vérifiez les logs** dans Supabase Dashboard > Logs > Auth

### Erreur "redirect_uri_mismatch"

- Vérifiez que l'URL de callback dans Google Cloud Console correspond exactement à celle dans Supabase
- Format attendu : `https://[PROJECT_ID].supabase.co/auth/v1/callback`

### Le profil utilisateur n'est pas créé

- Vérifiez que le trigger de base de données est configuré dans Supabase
- Le callback crée automatiquement le profil si le trigger n'existe pas

## 📚 Documentation

- [Supabase Auth - Google Provider](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)

---

**✅ Une fois configuré, les utilisateurs pourront se connecter et s'inscrire avec Google !**

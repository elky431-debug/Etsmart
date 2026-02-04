# ✅ Vérification de la configuration Google OAuth

## 📋 État actuel

D'après votre configuration Supabase, voici ce qui est déjà en place :

✅ **Google est activé** dans Supabase (toggle vert)
✅ **Client ID** est configuré : `955915497602-0173vj2kao1oh6a6uochi92hdkq9mudc.apps`
✅ **Client Secret** est configuré (masqué)
✅ **Callback URL** : `https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback`

## 🔍 Vérifications à faire

### 1. Vérifier le Callback URL complet

Dans Supabase, le Callback URL devrait être exactement :
```
https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback
```

Assurez-vous que c'est bien le cas (l'image montre qu'il est peut-être tronqué).

### 2. Vérifier dans Google Cloud Console

**Important** : Vous devez vérifier que dans Google Cloud Console, l'URL de redirection correspond exactement :

1. **Allez sur** : https://console.cloud.google.com/
2. **APIs & Services** > **Credentials**
3. **Trouvez votre OAuth Client ID** : `955915497602-0173vj2kao1oh6a6uochi92hdkq9mudc`
4. **Cliquez dessus** pour l'éditer
5. **Vérifiez "Authorized redirect URIs"** contient exactement :
   ```
   https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback
   ```
6. **Vérifiez "Authorized JavaScript origins"** contient :
   ```
   http://localhost:3000
   https://etsmart.app
   ```

### 3. Vérifier les URLs dans Supabase

1. **Dans Supabase**, allez dans **Authentication** > **URL Configuration**
2. **Vérifiez "Site URL"** : `https://etsmart.app`
3. **Vérifiez "Redirect URLs"** contient :
   ```
   https://etsmart.app/auth/callback
   http://localhost:3000/auth/callback
   ```

## 🧪 Test de la connexion

Une fois les vérifications faites, testez :

### Test en local

1. **Lancez l'application** :
   ```bash
   npm run dev
   ```

2. **Allez sur** : http://localhost:3000/login
3. **Cliquez sur** "Continuer avec Google"
4. **Connectez-vous** avec votre compte Google
5. **Vous devriez être redirigé** vers le dashboard ou `/pricing`

### Test en production

1. **Allez sur** : https://etsmart.app/login
2. **Cliquez sur** "Continuer avec Google"
3. **Connectez-vous** avec votre compte Google

## ⚠️ Erreurs courantes

### Erreur "redirect_uri_mismatch"

**Cause** : L'URL de redirection dans Google Cloud Console ne correspond pas exactement à celle de Supabase.

**Solution** :
- Vérifiez que l'URL dans Google Cloud Console est **exactement** :
  ```
  https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback
  ```
- Pas de `/` à la fin
- Pas d'espaces
- Même casse (minuscules/majuscules)

### Le bouton Google ne fait rien

**Vérifications** :
1. Ouvrez la console du navigateur (F12) et regardez les erreurs
2. Vérifiez les logs dans Supabase Dashboard > Logs > Auth
3. Vérifiez que le Client ID et Client Secret sont corrects

### L'utilisateur n'est pas créé après connexion

**Vérifications** :
1. Vérifiez les logs dans Supabase Dashboard > Logs > Auth
2. Vérifiez que le trigger de base de données est configuré (normalement automatique)
3. Vérifiez la table `users` dans Supabase Dashboard > Table Editor

## ✅ Checklist finale

- [ ] Google activé dans Supabase ✅ (déjà fait)
- [ ] Client ID configuré ✅ (déjà fait)
- [ ] Client Secret configuré ✅ (déjà fait)
- [ ] Callback URL vérifié dans Supabase
- [ ] Redirect URI vérifié dans Google Cloud Console
- [ ] JavaScript origins vérifiés dans Google Cloud Console
- [ ] Site URL vérifié dans Supabase (URL Configuration)
- [ ] Redirect URLs vérifiés dans Supabase (URL Configuration)
- [ ] Test en local effectué
- [ ] Test en production effectué

---

**🎉 Si tout est vérifié, la connexion Google devrait fonctionner !**


# ✅ Configuration Google OAuth - COMPLÈTE

## 📋 État de la configuration

### ✅ Supabase - URLs configurées

**Site URL :**
```
https://etsmart.app
```

**Redirect URLs :**
- ✅ `https://etsmart.app/auth/callback` (production)
- ✅ `http://localhost:3000/auth/callback` (développement)

### ✅ Supabase - Provider Google

- ✅ Google activé (toggle vert)
- ✅ Client ID configuré
- ✅ Client Secret configuré
- ✅ Callback URL : `https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback`

## 🧪 Test de la connexion

### Test en local

1. **Lancez l'application** :
   ```bash
   npm run dev
   ```

2. **Allez sur** : http://localhost:3000/login

3. **Cliquez sur** "Continuer avec Google"

4. **Connectez-vous** avec votre compte Google

5. **Vous devriez être redirigé** vers :
   - `/pricing` si c'est un nouvel utilisateur
   - `/dashboard?section=analyze` si c'est un utilisateur existant

### Test en production

1. **Allez sur** : https://etsmart.app/login

2. **Cliquez sur** "Continuer avec Google"

3. **Connectez-vous** avec votre compte Google

4. **Vous devriez être redirigé** vers le dashboard ou la page de pricing

## ✅ Checklist finale

- [x] Google activé dans Supabase
- [x] Client ID configuré
- [x] Client Secret configuré
- [x] Site URL configuré : `https://etsmart.app`
- [x] Redirect URLs configurées
- [x] Callback URL Google configuré dans Google Cloud Console
- [x] JavaScript origins configurés dans Google Cloud Console
- [ ] Test en local effectué
- [ ] Test en production effectué

## 🔍 Dépannage

### Si la connexion ne fonctionne pas

1. **Vérifiez la console du navigateur** (F12) pour les erreurs
2. **Vérifiez les logs** dans Supabase Dashboard > Logs > Auth
3. **Vérifiez que le Callback URL dans Google Cloud Console** correspond exactement à :
   ```
   https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback
   ```

### Erreur "redirect_uri_mismatch"

- Vérifiez que l'URL dans Google Cloud Console correspond exactement à celle de Supabase
- Pas de `/` à la fin
- Pas d'espaces
- Même casse (minuscules/majuscules)

### L'utilisateur n'est pas créé

- Vérifiez les logs dans Supabase Dashboard > Logs > Auth
- Vérifiez la table `users` dans Supabase Dashboard > Table Editor
- Le callback crée automatiquement le profil utilisateur

---

**🎉 Configuration terminée ! Testez maintenant la connexion Google.**


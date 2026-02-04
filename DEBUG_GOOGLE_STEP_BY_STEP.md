# 🔍 Debug étape par étape - Inscription Google

## 📋 Instructions pour identifier le problème

### Étape 1 : Ouvrir les outils de développement

1. **Allez sur** : https://etsmart.app/register
2. **Ouvrez la console** (F12 ou Cmd+Option+I sur Mac)
3. **Allez dans l'onglet "Console"**

### Étape 2 : Tester l'inscription Google

1. **Cliquez sur** "Continuer avec Google"
2. **Regardez la console** - vous devriez voir :
   ```
   🔵 Starting Google OAuth flow
   Redirect to: https://etsmart.app/auth/callback
   ✅ OAuth flow started, redirecting to: [URL]
   ```

3. **Sur la page Google**, sélectionnez votre compte et cliquez sur "Continuer"

4. **Après avoir cliqué sur "Continuer"**, regardez :
   - **La console du navigateur** (onglet Console)
   - **L'onglet Network** (Réseau) pour voir les requêtes

### Étape 3 : Vérifier les logs serveur

Les logs détaillés sont maintenant dans le callback. Pour les voir :

1. **Allez sur Netlify Dashboard** : https://app.netlify.com/projects/etsmart/functions
2. **Cliquez sur** "auth-callback" (ou cherchez la fonction)
3. **Regardez les logs** après avoir essayé de vous inscrire

**OU**

1. **Allez sur** : https://app.netlify.com/projects/etsmart/deploys
2. **Cliquez sur le dernier déploiement**
3. **Regardez les logs de build**

### Étape 4 : Vérifier les logs Supabase

1. **Allez sur** : https://supabase.com/dashboard/project/[VOTRE_PROJET]/logs/auth
2. **Filtrez par** "Error" ou "OAuth"
3. **Regardez les erreurs** récentes

## 🔍 Ce que vous devriez voir dans les logs

### Si tout fonctionne :

```
🔍 OAuth Callback - Start
URL: https://etsmart.app/auth/callback?code=...
Code: present
Base URL: https://etsmart.app
🔄 Exchanging code for session...
✅ User authenticated: [user-id]
User email: [email]
Is new user: true
👤 Creating user profile...
✅ User profile created/updated
🔄 Redirecting new user to /pricing
```

### Si ça échoue :

Vous verrez une erreur spécifique qui indiquera le problème.

## ⚠️ Erreurs courantes et solutions

### 1. "No code parameter in OAuth callback"

**Cause** : Le callback n'a pas reçu le code de Google.

**Solutions** :
- Vérifiez que le Redirect URI dans Google Cloud Console est exactement : `https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback`
- Vérifiez que le Callback URL dans Supabase correspond

### 2. "Error exchanging code for session"

**Cause** : Le code est invalide ou a expiré.

**Solutions** :
- Réessayez (le code expire rapidement)
- Vérifiez que le Client ID et Client Secret sont corrects dans Supabase

### 3. "No user data after exchange"

**Cause** : Supabase n'a pas créé l'utilisateur.

**Solutions** :
- Vérifiez les logs Supabase
- Vérifiez que Google OAuth est bien activé dans Supabase

### 4. Redirection vers `/register?error=...`

**Cause** : Une erreur s'est produite pendant le processus.

**Solutions** :
- Regardez le message d'erreur dans l'URL
- Vérifiez les logs serveur sur Netlify

## 📝 Checklist de vérification

- [ ] Console du navigateur ouverte (F12)
- [ ] Onglet Console visible
- [ ] Tentative d'inscription avec Google effectuée
- [ ] Logs dans la console vérifiés
- [ ] Logs Netlify vérifiés (si accessible)
- [ ] Logs Supabase vérifiés
- [ ] Erreur spécifique notée

## 🎯 Prochaines étapes

1. **Testez maintenant** avec la console ouverte
2. **Notez l'erreur exacte** que vous voyez
3. **Envoyez-moi** :
   - Le message d'erreur dans la console
   - Le message d'erreur dans l'URL (si redirection vers /register?error=...)
   - Les logs Netlify (si accessible)

---

**Avec ces logs détaillés, on pourra identifier exactement où ça bloque !**


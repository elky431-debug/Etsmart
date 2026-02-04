# 🔍 Debug de l'authentification Google OAuth

## ✅ Améliorations apportées

### 1. Gestion d'erreurs améliorée dans le callback

- ✅ Détection des erreurs OAuth dans l'URL
- ✅ Gestion des erreurs lors de l'échange du code
- ✅ Logs détaillés pour le debugging
- ✅ Redirection avec message d'erreur clair

### 2. Affichage des erreurs dans les pages

- ✅ Détection automatique des erreurs OAuth dans l'URL
- ✅ Affichage des messages d'erreur
- ✅ Nettoyage de l'URL après affichage

## 🔍 Comment déboguer

### 1. Vérifier les logs du navigateur

1. **Ouvrez la console** (F12)
2. **Essayez de vous connecter avec Google**
3. **Regardez les erreurs** dans la console

### 2. Vérifier les logs Supabase

1. **Allez sur** : https://supabase.com/dashboard/project/[VOTRE_PROJET]/logs/auth
2. **Filtrez par** "Error" ou "OAuth"
3. **Regardez les erreurs** récentes

### 3. Vérifier la configuration

#### Dans Supabase :
- ✅ Google activé
- ✅ Client ID configuré
- ✅ Client Secret configuré
- ✅ Callback URL : `https://[PROJECT_ID].supabase.co/auth/v1/callback`

#### Dans Google Cloud Console :
- ✅ Redirect URI : `https://[PROJECT_ID].supabase.co/auth/v1/callback`
- ✅ JavaScript origins : `http://localhost:3000` et `https://etsmart.app`

#### Dans Supabase URL Configuration :
- ✅ Site URL : `https://etsmart.app`
- ✅ Redirect URLs : 
  - `https://etsmart.app/auth/callback`
  - `http://localhost:3000/auth/callback`

## ⚠️ Erreurs courantes

### 1. "redirect_uri_mismatch"

**Cause** : L'URL de redirection dans Google Cloud Console ne correspond pas exactement.

**Solution** :
- Vérifiez que l'URL est exactement : `https://[PROJECT_ID].supabase.co/auth/v1/callback`
- Pas de `/` à la fin
- Pas d'espaces
- Même casse

### 2. "invalid_client"

**Cause** : Client ID ou Client Secret incorrect.

**Solution** :
- Vérifiez les identifiants dans Supabase
- Vérifiez qu'ils correspondent à ceux de Google Cloud Console

### 3. "access_denied"

**Cause** : L'utilisateur a annulé l'autorisation.

**Solution** : Normal, l'utilisateur peut réessayer.

### 4. "no_code" ou "no_user"

**Cause** : Le callback n'a pas reçu le code ou l'utilisateur n'a pas été créé.

**Solution** :
- Vérifiez les logs Supabase
- Vérifiez que le callback URL est correctement configuré

## 🧪 Test étape par étape

1. **Testez en local** :
   ```bash
   npm run dev
   ```
   - Allez sur `http://localhost:3000/register`
   - Cliquez sur "Continuer avec Google"
   - Ouvrez la console (F12)
   - Regardez les erreurs éventuelles

2. **Vérifiez la redirection** :
   - Vous devriez être redirigé vers Google
   - Après connexion, vous devriez être redirigé vers `/auth/callback`
   - Puis vers `/pricing` (nouvel utilisateur) ou `/dashboard` (utilisateur existant)

3. **Si une erreur apparaît** :
   - Notez le message d'erreur exact
   - Vérifiez les logs Supabase
   - Vérifiez la configuration

## 📝 Prochaines étapes

Si le problème persiste après ces améliorations :

1. **Vérifiez les logs** dans la console du navigateur
2. **Vérifiez les logs** dans Supabase Dashboard
3. **Notez l'erreur exacte** que vous voyez
4. **Vérifiez la configuration** selon la checklist ci-dessus

---

**Les améliorations ont été apportées. Testez maintenant et dites-moi quelle erreur vous voyez !**


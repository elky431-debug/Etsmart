# 🔐 Guide Étape par Étape - Configuration Authentification

## ✅ Étape 1 : Exécuter le trigger SQL dans Supabase

1. **Ouvrez Supabase** → Allez dans **SQL Editor** (icône 📝 dans le menu de gauche)
2. **Cliquez sur "New query"**
3. **Copiez et collez ce code SQL** :

```sql
-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

4. **Cliquez sur "Run"** (ou Cmd+Enter)
5. ✅ Vous devriez voir "Success. No rows returned"

---

## ✅ Étape 2 : Activer l'authentification Email dans Supabase

1. Dans Supabase, **cliquez sur "Authentication"** (icône 👤 dans le menu de gauche)
2. **Cliquez sur "Providers"** dans le sous-menu
3. **Trouvez "Email"** dans la liste
4. **Activez le toggle** pour Email (il doit devenir vert/actif)
5. **Configurez les options** :
   - ✅ **Enable email confirmations** : **Désactivé** (pour le développement, plus facile)
   - ✅ **Secure email change** : Activé
   - ✅ **Double confirm email changes** : Activé
6. **Cliquez sur "Save"** en bas

---

## ✅ Étape 3 : Configurer les URLs de redirection

1. Toujours dans **Authentication**, cliquez sur **"URL Configuration"**
2. **Remplissez** :
   - **Site URL** : `http://localhost:3003`
   - **Redirect URLs** : Cliquez sur "+ Add URL" et ajoutez :
     - `http://localhost:3003/app`
     - `http://localhost:3003/**` (pour toutes les routes)
3. **Cliquez sur "Save"**

---

## ✅ Étape 4 : Redémarrer votre serveur de développement

1. **Arrêtez votre serveur** (Ctrl+C dans le terminal)
2. **Relancez-le** :
   ```bash
   npm run dev
   ```
3. ✅ Attendez que le serveur démarre (vous devriez voir "Ready" dans le terminal)

---

## ✅ Étape 5 : Tester la création de compte

1. **Ouvrez votre navigateur** et allez sur : `http://localhost:3003/register`
2. **Remplissez le formulaire** :
   - Nom complet : Votre nom
   - Email : votre@email.com (utilisez un vrai email pour tester)
   - Mot de passe : Au moins 8 caractères avec majuscule et chiffre
3. **Cliquez sur "Créer mon compte"**
4. ✅ Vous devriez être redirigé vers `/app`

---

## ✅ Étape 6 : Vérifier dans Supabase

1. **Dans Supabase**, allez dans **Authentication → Users**
2. ✅ Vous devriez voir votre utilisateur créé avec l'email que vous avez utilisé
3. **Dans Table Editor**, ouvrez la table `users`
4. ✅ Vous devriez voir votre profil avec votre nom et email

---

## ✅ Étape 7 : Tester la connexion

1. **Déconnectez-vous** (si vous êtes connecté)
2. **Allez sur** : `http://localhost:3003/login`
3. **Entrez** votre email et mot de passe
4. **Cliquez sur "Se connecter"**
5. ✅ Vous devriez être connecté et redirigé vers `/app`

---

## 🎉 C'est terminé !

Votre système d'authentification est maintenant fonctionnel. Les utilisateurs peuvent :
- ✅ Créer un compte
- ✅ Se connecter
- ✅ Leur profil est automatiquement créé dans la base de données

---

## 🔧 En cas de problème

### Erreur "Invalid login credentials"
- Vérifiez que l'email et le mot de passe sont corrects
- Assurez-vous que l'authentification Email est activée dans Supabase

### Erreur "Email already registered"
- L'utilisateur existe déjà, utilisez "Se connecter" au lieu de "Créer un compte"

### L'utilisateur n'apparaît pas dans `public.users`
- Vérifiez que le trigger SQL a bien été exécuté (Étape 1)
- Vérifiez dans Authentication → Users que l'utilisateur existe dans `auth.users`

### Erreur de connexion
- Vérifiez que les URLs de redirection sont bien configurées (Étape 3)
- Vérifiez que votre `.env.local` contient les bonnes clés Supabase




























































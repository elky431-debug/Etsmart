# 🔐 Configuration de l'authentification Supabase

## Étape 1 : Activer l'authentification Email dans Supabase

1. Dans Supabase, allez dans **Authentication** (icône 👤 dans le menu de gauche)
2. Cliquez sur **Providers**
3. Activez **Email** si ce n'est pas déjà fait
4. Configurez les options :
   - ✅ **Enable email confirmations** : Désactivé (pour le développement) ou Activé (pour la production)
   - ✅ **Secure email change** : Activé
   - ✅ **Double confirm email changes** : Activé (recommandé)

## Étape 2 : Activer Google OAuth (optionnel)

Si vous voulez permettre la connexion avec Google :

1. Dans **Authentication > Providers**, activez **Google**
2. Vous devrez créer un projet Google Cloud :
   - Allez sur [Google Cloud Console](https://console.cloud.google.com)
   - Créez un projet ou sélectionnez-en un
   - Activez l'API "Google+ API"
   - Créez des identifiants OAuth 2.0
   - Ajoutez l'URL de redirection : `https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback`
   - Copiez le Client ID et Client Secret dans Supabase

## Étape 3 : Configurer les URLs de redirection

1. Dans Supabase, allez dans **Authentication > URL Configuration**
2. Ajoutez vos URLs :
   - **Site URL** : `http://localhost:3003` (pour le développement)
   - **Redirect URLs** : 
     - `http://localhost:3003/app`
     - `http://localhost:3003/**` (pour toutes les routes)
     - Ajoutez aussi votre URL de production quand vous déployez

## Étape 4 : Exécuter le trigger SQL (si pas déjà fait)

Le schéma SQL inclut maintenant un trigger qui crée automatiquement un profil utilisateur dans `public.users` quand un utilisateur s'inscrit.

Si vous avez déjà exécuté le schéma avant cette mise à jour, exécutez cette partie supplémentaire dans le SQL Editor :

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

## Étape 5 : Tester l'authentification

1. Redémarrez votre serveur de développement :
   ```bash
   npm run dev
   ```

2. Allez sur `http://localhost:3003/register`
3. Créez un compte avec email et mot de passe
4. Vérifiez dans Supabase → Authentication → Users que l'utilisateur est créé
5. Vérifiez dans Table Editor → `users` que le profil est créé

## ✅ C'est terminé !

Les utilisateurs peuvent maintenant :
- ✅ Créer un compte avec email/mot de passe
- ✅ Se connecter avec email/mot de passe
- ✅ Se connecter avec Google (si configuré)
- ✅ Leur profil est automatiquement créé dans `public.users`

## 🔒 Protection des routes

Pour protéger une route (ex: `/app`), utilisez :

```typescript
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) return <div>Chargement...</div>;
  if (!user) return null;

  return <div>Contenu protégé</div>;
}
```




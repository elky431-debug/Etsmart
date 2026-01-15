# 🗄️ Configuration Supabase - Guide Pas à Pas

## Étape 1 : Créer un projet Supabase

1. **Allez sur [supabase.com](https://supabase.com)**
2. **Connectez-vous avec GitHub** :
   - Cliquez sur "Sign in" ou "Get started"
   - Cliquez sur le bouton **"Continue with GitHub"** (icône GitHub)
   - Autorisez Supabase à accéder à votre compte GitHub
   - ✅ C'est fait ! Vous êtes connecté avec votre compte GitHub
3. **Cliquez sur "New Project"** (ou le bouton "+" en haut)
4. **Remplissez le formulaire** :
   - **Organization** : Créez-en une ou utilisez celle par défaut
   - **Name** : `etsmart` (ou le nom que vous préférez)
   - **Database Password** : ⚠️ **IMPORTANT** - Choisissez un mot de passe fort et **SAUVEZ-LE** quelque part (vous en aurez besoin)
   - **Region** : Choisissez la région la plus proche (ex: `West US (N. California)` pour les USA, `West EU (Ireland)` pour l'Europe)
   - **Pricing Plan** : Free (gratuit)
5. **Cliquez sur "Create new project"**
6. ⏳ **Attendez 2-3 minutes** que le projet soit créé

## Étape 2 : Récupérer vos clés API

Une fois le projet créé :

1. **Allez dans Settings** (icône ⚙️ en bas à gauche)
2. **Cliquez sur "API"** dans le menu
3. **Vous verrez** :
   - **Project URL** : `https://xxxxx.supabase.co`
   - **anon public key** : Une longue clé commençant par `eyJ...`
   - **service_role key** : Une autre clé (⚠️ gardez-la secrète)

4. **Copiez ces valeurs** - vous en aurez besoin dans l'étape suivante

## Étape 3 : Configurer les variables d'environnement

1. **Créez un fichier `.env.local`** à la racine de votre projet
2. **Ajoutez ces lignes** (remplacez par vos vraies valeurs) :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. **Sauvegardez le fichier**

⚠️ **IMPORTANT** : Le fichier `.env.local` est déjà dans `.gitignore`, donc vos clés ne seront pas commitées sur GitHub.

## Étape 4 : Créer le schéma de base de données

1. **Dans Supabase**, allez dans **SQL Editor** (icône 📝 dans le menu de gauche)
2. **Cliquez sur "New query"**
3. **Ouvrez le fichier** `supabase/schema.sql` dans votre éditeur de code
4. **Copiez TOUT le contenu** du fichier
5. **Collez-le** dans l'éditeur SQL de Supabase
6. **Cliquez sur "Run"** (ou appuyez sur Cmd+Enter / Ctrl+Enter)
7. ✅ **Vous devriez voir** : "Success. No rows returned"

## Étape 5 : Vérifier que les tables sont créées

1. **Allez dans "Table Editor"** (icône 📊 dans le menu)
2. **Vous devriez voir** ces tables :
   - ✅ `users`
   - ✅ `products`
   - ✅ `product_variants`
   - ✅ `product_analyses`
   - ✅ `boutique_analyses`

Si vous voyez toutes ces tables, **c'est bon !** ✅

## Étape 6 : Tester la connexion (optionnel)

Créez un fichier de test pour vérifier que tout fonctionne :

```typescript
// test-supabase.ts (temporaire, à supprimer après)
import { supabase } from './src/lib/supabase';

async function test() {
  const { data, error } = await supabase.from('users').select('count');
  console.log('Test Supabase:', error ? '❌ Erreur' : '✅ Connecté');
}

test();
```

## ✅ C'est terminé !

Votre base de données Supabase est maintenant configurée et prête à être utilisée.

## 🆘 En cas de problème

- **Erreur de connexion** : Vérifiez que vos clés dans `.env.local` sont correctes
- **Tables non créées** : Vérifiez qu'il n'y a pas d'erreur dans le SQL Editor
- **RLS bloque les requêtes** : C'est normal si vous n'êtes pas authentifié, RLS protège vos données

## 📚 Prochaines étapes

- Consultez `supabase/README.md` pour plus de détails
- Utilisez `productDb` et `analysisDb` dans votre code pour sauvegarder des données
- Configurez l'authentification si vous voulez que les utilisateurs se connectent


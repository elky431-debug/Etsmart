# Supabase Setup Guide

## 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte ou connectez-vous
3. Cliquez sur "New Project"
4. Remplissez les informations :
   - Nom du projet : `etsmart`
   - Mot de passe de la base de données (gardez-le en sécurité)
   - Région : choisissez la plus proche de vos utilisateurs

## 2. Configurer les variables d'environnement

1. Copiez `.env.local.example` vers `.env.local`
2. Dans votre projet Supabase, allez dans **Settings > API**
3. Copiez les valeurs suivantes :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (optionnel, pour opérations serveur) → `SUPABASE_SERVICE_ROLE_KEY`

## 3. Créer le schéma de base de données

1. Dans Supabase, allez dans **SQL Editor**
2. Ouvrez le fichier `supabase/schema.sql`
3. Copiez tout le contenu et exécutez-le dans l'éditeur SQL
4. Vérifiez que toutes les tables ont été créées dans **Table Editor**

## 4. Configurer l'authentification (optionnel)

Si vous voulez utiliser l'authentification Supabase :

1. Allez dans **Authentication > Providers**
2. Activez les providers que vous souhaitez (Email, Google, etc.)
3. Configurez les URLs de redirection dans **Authentication > URL Configuration**

## 5. Vérifier la configuration

Les tables suivantes devraient être créées :
- ✅ `users` - Profils utilisateurs
- ✅ `products` - Produits fournisseurs
- ✅ `product_variants` - Variantes de produits
- ✅ `product_analyses` - Analyses de produits
- ✅ `boutique_analyses` - Analyses de boutique

## 6. Utilisation dans le code

```typescript
import { productDb, analysisDb } from '@/lib/db';

// Créer un produit
const product = await productDb.createProduct(userId, supplierProduct);

// Sauvegarder une analyse
const analysis = await analysisDb.saveAnalysis(userId, productAnalysis);

// Récupérer tous les produits
const products = await productDb.getProducts(userId);
```

## Notes importantes

- **Row Level Security (RLS)** est activé par défaut
- Les utilisateurs ne peuvent accéder qu'à leurs propres données
- Les timestamps `created_at` et `updated_at` sont automatiquement gérés
- Le schéma utilise UUID pour tous les IDs


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

## 4. Configurer l'authentification

### 4.1 Authentification Email (déjà activée par défaut)

L'authentification par email est déjà configurée et fonctionnelle.

### 4.2 Configurer Google OAuth

Pour activer la connexion avec Google :

1. Allez dans **Authentication > Providers** dans votre projet Supabase
2. Activez le provider **Google**
3. Vous devez créer un projet Google Cloud :
   - Allez sur [Google Cloud Console](https://console.cloud.google.com/)
   - Créez un nouveau projet ou sélectionnez-en un existant
   - Allez dans **APIs & Services > Credentials**
   - Cliquez sur **Create Credentials > OAuth client ID**
   - Type d'application : **Web application**
   - **Authorized redirect URIs** : Ajoutez l'URL suivante :
     ```
     https://[VOTRE-PROJECT-REF].supabase.co/auth/v1/callback
     ```
     (Remplacez `[VOTRE-PROJECT-REF]` par votre référence de projet Supabase)
   - Copiez le **Client ID** et le **Client Secret**
4. Retournez dans Supabase et collez ces valeurs dans les champs correspondants
5. Sauvegardez

### 4.3 URLs de redirection

Dans **Authentication > URL Configuration**, ajoutez ces URLs autorisées :
- `http://localhost:3000/auth/callback` (pour le développement)
- `https://votre-domaine.com/auth/callback` (pour la production)

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



# Comment créer la table user_settings dans Supabase

## Problème
Vous recevez le message : "La table user_settings n'existe pas encore dans Supabase" lorsque vous essayez d'enregistrer vos réglages.

## Solution : Exécuter le script SQL

### Méthode 1 : Utiliser le fichier SQL fourni (Recommandé)

1. **Ouvrez Supabase Dashboard**
   - Allez sur [supabase.com](https://supabase.com)
   - Connectez-vous à votre projet

2. **Ouvrez le SQL Editor**
   - Dans le menu de gauche, cliquez sur **SQL Editor**
   - Cliquez sur **New query**

3. **Copiez le script SQL**
   - Ouvrez le fichier `CREATE_USER_SETTINGS_TABLE.sql` dans votre projet
   - Copiez tout le contenu (Ctrl+C / Cmd+C)

4. **Collez et exécutez**
   - Collez le script dans l'éditeur SQL de Supabase
   - Cliquez sur **Run** (ou appuyez sur Ctrl+Enter / Cmd+Enter)

5. **Vérifiez que ça a fonctionné**
   - Allez dans **Table Editor** dans le menu de gauche
   - Vous devriez voir la table `user_settings` dans la liste

### Méthode 2 : Utiliser le schéma complet

Si vous préférez exécuter tout le schéma :

1. Ouvrez Supabase Dashboard → **SQL Editor**
2. Ouvrez le fichier `supabase/schema.sql` dans votre projet
3. Copiez **uniquement la partie concernant user_settings** (lignes 243-273)
4. Collez et exécutez dans Supabase SQL Editor

### Vérification

Après avoir exécuté le script :
1. Rechargez votre application
2. Allez dans **Dashboard > Réglages**
3. Modifiez un réglage et cliquez sur **Enregistrer**
4. Le message d'erreur ne devrait plus apparaître

## Structure de la table

La table `user_settings` contient :
- `user_id` : ID de l'utilisateur (clé primaire)
- `target_country` : Pays cible (défaut: 'FR')
- `currency` : Devise (défaut: 'EUR')
- `preferred_channel` : Canal publicitaire préféré (défaut: 'auto')
- `ai_prudence_level` : Niveau de prudence IA (défaut: 'balanced')
- `language` : Langue (défaut: 'fr')
- `created_at` : Date de création
- `updated_at` : Date de mise à jour

## Notes importantes

- La table utilise **Row Level Security (RLS)** : chaque utilisateur ne peut voir/modifier que ses propres réglages
- Les valeurs par défaut sont déjà définies dans le schéma
- La table est liée à la table `users` via une clé étrangère






































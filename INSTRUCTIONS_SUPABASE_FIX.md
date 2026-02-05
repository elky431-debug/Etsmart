# 🔧 Instructions pour corriger le problème de crédits dans Supabase

## Problème
Les crédits ne se mettent pas à jour correctement après les opérations. Cela est probablement dû à un problème de type de colonne dans Supabase.

## Solution

### Étape 1 : Vérifier le type de colonne actuel

1. Allez dans **Supabase Dashboard** → **SQL Editor**
2. Exécutez cette requête pour voir le type actuel :

```sql
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'analysis_used_this_month';
```

### Étape 2 : Corriger le type de colonne

**Si le type n'est PAS `numeric(10,2)`, exécutez cette commande :**

```sql
ALTER TABLE users 
ALTER COLUMN analysis_used_this_month TYPE numeric(10,2) 
USING analysis_used_this_month::numeric(10,2);
```

⚠️ **IMPORTANT** : Cette commande convertira toutes les valeurs existantes. Si vous avez des valeurs NULL, elles resteront NULL.

### Étape 3 : Vérifier que ça a fonctionné

Exécutez à nouveau la requête de l'étape 1. Vous devriez voir :
- `data_type` : `numeric`
- `numeric_precision` : `10`
- `numeric_scale` : `2`

### Étape 4 : Tester avec une valeur décimale

1. Trouvez votre ID utilisateur :
```sql
SELECT id, email FROM users WHERE email = 'votre@email.com';
```

2. Testez avec une valeur décimale :
```sql
UPDATE users 
SET analysis_used_this_month = 8.5
WHERE id = 'VOTRE_USER_ID_ICI';

-- Vérifier
SELECT 
    id,
    email,
    analysis_used_this_month,
    pg_typeof(analysis_used_this_month) as column_type
FROM users
WHERE id = 'VOTRE_USER_ID_ICI';
```

Vous devriez voir `8.5` dans `analysis_used_this_month` et `column_type` devrait être `numeric`.

### Étape 5 : Vérifier les permissions (Row Level Security)

Assurez-vous que les utilisateurs peuvent mettre à jour leur propre ligne :

1. Allez dans **Supabase Dashboard** → **Authentication** → **Policies**
2. Vérifiez qu'il y a une policy pour permettre aux utilisateurs de mettre à jour leur propre ligne dans la table `users`

Si ce n'est pas le cas, créez cette policy :

```sql
-- Policy pour permettre aux utilisateurs de mettre à jour leur propre ligne
CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

### Étape 6 : Redémarrer l'application

Après avoir fait ces modifications, redémarrez votre application locale pour que les changements prennent effet.

## Vérification finale

1. Générez une image ou un listing
2. Attendez 3-5 secondes
3. Vérifiez dans Supabase que `analysis_used_this_month` a bien été mis à jour avec une valeur décimale (ex: 8.5, 9.0, etc.)

## Script complet

Vous pouvez aussi utiliser le fichier `verifier_et_corriger_supabase.sql` qui contient toutes ces commandes dans l'ordre.


# 🔧 Instructions pour corriger les crédits décimaux

## Problème
Les crédits ne se mettent pas à jour correctement après la génération d'un listing (+0.5 crédit). Le problème vient du type de colonne dans Supabase.

## Solution

### Étape 1: Ouvrir Supabase SQL Editor
1. Allez sur https://supabase.com
2. Connectez-vous à votre projet Etsmart
3. Allez dans **SQL Editor** (dans le menu de gauche)

### Étape 2: Exécuter le script de vérification
Copiez et exécutez cette requête pour voir le type actuel de la colonne :

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

**Résultat attendu :**
- Si `data_type` = `integer` ou `real` → **PROBLÈME** : la colonne ne peut pas stocker de décimales
- Si `data_type` = `numeric` et `numeric_scale` = `2` → **OK** : la colonne est correcte

### Étape 3: Corriger le type de colonne
Si le type n'est pas `numeric(10,2)`, exécutez cette commande :

```sql
ALTER TABLE users
ALTER COLUMN analysis_used_this_month TYPE numeric(10,2) 
USING analysis_used_this_month::numeric(10,2);
```

⚠️ **ATTENTION** : Cette commande va convertir toutes les valeurs existantes. C'est normal et nécessaire.

### Étape 4: Vérifier que ça a fonctionné
Ré-exécutez la requête de l'étape 2. Vous devriez maintenant voir :
- `data_type` = `numeric`
- `numeric_precision` = `10`
- `numeric_scale` = `2`

### Étape 5: Tester avec une valeur décimale
1. Trouvez votre user_id :
```sql
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE email = 'votre-email@example.com';
```

2. Testez avec une valeur décimale :
```sql
UPDATE users
SET analysis_used_this_month = 10.5
WHERE id = 'votre-user-id';
```

3. Vérifiez que la valeur est bien stockée :
```sql
SELECT id, email, analysis_used_this_month, 
       pg_typeof(analysis_used_this_month) as column_type
FROM users
WHERE id = 'votre-user-id';
```

Vous devriez voir `10.5` dans `analysis_used_this_month` et `numeric` dans `column_type`.

## Après avoir corrigé
Une fois le type de colonne corrigé, les crédits devraient se mettre à jour correctement avec les décimales (0.5, 0.25, etc.).

Testez en générant un listing et vérifiez que les crédits passent de `10` à `10.5` (ou de `90` à `89.5` pour les crédits restants).










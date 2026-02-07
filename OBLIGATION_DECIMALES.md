# ⚠️ OBLIGATION : Création et stockage des décimales

## Problème
Les crédits doivent être stockés avec des décimales (8.5, 8.75, 9.0) et non arrondis à des entiers (8, 9).

## Solution : Modifier le type de colonne dans Supabase

### Étape 1 : Vérifier le type actuel

Dans Supabase Dashboard :
1. Allez dans **SQL Editor**
2. Exécutez cette requête :

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

### Étape 2 : Modifier le type si nécessaire

Si le type est `integer`, `bigint`, ou `real`, exécutez cette commande :

```sql
ALTER TABLE users 
ALTER COLUMN analysis_used_this_month TYPE numeric(10,2) 
USING analysis_used_this_month::numeric(10,2);
```

**Explication :**
- `numeric(10,2)` = 10 chiffres au total, 2 après la virgule
- Exemples : `8.5`, `8.75`, `100.00`
- `USING` convertit automatiquement les valeurs existantes

### Étape 3 : Vérifier le changement

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

Vous devriez voir :
- `data_type` = `numeric`
- `numeric_precision` = `10`
- `numeric_scale` = `2`

### Étape 4 : Tester avec une valeur décimale

Remplacez `'votre-user-id'` par votre ID utilisateur :

```sql
-- Mettre à jour avec une valeur décimale
UPDATE users 
SET analysis_used_this_month = 8.5 
WHERE id = 'votre-user-id';

-- Vérifier que la valeur est bien stockée
SELECT id, analysis_used_this_month 
FROM users 
WHERE id = 'votre-user-id';
```

Vous devriez voir `8.5` et non `8` ou `9`.

## Vérifications dans le code

### ✅ Code vérifié et corrigé :

1. **`src/lib/subscription-quota.ts`** :
   - ✅ `incrementAnalysisCount` force les valeurs comme nombres
   - ✅ Parsing correct des valeurs décimales
   - ✅ Stockage explicite comme nombre (pas de string)

2. **`src/hooks/useSubscription.ts`** :
   - ✅ Parse les valeurs avec `parseFloat()`
   - ✅ Gère les types string et number

3. **Affichage** :
   - ✅ Tous les composants affichent les décimales avec `.toFixed(1)`

## ⚠️ IMPORTANT

**Sans cette modification SQL, les décimales seront automatiquement arrondies par Supabase si la colonne est de type `integer`.**

Même si le code envoie `8.5`, Supabase le stockera comme `8` ou `9` si la colonne est `integer`.

## Script SQL complet

Le fichier `fix_decimal_column.sql` contient toutes les commandes nécessaires.

Copiez-collez le contenu dans Supabase SQL Editor et exécutez-le.










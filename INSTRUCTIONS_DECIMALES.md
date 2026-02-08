# 📋 Instructions : Obligation de créer des décimales

## ⚠️ ACTION REQUISE IMMÉDIATE

Pour que les crédits décimaux (8.5, 8.75, etc.) fonctionnent, vous **DEVEZ** modifier le type de colonne dans Supabase.

## 🚀 Étapes à suivre

### 1. Ouvrir Supabase Dashboard
- Allez sur https://supabase.com/dashboard
- Sélectionnez votre projet Etsmart

### 2. Ouvrir SQL Editor
- Cliquez sur "SQL Editor" dans le menu de gauche
- Cliquez sur "New query"

### 3. Copier-coller et exécuter ce script

```sql
-- Vérifier le type actuel
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'analysis_used_this_month';

-- Modifier le type pour supporter les décimales
ALTER TABLE users 
ALTER COLUMN analysis_used_this_month TYPE numeric(10,2) 
USING analysis_used_this_month::numeric(10,2);

-- Vérifier que le changement a été appliqué
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'analysis_used_this_month';
```

### 4. Vérifier le résultat

Après l'exécution, vous devriez voir :
- `data_type` = `numeric`
- `numeric_precision` = `10`
- `numeric_scale` = `2`

### 5. Tester (optionnel)

Pour tester que ça fonctionne, remplacez `'votre-user-id'` par votre ID utilisateur :

```sql
-- Mettre une valeur décimale
UPDATE users 
SET analysis_used_this_month = 8.5 
WHERE id = 'votre-user-id';

-- Vérifier
SELECT id, analysis_used_this_month 
FROM users 
WHERE id = 'votre-user-id';
```

Vous devriez voir `8.5` et non `8` ou `9`.

## ✅ Code déjà corrigé

Le code est déjà prêt pour gérer les décimales :
- ✅ Stockage forcé comme nombre (pas de string)
- ✅ Parsing correct des valeurs décimales
- ✅ Affichage avec décimales (8.5 au lieu de 8)

## ⚠️ IMPORTANT

**Sans cette modification SQL, même si le code envoie `8.5`, Supabase le stockera comme `8` ou `9` si la colonne est de type `integer`.**

C'est une **obligation** de modifier le type de colonne pour que les décimales fonctionnent.

## 📁 Fichiers créés

- `fix_decimal_column.sql` : Script SQL complet
- `OBLIGATION_DECIMALES.md` : Documentation détaillée
- `VERIFICATION_CREDITS.md` : Guide de vérification












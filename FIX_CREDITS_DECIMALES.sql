-- ⚠️ CRITICAL: Script pour corriger le type de colonne analysis_used_this_month
-- Ce script DOIT être exécuté dans Supabase SQL Editor pour que les décimales fonctionnent

-- ÉTAPE 1: Vérifier le type actuel de la colonne
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'analysis_used_this_month';

-- ÉTAPE 2: Si le type n'est pas numeric(10,2), exécuter cette commande pour le changer
-- ⚠️ ATTENTION: Cette commande va convertir toutes les valeurs existantes
ALTER TABLE users
ALTER COLUMN analysis_used_this_month TYPE numeric(10,2) 
USING analysis_used_this_month::numeric(10,2);

-- ÉTAPE 3: Vérifier que le changement a bien été appliqué
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'analysis_used_this_month';

-- ÉTAPE 4: Tester avec une valeur décimale (remplacez 'votre-user-id' par votre UUID)
-- D'abord, trouvez votre user_id:
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE email = 'votre-email@example.com';

-- Ensuite, testez avec une valeur décimale:
UPDATE users
SET analysis_used_this_month = 10.5
WHERE id = 'votre-user-id';

-- Vérifiez que la valeur est bien stockée:
SELECT id, email, analysis_used_this_month, 
       pg_typeof(analysis_used_this_month) as column_type
FROM users
WHERE id = 'votre-user-id';

-- Vous devriez voir:
-- analysis_used_this_month = 10.5
-- column_type = numeric



















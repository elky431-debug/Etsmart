-- Script SQL pour forcer le type décimal dans Supabase
-- À exécuter dans Supabase SQL Editor

-- 1. Vérifier le type actuel de la colonne
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'analysis_used_this_month';

-- 2. Si le type est 'integer' ou 'bigint', le changer en 'numeric'
-- Cette commande va convertir toutes les valeurs existantes en décimales
ALTER TABLE users 
ALTER COLUMN analysis_used_this_month TYPE numeric(10,2) 
USING analysis_used_this_month::numeric(10,2);

-- 3. Vérifier que le changement a bien été appliqué
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'analysis_used_this_month';

-- 4. Tester avec une valeur décimale
-- Mettez votre user_id ici pour tester
-- UPDATE users 
-- SET analysis_used_this_month = 8.5 
-- WHERE id = 'votre-user-id-ici';

-- 5. Vérifier que la valeur décimale est bien stockée
-- SELECT id, analysis_used_this_month 
-- FROM users 
-- WHERE id = 'votre-user-id-ici';





















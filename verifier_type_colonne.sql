-- Script pour vérifier que le type de colonne a bien été modifié
-- À exécuter dans Supabase SQL Editor

-- Vérifier le type actuel de la colonne
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'analysis_used_this_month';

-- Si vous voyez :
-- data_type = 'numeric'
-- numeric_precision = 10
-- numeric_scale = 2
-- Alors c'est ✅ CORRECT !

-- Test : Mettre une valeur décimale et vérifier qu'elle est bien stockée
-- Remplacez 'votre-user-id' par votre ID utilisateur réel
-- UPDATE users 
-- SET analysis_used_this_month = 8.5 
-- WHERE id = 'votre-user-id';

-- Vérifier la valeur stockée
-- SELECT id, analysis_used_this_month 
-- FROM users 
-- WHERE id = 'votre-user-id';
-- Vous devriez voir 8.5 et non 8 ou 9




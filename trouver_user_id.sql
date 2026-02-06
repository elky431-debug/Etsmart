-- Script pour trouver votre user_id et tester les décimales
-- Copiez-collez ce script dans Supabase SQL Editor

-- ÉTAPE 1 : Trouver votre user_id avec votre email
-- Remplacez 'votre-email@exemple.com' par votre VRAI email
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE email = 'votre-email@exemple.com';

-- OU si vous ne connaissez pas votre email, listez tous les utilisateurs :
SELECT id, email, analysis_used_this_month 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;

-- ÉTAPE 2 : Une fois que vous avez votre user_id (c'est un UUID qui ressemble à : 
-- '123e4567-e89b-12d3-a456-426614174000')
-- Remplacez 'VOTRE-UUID-ICI' par le vrai UUID trouvé à l'étape 1

-- Mettre une valeur décimale
UPDATE users 
SET analysis_used_this_month = 8.5 
WHERE id = 'VOTRE-UUID-ICI';

-- Vérifier que c'est bien stocké (vous devriez voir 8.5)
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE id = 'VOTRE-UUID-ICI';








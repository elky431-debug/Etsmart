-- Script de test simple pour les décimales
-- Copiez-collez tout ce script dans Supabase SQL Editor et exécutez-le

-- ÉTAPE 1 : Trouver votre user_id
-- Remplacez 'votre-email@exemple.com' par votre email
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE email = 'votre-email@exemple.com';

-- OU si vous connaissez déjà votre user_id, utilisez-le directement :
-- SELECT id, email, analysis_used_this_month 
-- FROM users 
-- WHERE id = 'votre-user-id-ici';

-- ÉTAPE 2 : Mettre une valeur décimale (8.5)
-- Remplacez 'votre-user-id-ici' par l'ID que vous avez trouvé à l'étape 1
UPDATE users 
SET analysis_used_this_month = 8.5 
WHERE id = 'votre-user-id-ici';

-- ÉTAPE 3 : Vérifier que la valeur décimale est bien stockée
-- Vous devriez voir 8.5 et non 8 ou 9
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE id = 'votre-user-id-ici';















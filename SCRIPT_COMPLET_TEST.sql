-- Script complet pour tester les décimales
-- Exécutez d'abord cette requête pour trouver votre user_id

-- OPTION 1 : Si vous connaissez votre email
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE email = 'METTEZ-VOTRE-EMAIL-ICI@exemple.com';

-- OPTION 2 : Voir tous les utilisateurs récents
SELECT id, email, analysis_used_this_month, created_at
FROM users 
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================
-- Une fois que vous avez votre user_id (UUID)
-- Copiez l'UUID et remplacez-le dans les requêtes ci-dessous
-- ============================================

-- Mettre une valeur décimale (remplacez l'UUID)
UPDATE users 
SET analysis_used_this_month = 8.5 
WHERE id = 'COLLEZ-VOTRE-UUID-ICI';

-- Vérifier que la valeur décimale est bien stockée
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE id = 'COLLEZ-VOTRE-UUID-ICI';

-- Vous devriez voir analysis_used_this_month = 8.5 ✅

















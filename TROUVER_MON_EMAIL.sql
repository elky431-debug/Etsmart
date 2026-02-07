-- Script pour trouver votre email dans la base de données
-- À exécuter dans Supabase SQL Editor

-- 1. Lister tous les utilisateurs avec leur email et leurs crédits
SELECT id, email, analysis_used_this_month, analysis_quota, subscription_status
FROM users
ORDER BY created_at DESC
LIMIT 20;

-- 2. Une fois que vous avez trouvé votre email, utilisez-le dans les autres requêtes
-- Remplacez 'votre-email@example.com' par votre email réel

-- 3. Vérifier votre valeur actuelle de crédits
SELECT id, email, analysis_used_this_month, analysis_quota
FROM users 
WHERE email = 'METTEZ-VOTRE-EMAIL-ICI@example.com';

-- 4. Après avoir généré un listing, vérifiez si la valeur a changé
SELECT id, email, analysis_used_this_month, analysis_quota,
       pg_typeof(analysis_used_this_month) as column_type
FROM users 
WHERE email = 'METTEZ-VOTRE-EMAIL-ICI@example.com';










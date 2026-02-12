-- Test simple : Voir tous les utilisateurs et leurs crédits
-- À exécuter dans Supabase SQL Editor

-- Cette requête va afficher tous les utilisateurs avec leurs crédits
SELECT 
    id,
    email,
    analysis_used_this_month,
    analysis_quota,
    subscription_status,
    subscription_plan,
    pg_typeof(analysis_used_this_month) as column_type
FROM users
ORDER BY created_at DESC;

-- Trouvez votre ligne dans les résultats
-- Notez votre email et votre valeur actuelle de analysis_used_this_month
-- Ensuite, générez un listing et ré-exécutez cette requête pour voir si la valeur a changé




















-- Ajouter 30 crédits à elky431@icloud.com
-- Crédits restants = COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0)
-- Exécuter dans Supabase → SQL Editor

-- 1. État actuel
SELECT
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0)) AS credits_restants
FROM users
WHERE email = 'elky431@icloud.com';

-- 2. +30 sur le quota
UPDATE users
SET
  analysis_quota = COALESCE(analysis_quota, 0) + 30,
  updated_at = NOW()
WHERE email = 'elky431@icloud.com';

-- 3. Si l’UPDATE a touché 0 ligne, l’email n’existe pas dans public.users.
-- 4. Vérification
SELECT
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0)) AS credits_restants
FROM users
WHERE email = 'elky431@icloud.com';

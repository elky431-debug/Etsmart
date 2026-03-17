-- Ajouter 50 crédits à salyamine21@gmail.com
-- Exécute ce script dans Supabase SQL Editor

-- 1. État actuel (vérification)
SELECT 
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0)) as credits_restants
FROM users
WHERE email = 'salyamine21@gmail.com';

-- 2. Ajouter 50 au quota
UPDATE users
SET 
  analysis_quota = COALESCE(analysis_quota, 0) + 50,
  updated_at = NOW()
WHERE email = 'salyamine21@gmail.com';

-- 3. Vérification du résultat
SELECT 
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0)) as credits_restants
FROM users
WHERE email = 'salyamine21@gmail.com';

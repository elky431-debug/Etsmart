-- Remettre les crédits au maximum pour elky431@gmail.com
-- Exécuter dans Supabase : SQL Editor → coller et Run

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
WHERE email = 'elky431@gmail.com';

-- 2. Remettre les crédits au max : utilisé = 0, quota = 9999 si pas déjà illimité
UPDATE users
SET
  analysis_used_this_month = 0,
  analysis_quota = CASE
    WHEN COALESCE(analysis_quota, 0) = -1 THEN -1
    ELSE GREATEST(COALESCE(analysis_quota, 0), 9999)
  END,
  updated_at = NOW()
WHERE email = 'elky431@gmail.com';

-- 3. Vérification
SELECT
  id,
  email,
  subscription_plan,
  analysis_quota,
  analysis_used_this_month,
  (CASE
    WHEN analysis_quota = -1 THEN 'Illimité'
    ELSE (analysis_quota - COALESCE(analysis_used_this_month, 0))::text
  END) AS credits_restants
FROM users
WHERE email = 'elky431@gmail.com';

-- Mettre sami.haddou33@gmail.com en plan INFINITY (crédits illimités)
-- Exécute ce script dans Supabase SQL Editor (tout d'un coup)

-- 1. État actuel (vérification)
SELECT 
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  current_period_start,
  current_period_end
FROM users
WHERE email = 'sami.haddou33@gmail.com';

-- 2. Autoriser 'INFINITY' : retirer la contrainte CHECK si elle bloque
--    (Supabase peut utiliser subscription_plan en snake_case ou subscriptionPlan en camelCase)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_plan_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscriptionplan_check;

-- 3. Passer au plan INFINITY avec crédits illimités + période valide
UPDATE users
SET 
  subscription_plan = 'INFINITY',
  subscription_status = 'active',
  analysis_quota = -1,
  analysis_used_this_month = 0,
  current_period_start = COALESCE(current_period_start, NOW()),
  current_period_end = COALESCE(current_period_end, NOW() + INTERVAL '1 year'),
  updated_at = NOW()
WHERE email = 'sami.haddou33@gmail.com';

-- 4. Si ta table utilise encore camelCase (subscriptionPlan), décommente et exécute :
-- UPDATE users
-- SET "subscriptionPlan" = 'INFINITY', "subscriptionStatus" = 'active',
--     "analysisQuota" = -1, "analysisUsedThisMonth" = 0, updated_at = NOW()
-- WHERE email = 'sami.haddou33@gmail.com';

-- 5. Vérification du résultat (doit afficher subscription_plan = INFINITY, analysis_quota = -1)
SELECT 
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  current_period_start,
  current_period_end,
  CASE WHEN analysis_quota = -1 THEN 'Illimité' ELSE (analysis_quota - COALESCE(analysis_used_this_month, 0))::text END as credits_restants
FROM users
WHERE email = 'sami.haddou33@gmail.com';

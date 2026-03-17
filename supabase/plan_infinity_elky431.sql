-- Donner l'abonnement infini (plan INFINITY) à elky431@gmail.com
-- Exécuter dans Supabase : SQL Editor → coller et Run

-- 1. État actuel
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
WHERE email = 'elky431@gmail.com';

-- 2. Retirer la contrainte CHECK si elle bloque la valeur 'INFINITY'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_plan_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscriptionplan_check;

-- 3. Passer au plan INFINITY (crédits illimités) + période valide 1 an
UPDATE users
SET
  subscription_plan = 'INFINITY',
  subscription_status = 'active',
  analysis_quota = -1,
  analysis_used_this_month = 0,
  current_period_start = COALESCE(current_period_start, NOW()),
  current_period_end = COALESCE(current_period_end, NOW() + INTERVAL '1 year'),
  updated_at = NOW()
WHERE email = 'elky431@gmail.com';

-- 4. Si la table utilise camelCase, exécuter ce bloc À LA PLACE du bloc 3 :
/*
UPDATE users
SET
  "subscriptionPlan" = 'INFINITY',
  "subscriptionStatus" = 'active',
  "analysisQuota" = -1,
  "analysisUsedThisMonth" = 0,
  "currentPeriodStart" = COALESCE("currentPeriodStart", NOW()),
  "currentPeriodEnd" = COALESCE("currentPeriodEnd", NOW() + INTERVAL '1 year'),
  updated_at = NOW()
WHERE email = 'elky431@gmail.com';
*/

-- 5. Vérification (analysis_quota = -1 = illimité)
SELECT
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  current_period_start,
  current_period_end,
  CASE WHEN analysis_quota = -1 THEN 'Illimité' ELSE (analysis_quota - COALESCE(analysis_used_this_month, 0))::text END AS credits_restants
FROM users
WHERE email = 'elky431@gmail.com';

-- Renouveler l'abonnement pour elky431@icloud.com
-- Exécuter dans Supabase : SQL Editor → coller et Run
-- Après exécution, cliquer sur "Actualiser" sur la page Abonnement ou rafraîchir (F5).

-- 1. État actuel (vérifier les noms de colonnes affichés)
SELECT
  id,
  email,
  subscription_plan,
  subscription_status,
  current_period_start,
  current_period_end,
  analysis_quota,
  analysis_used_this_month
FROM users
WHERE email = 'elky431@icloud.com';

-- 2a. Renouveler (colonnes snake_case — utilisées par l’API / Stripe)
UPDATE users
SET
  subscription_status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '1 year',
  analysis_used_this_month = 0,
  analysis_quota = GREATEST(COALESCE(analysis_quota, 0), 120),
  updated_at = NOW()
WHERE email = 'elky431@icloud.com';

-- 2b. Si ta table utilise camelCase (schema.sql), exécuter ce bloc À LA PLACE du bloc 2a :
/*
UPDATE users
SET
  "subscriptionStatus" = 'active',
  "currentPeriodStart" = NOW(),
  "currentPeriodEnd" = NOW() + INTERVAL '1 year',
  "analysisUsedThisMonth" = 0,
  "analysisQuota" = GREATEST(COALESCE("analysisQuota", 0), 120),
  updated_at = NOW()
WHERE email = 'elky431@icloud.com';
*/

-- 3. Vérification
SELECT
  id,
  email,
  subscription_plan,
  subscription_status,
  current_period_start AS debut_periode,
  current_period_end AS fin_periode,
  analysis_quota,
  analysis_used_this_month AS utilise,
  (COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0)) AS credits_restants
FROM users
WHERE email = 'elky431@icloud.com';

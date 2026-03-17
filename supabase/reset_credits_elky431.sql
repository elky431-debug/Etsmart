-- Script pour remettre les crédits au maximum pour elky431@gmail.com
-- Exécute ce script dans Supabase SQL Editor

-- 1. Trouver l'utilisateur et voir son état actuel
SELECT 
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (analysis_quota - COALESCE(analysis_used_this_month, 0)) as remaining_credits
FROM users
WHERE email = 'elky431@gmail.com';

-- 2. Remettre les crédits utilisés à 0 (remet au maximum)
UPDATE users
SET 
  analysis_used_this_month = 0,
  updated_at = NOW()
WHERE email = 'elky431@gmail.com';

-- 3. Si l'utilisateur n'a pas de quota défini, lui donner un quota élevé (ex: 1000)
UPDATE users
SET 
  analysis_quota = COALESCE(analysis_quota, 1000),
  analysis_used_this_month = 0,
  updated_at = NOW()
WHERE email = 'elky431@gmail.com' 
  AND (analysis_quota IS NULL OR analysis_quota = 0);

-- 4. Vérifier le résultat
SELECT 
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (analysis_quota - COALESCE(analysis_used_this_month, 0)) as remaining_credits,
  CASE 
    WHEN analysis_quota = -1 THEN 'Unlimited'
    ELSE (analysis_quota - COALESCE(analysis_used_this_month, 0))::text
  END as credits_available
FROM users
WHERE email = 'elky431@gmail.com';

-- 5. Optionnel : Mettre le plan à PRO ou SCALE pour avoir plus de crédits
-- Décommente la ligne suivante si tu veux aussi mettre à jour le plan :
-- UPDATE users SET subscription_plan = 'PRO', subscription_status = 'active' WHERE email = 'elky431@gmail.com';


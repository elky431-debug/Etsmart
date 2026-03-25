-- Ajouter 1000 crédits à largekeyann@gmail.com
-- À exécuter dans Supabase → SQL Editor (service role / postgres OK)
--
-- Les crédits utilisés par l’app = analysis_quota − analysis_used_this_month
-- (tant que subscription_status = 'active').

-- 1. État avant
SELECT
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0))::numeric AS credits_restants
FROM public.users
WHERE lower(email) = lower('largekeyann@gmail.com');

-- 2. +1000 sur le quota + abonnement actif (sinon l’app refuse les déductions)
UPDATE public.users
SET
  analysis_quota = COALESCE(analysis_quota, 0) + 1000,
  subscription_status = 'active',
  updated_at = NOW()
WHERE lower(email) = lower('largekeyann@gmail.com');

-- 3. Si aucune ligne mise à jour : l’utilisateur n’existe pas encore dans public.users
--    (créer la ligne depuis ton flow d’inscription ou via le dashboard).

-- 4. Vérification
SELECT
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0))::numeric AS credits_restants
FROM public.users
WHERE lower(email) = lower('largekeyann@gmail.com');

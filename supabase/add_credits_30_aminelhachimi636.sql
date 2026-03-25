-- +30 crédits — aminelhachimi636@gmail.com
--
-- IMPORTANT (pourquoi il « ne recevait pas » les crédits) :
-- L’app (getUserQuotaInfo / déduction) ne lit le quota DB que si
-- subscription_status = 'active'. Sinon remaining = 0 même avec un gros analysis_quota.
--
-- Ce script : +30 sur analysis_quota ET subscription_status = 'active'.
-- Email en lower() pour éviter les soucis de casse.
--
-- Si UPDATE retourne 0 ligne : pas de ligne dans public.users avec cet email
-- → l’utilisateur doit d’abord créer son compte / déclencher la synchro profil.

-- 1. Vérifier présence + état (doit montrer 1 ligne avec le bon id)
SELECT
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0)) AS credits_restants
FROM public.users
WHERE lower(trim(email)) = lower(trim('aminelhachimi636@gmail.com'));

-- 2. Crédits + abonnement actif (obligatoire pour que l’app affiche / utilise les crédits)
UPDATE public.users
SET
  analysis_quota = COALESCE(analysis_quota, 0) + 30,
  subscription_status = 'active',
  updated_at = NOW()
WHERE lower(trim(email)) = lower(trim('aminelhachimi636@gmail.com'))
RETURNING
  id,
  email,
  subscription_plan,
  subscription_status,
  analysis_quota,
  analysis_used_this_month,
  (COALESCE(analysis_quota, 0) - COALESCE(analysis_used_this_month, 0)) AS credits_restants;

-- 3. Si subscription_plan reste 'FREE' : quota plan côté code = 0, mais Math.max(plan, db) avec db boosté reste OK.
--    Pour forcer aussi un plan payant affiché, décommente :
-- UPDATE public.users SET subscription_plan = 'SMART' WHERE lower(trim(email)) = lower(trim('aminelhachimi636@gmail.com'));

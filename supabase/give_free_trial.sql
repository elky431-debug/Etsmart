-- Script: Give free trial subscription to existing users
-- Run this SQL in your Supabase SQL Editor to give all existing users a SMART plan trial

-- Option 1: Give SMART plan (20 analyses/month) to ALL existing users
UPDATE public.users
SET 
  subscriptionPlan = 'SMART',
  subscriptionStatus = 'active',
  analysisQuota = 20,
  analysisUsedThisMonth = 0,
  currentPeriodStart = NOW(),
  currentPeriodEnd = NOW() + INTERVAL '30 days'
WHERE subscriptionStatus = 'inactive' OR subscriptionStatus IS NULL;

-- Option 2: Give SMART plan to a SPECIFIC user by email (uncomment and use this instead)
-- UPDATE public.users
-- SET 
--   subscriptionPlan = 'SMART',
--   subscriptionStatus = 'active',
--   analysisQuota = 20,
--   analysisUsedThisMonth = 0,
--   currentPeriodStart = NOW(),
--   currentPeriodEnd = NOW() + INTERVAL '30 days'
-- WHERE email = 'votre-email@example.com';

-- Verify the update
SELECT 
  id,
  email,
  subscriptionPlan,
  subscriptionStatus,
  analysisQuota,
  analysisUsedThisMonth,
  currentPeriodStart,
  currentPeriodEnd
FROM public.users
ORDER BY created_at DESC
LIMIT 10;


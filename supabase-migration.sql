-- ═══════════════════════════════════════════════════════════════════════════════
-- ETSMART PAYWALL & SUBSCRIPTION MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- This migration adds subscription and quota fields to the users table
-- Run this in your Supabase SQL editor

-- Add subscription fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT DEFAULT 'FREE' CHECK ("subscriptionPlan" IN ('FREE', 'SMART', 'PRO', 'SCALE')),
ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT DEFAULT 'inactive' CHECK ("subscriptionStatus" IN ('active', 'inactive', 'canceled', 'past_due')),
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
ADD COLUMN IF NOT EXISTS "analysisUsedThisMonth" INTEGER DEFAULT 0 CHECK ("analysisUsedThisMonth" >= 0),
ADD COLUMN IF NOT EXISTS "analysisQuota" INTEGER DEFAULT 0 CHECK ("analysisQuota" >= 0),
ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMPTZ;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users("subscriptionStatus");
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users("stripeCustomerId");
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON users("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS idx_users_period_end ON users("currentPeriodEnd");

-- Set default quota based on plan
UPDATE users
SET "analysisQuota" = CASE
  WHEN "subscriptionPlan" = 'SMART' THEN 20
  WHEN "subscriptionPlan" = 'PRO' THEN 50
  WHEN "subscriptionPlan" = 'SCALE' THEN 100
  ELSE 0
END
WHERE "analysisQuota" = 0 OR "analysisQuota" IS NULL;

-- Function to reset monthly quotas (called by cron job)
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS TABLE(reset_count INTEGER, error_count INTEGER) AS $$
DECLARE
  reset_count INTEGER := 0;
  error_count INTEGER := 0;
  user_record RECORD;
  new_period_start TIMESTAMPTZ;
  new_period_end TIMESTAMPTZ;
BEGIN
  new_period_start := NOW();
  new_period_end := NOW() + INTERVAL '30 days';
  
  -- Get all users with expired periods
  FOR user_record IN
    SELECT id, "currentPeriodEnd"
    FROM users
    WHERE "subscriptionStatus" IN ('active', 'past_due')
      AND "currentPeriodEnd" IS NOT NULL
      AND "currentPeriodEnd" < NOW()
  LOOP
    BEGIN
      UPDATE users
      SET
        "analysisUsedThisMonth" = 0,
        "currentPeriodStart" = new_period_start,
        "currentPeriodEnd" = new_period_end
      WHERE id = user_record.id;
      
      reset_count := reset_count + 1;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING 'Error resetting quota for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT reset_count, error_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to safely increment analysis count
CREATE OR REPLACE FUNCTION increment_analysis_count(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_used INTEGER;
  v_quota INTEGER;
  v_status TEXT;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Get current user data
  SELECT 
    "analysisUsedThisMonth",
    "analysisQuota",
    "subscriptionStatus",
    "currentPeriodEnd"
  INTO v_used, v_quota, v_status, v_period_end
  FROM users
  WHERE id = p_user_id;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if subscription is active
  IF v_status != 'active' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if period has expired (reset needed)
  IF v_period_end IS NOT NULL AND v_period_end < NOW() THEN
    -- Reset monthly quota
    UPDATE users
    SET
      "analysisUsedThisMonth" = 0,
      "currentPeriodStart" = NOW(),
      "currentPeriodEnd" = NOW() + INTERVAL '30 days'
    WHERE id = p_user_id;
    
    v_used := 0;
  END IF;
  
  -- Check if quota is reached
  IF v_used >= v_quota THEN
    RETURN FALSE;
  END IF;
  
  -- Increment count
  UPDATE users
  SET "analysisUsedThisMonth" = v_used + 1
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION reset_monthly_quotas() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_analysis_count(UUID) TO authenticated;


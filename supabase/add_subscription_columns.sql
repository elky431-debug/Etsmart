-- Migration: Add subscription columns to users table
-- Run this SQL in your Supabase SQL Editor

-- Add subscription columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS subscriptionPlan TEXT DEFAULT 'FREE' CHECK (subscriptionPlan IN ('FREE', 'SMART', 'PRO', 'SCALE')),
ADD COLUMN IF NOT EXISTS subscriptionStatus TEXT DEFAULT 'inactive' CHECK (subscriptionStatus IN ('active', 'inactive', 'canceled', 'past_due')),
ADD COLUMN IF NOT EXISTS stripeCustomerId TEXT,
ADD COLUMN IF NOT EXISTS stripeSubscriptionId TEXT,
ADD COLUMN IF NOT EXISTS analysisQuota INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS analysisUsedThisMonth INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS currentPeriodStart TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS currentPeriodEnd TIMESTAMP WITH TIME ZONE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripeCustomerId);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscriptionStatus);

-- Add comments to document the columns
COMMENT ON COLUMN public.users.subscriptionPlan IS 'User subscription plan: FREE, SMART, PRO, or SCALE';
COMMENT ON COLUMN public.users.subscriptionStatus IS 'Subscription status: active, inactive, canceled, or past_due';
COMMENT ON COLUMN public.users.stripeCustomerId IS 'Stripe customer ID for payment processing';
COMMENT ON COLUMN public.users.stripeSubscriptionId IS 'Stripe subscription ID';
COMMENT ON COLUMN public.users.analysisQuota IS 'Monthly analysis quota based on subscription plan';
COMMENT ON COLUMN public.users.analysisUsedThisMonth IS 'Number of analyses used in current billing period';
COMMENT ON COLUMN public.users.currentPeriodStart IS 'Start date of current billing period';
COMMENT ON COLUMN public.users.currentPeriodEnd IS 'End date of current billing period';


-- Etsmart Subscriptions Schema
-- Run this SQL in your Supabase SQL Editor

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Plan information
  plan_id TEXT NOT NULL CHECK (plan_id IN ('smart', 'pro', 'scale')),
  plan_name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Subscription status
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')) DEFAULT 'active',
  
  -- Stripe integration (if using Stripe)
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  
  -- Billing cycle
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  -- Usage tracking
  analyses_used_current_month INTEGER DEFAULT 0,
  month_reset_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own subscription
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can update own subscription" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reset monthly analysis count
CREATE OR REPLACE FUNCTION reset_monthly_analyses()
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET 
    analyses_used_current_month = 0,
    month_reset_date = (date_trunc('month', NOW()::date) + interval '1 month')::timestamp with time zone
  WHERE month_reset_date < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to increment analysis count
CREATE OR REPLACE FUNCTION increment_analysis_count(p_user_id UUID)
RETURNS boolean AS $$
DECLARE
  v_subscription RECORD;
  v_plan_limit INTEGER;
BEGIN
  -- Get user's subscription
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id AND status = 'active';
  
  -- If no subscription, user is on free plan (0 analyses)
  IF v_subscription IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get plan limits
  v_plan_limit := CASE v_subscription.plan_id
    WHEN 'smart' THEN 15
    WHEN 'pro' THEN 30
    WHEN 'scale' THEN 100
    ELSE 0
  END;
  
  -- Check if reset is needed
  IF v_subscription.month_reset_date < NOW() THEN
    -- Reset counter
    UPDATE public.subscriptions
    SET 
      analyses_used_current_month = 1,
      month_reset_date = (date_trunc('month', NOW()::date) + interval '1 month')::timestamp with time zone
    WHERE id = v_subscription.id;
    RETURN true;
  END IF;
  
  -- Check if limit reached
  IF v_subscription.analyses_used_current_month >= v_plan_limit THEN
    RETURN false;
  END IF;
  
  -- Increment counter
  UPDATE public.subscriptions
  SET analyses_used_current_month = analyses_used_current_month + 1
  WHERE id = v_subscription.id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;














































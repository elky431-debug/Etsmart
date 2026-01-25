-- Etsmart Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  -- Subscription fields
  subscriptionPlan TEXT DEFAULT 'FREE' CHECK (subscriptionPlan IN ('FREE', 'SMART', 'PRO', 'SCALE')),
  subscriptionStatus TEXT DEFAULT 'inactive' CHECK (subscriptionStatus IN ('active', 'inactive', 'canceled', 'past_due')),
  stripeCustomerId TEXT,
  stripeSubscriptionId TEXT,
  analysisQuota INTEGER DEFAULT 0,
  analysisUsedThisMonth INTEGER DEFAULT 0,
  currentPeriodStart TIMESTAMP WITH TIME ZONE,
  currentPeriodEnd TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Products table (supplier products from AliExpress/Alibaba)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('aliexpress', 'alibaba')),
  title TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  category TEXT,
  shipping_time TEXT,
  min_order_quantity INTEGER DEFAULT 1,
  supplier_rating DECIMAL(3, 2),
  niche TEXT,
  custom_niche TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Product variants table
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Product analyses table (complete analysis results)
CREATE TABLE IF NOT EXISTS public.product_analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Verdict
  verdict TEXT NOT NULL CHECK (verdict IN ('launch', 'test', 'avoid')),
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  summary TEXT NOT NULL,
  ai_comment TEXT,
  difficulty_analysis TEXT,
  competition_comment TEXT,
  
  -- Competitors
  total_competitors INTEGER NOT NULL,
  competitor_estimation_reliable BOOLEAN DEFAULT true,
  competitor_estimation_reasoning TEXT,
  average_market_price DECIMAL(10, 2),
  market_price_range_min DECIMAL(10, 2),
  market_price_range_max DECIMAL(10, 2),
  market_structure TEXT CHECK (market_structure IN ('dominated', 'fragmented', 'open')),
  
  -- Pricing
  recommended_price DECIMAL(10, 2) NOT NULL,
  aggressive_price DECIMAL(10, 2),
  premium_price DECIMAL(10, 2),
  pricing_justification TEXT,
  
  -- Saturation
  saturation_phase TEXT CHECK (saturation_phase IN ('launch', 'growth', 'saturation', 'decline')),
  saturation_probability INTEGER CHECK (saturation_probability >= 0 AND saturation_probability <= 100),
  
  -- Supplier pricing
  estimated_supplier_price DECIMAL(10, 2),
  estimated_shipping_cost DECIMAL(10, 2),
  supplier_price_reasoning TEXT,
  
  -- Strengths & Risks
  strengths TEXT[] DEFAULT '{}',
  risks TEXT[] DEFAULT '{}',
  
  -- Marketing data (stored as JSONB for flexibility)
  marketing_angles JSONB,
  marketing_keywords TEXT[],
  marketing_hooks TEXT[],
  marketing_occasions TEXT[],
  strategic_marketing JSONB,
  acquisition_marketing JSONB,
  
  -- SEO
  viral_title_en TEXT,
  viral_title_fr TEXT,
  seo_tags TEXT[],
  
  -- Launch simulation
  launch_simulation JSONB,
  
  -- Etsy search query used
  etsy_search_query TEXT,
  
  -- Full analysis data (stored as JSONB for complete backup)
  full_analysis_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(product_id, user_id)
);

-- Boutique analyses table (global boutique analysis)
CREATE TABLE IF NOT EXISTS public.boutique_analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Overall metrics
  total_products INTEGER DEFAULT 0,
  total_revenue_3m DECIMAL(10, 2) DEFAULT 0,
  total_profit_3m DECIMAL(10, 2) DEFAULT 0,
  average_margin DECIMAL(5, 2) DEFAULT 0,
  
  -- Market insights
  dominant_niche TEXT,
  market_opportunities JSONB,
  risk_factors JSONB,
  
  -- Full boutique data
  boutique_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_analyses_product_id ON public.product_analyses(product_id);
CREATE INDEX IF NOT EXISTS idx_product_analyses_user_id ON public.product_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_product_analyses_created_at ON public.product_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boutique_analyses_user_id ON public.boutique_analyses(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
-- Drop existing policies if they exist, then create them
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
CREATE POLICY "Users can insert own products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own products" ON public.products;
CREATE POLICY "Users can view own products" ON public.products
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own products" ON public.products;
CREATE POLICY "Users can update own products" ON public.products
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
CREATE POLICY "Users can delete own products" ON public.products
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own product variants" ON public.product_variants;
CREATE POLICY "Users can manage own product variants" ON public.product_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_variants.product_id
      AND products.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage own product analyses" ON public.product_analyses;
CREATE POLICY "Users can manage own product analyses" ON public.product_analyses
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own boutique analyses" ON public.boutique_analyses;
CREATE POLICY "Users can manage own boutique analyses" ON public.boutique_analyses
  FOR ALL USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers to update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_analyses_updated_at ON public.product_analyses;
CREATE TRIGGER update_product_analyses_updated_at BEFORE UPDATE ON public.product_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_boutique_analyses_updated_at ON public.boutique_analyses;
CREATE TRIGGER update_boutique_analyses_updated_at BEFORE UPDATE ON public.boutique_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  target_country TEXT DEFAULT 'FR',
  currency TEXT DEFAULT 'EUR',
  preferred_channel TEXT DEFAULT 'auto' CHECK (preferred_channel IN ('auto', 'tiktok', 'facebook', 'instagram', 'pinterest')),
  ai_prudence_level TEXT DEFAULT 'balanced' CHECK (ai_prudence_level IN ('conservative', 'balanced', 'aggressive')),
  language TEXT DEFAULT 'fr',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);


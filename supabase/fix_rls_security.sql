-- ============================================================================
-- FIX RLS SECURITY POLICIES
-- Run this in Supabase SQL Editor to fix security vulnerabilities
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE - Most critical!
-- ============================================================================

-- First, ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.users;
DROP POLICY IF EXISTS "Enable delete for users based on id" ON public.users;
DROP POLICY IF EXISTS "Allow public read" ON public.users;
DROP POLICY IF EXISTS "Allow all" ON public.users;

-- SELECT: Users can only view their own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- INSERT: Only service role can insert (via trigger handle_new_user)
-- No policy for regular users - trigger uses SECURITY DEFINER
-- If you need users to insert themselves, use this:
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can only update their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: Users cannot delete their own profile (admin only via service role)
-- Deliberately NOT creating a DELETE policy - no one can delete via RLS

-- ============================================================================
-- 2. PRODUCTS TABLE
-- ============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
DROP POLICY IF EXISTS "Users can update own products" ON public.products;
DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
DROP POLICY IF EXISTS "products_select_own" ON public.products;
DROP POLICY IF EXISTS "products_insert_own" ON public.products;
DROP POLICY IF EXISTS "products_update_own" ON public.products;
DROP POLICY IF EXISTS "products_delete_own" ON public.products;

CREATE POLICY "products_select_own" ON public.products
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "products_insert_own" ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "products_update_own" ON public.products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "products_delete_own" ON public.products
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. PRODUCT_ANALYSES TABLE
-- ============================================================================

ALTER TABLE public.product_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own product analyses" ON public.product_analyses;
DROP POLICY IF EXISTS "product_analyses_select_own" ON public.product_analyses;
DROP POLICY IF EXISTS "product_analyses_insert_own" ON public.product_analyses;
DROP POLICY IF EXISTS "product_analyses_update_own" ON public.product_analyses;
DROP POLICY IF EXISTS "product_analyses_delete_own" ON public.product_analyses;

CREATE POLICY "product_analyses_select_own" ON public.product_analyses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "product_analyses_insert_own" ON public.product_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "product_analyses_update_own" ON public.product_analyses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "product_analyses_delete_own" ON public.product_analyses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. PRODUCT_VARIANTS TABLE
-- ============================================================================

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own product variants" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_select_own" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_insert_own" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_update_own" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_delete_own" ON public.product_variants;

CREATE POLICY "product_variants_select_own" ON public.product_variants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_variants.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "product_variants_insert_own" ON public.product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_variants.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "product_variants_update_own" ON public.product_variants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_variants.product_id
      AND products.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_variants.product_id
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "product_variants_delete_own" ON public.product_variants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_variants.product_id
      AND products.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. BOUTIQUE_ANALYSES TABLE
-- ============================================================================

ALTER TABLE public.boutique_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own boutique analyses" ON public.boutique_analyses;
DROP POLICY IF EXISTS "boutique_analyses_select_own" ON public.boutique_analyses;
DROP POLICY IF EXISTS "boutique_analyses_insert_own" ON public.boutique_analyses;
DROP POLICY IF EXISTS "boutique_analyses_update_own" ON public.boutique_analyses;
DROP POLICY IF EXISTS "boutique_analyses_delete_own" ON public.boutique_analyses;

CREATE POLICY "boutique_analyses_select_own" ON public.boutique_analyses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "boutique_analyses_insert_own" ON public.boutique_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "boutique_analyses_update_own" ON public.boutique_analyses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "boutique_analyses_delete_own" ON public.boutique_analyses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. USER_SETTINGS TABLE
-- ============================================================================

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_select_own" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_insert_own" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_update_own" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_delete_own" ON public.user_settings;

CREATE POLICY "user_settings_select_own" ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_settings_insert_own" ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_update_own" ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings_delete_own" ON public.user_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 7. SUBSCRIPTIONS TABLE (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscriptions' AND table_schema = 'public') THEN
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
    DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
    DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
    DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
    DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
    
    EXECUTE 'CREATE POLICY "subscriptions_select_own" ON public.subscriptions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id)';
      
    EXECUTE 'CREATE POLICY "subscriptions_insert_own" ON public.subscriptions
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id)';
      
    EXECUTE 'CREATE POLICY "subscriptions_update_own" ON public.subscriptions
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION: List all policies to confirm
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


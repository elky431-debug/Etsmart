-- ═══════════════════════════════════════════════════════════════════════════════
-- CRÉATION DE LA TABLE user_settings
-- ═══════════════════════════════════════════════════════════════════════════════
-- Exécutez ce script dans Supabase SQL Editor pour créer la table user_settings

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

-- Trigger pour mettre à jour updated_at automatiquement
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activer Row Level Security (RLS)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent voir leurs propres réglages
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent modifier leurs propres réglages
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent créer leurs propres réglages
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);























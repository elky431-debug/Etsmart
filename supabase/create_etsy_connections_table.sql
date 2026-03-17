-- Table pour stocker les connexions OAuth Etsy des utilisateurs
CREATE TABLE IF NOT EXISTS etsy_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id TEXT NOT NULL,
  shop_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shop_id)
);

-- Index pour recherche rapide par user_id
CREATE INDEX IF NOT EXISTS idx_etsy_connections_user_id ON etsy_connections(user_id);

-- Index pour recherche rapide par shop_id
CREATE INDEX IF NOT EXISTS idx_etsy_connections_shop_id ON etsy_connections(shop_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_etsy_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_etsy_connections_updated_at ON etsy_connections;
CREATE TRIGGER trigger_update_etsy_connections_updated_at
  BEFORE UPDATE ON etsy_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_etsy_connections_updated_at();

-- RLS (Row Level Security) - Les users ne peuvent voir que leurs propres connexions
ALTER TABLE etsy_connections ENABLE ROW LEVEL SECURITY;

-- Policy : Les users peuvent lire leurs propres connexions
CREATE POLICY "Users can read their own etsy connections"
  ON etsy_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy : Les users peuvent insérer leurs propres connexions
CREATE POLICY "Users can insert their own etsy connections"
  ON etsy_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy : Les users peuvent mettre à jour leurs propres connexions
CREATE POLICY "Users can update their own etsy connections"
  ON etsy_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy : Les users peuvent supprimer leurs propres connexions
CREATE POLICY "Users can delete their own etsy connections"
  ON etsy_connections
  FOR DELETE
  USING (auth.uid() = user_id);


-- Migration: Ajouter colonne local_id pour stocker les IDs locaux (screenshot-xxx, etc.)
-- et permettre à id d'être généré automatiquement par la DB

-- Ajouter colonne local_id à products si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'local_id'
  ) THEN
    ALTER TABLE public.products 
    ADD COLUMN local_id TEXT;
    
    -- Créer un index pour les recherches par local_id
    CREATE INDEX IF NOT EXISTS idx_products_local_id ON public.products(local_id);
    
    -- Commentaire pour documentation
    COMMENT ON COLUMN public.products.local_id IS 'ID local temporaire (ex: screenshot-xxx) avant insertion en DB. Permet de mapper les produits locaux aux produits DB.';
  END IF;
END $$;

-- S'assurer que id a bien un default gen_random_uuid()
DO $$
BEGIN
  -- Vérifier si la colonne id existe et a un default
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'id'
  ) THEN
    -- S'assurer que le default est bien gen_random_uuid()
    ALTER TABLE public.products 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;


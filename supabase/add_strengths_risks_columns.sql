-- Migration: Add strengths and risks columns to product_analyses table
-- Run this SQL in your Supabase SQL Editor

-- Add strengths column (array of strings)
ALTER TABLE public.product_analyses
ADD COLUMN IF NOT EXISTS strengths TEXT[] DEFAULT '{}';

-- Add risks column (array of strings)
ALTER TABLE public.product_analyses
ADD COLUMN IF NOT EXISTS risks TEXT[] DEFAULT '{}';

-- Add comment to document the columns
COMMENT ON COLUMN public.product_analyses.strengths IS 'Array of product strengths/advantages identified by AI analysis';
COMMENT ON COLUMN public.product_analyses.risks IS 'Array of product risks/challenges identified by AI analysis';


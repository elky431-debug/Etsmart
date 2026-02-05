-- ============================================
-- CORRECTION RAPIDE - À EXÉCUTER DANS SUPABASE SQL EDITOR
-- ============================================

-- 1. Vérifier le type actuel
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'analysis_used_this_month';

-- 2. Corriger le type en numeric(10,2) pour supporter les décimales
ALTER TABLE users 
ALTER COLUMN analysis_used_this_month TYPE numeric(10,2) 
USING analysis_used_this_month::numeric(10,2);

-- 3. Vérifier que ça a fonctionné
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'analysis_used_this_month';

-- 4. Tester avec votre utilisateur (remplacez l'email)
-- Trouvez votre ID :
SELECT id, email, analysis_used_this_month FROM users WHERE email = 'votre@email.com';

-- Mettez à jour avec une valeur décimale :
-- UPDATE users SET analysis_used_this_month = 8.5 WHERE id = 'VOTRE_USER_ID';

-- Vérifiez :
-- SELECT id, email, analysis_used_this_month FROM users WHERE id = 'VOTRE_USER_ID';


-- ============================================
-- SCRIPT COMPLET POUR VÉRIFIER ET CORRIGER SUPABASE
-- ============================================

-- 1. VÉRIFIER LE TYPE DE COLONNE ACTUEL
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'analysis_used_this_month';

-- 2. VÉRIFIER LES VALEURS ACTUELLES (pour voir si des décimales existent)
SELECT 
    id,
    email,
    analysis_used_this_month,
    analysis_quota,
    pg_typeof(analysis_used_this_month) as column_type
FROM users
ORDER BY created_at DESC
LIMIT 5;

-- 3. CORRIGER LE TYPE DE COLONNE SI NÉCESSAIRE
-- ⚠️ IMPORTANT: Exécutez cette commande UNIQUEMENT si le type n'est pas déjà numeric(10,2)
-- Si la colonne est déjà numeric(10,2), cette commande ne fera rien de mal, mais elle n'est pas nécessaire

-- Option A: Si la colonne est de type integer ou real
ALTER TABLE users 
ALTER COLUMN analysis_used_this_month TYPE numeric(10,2) 
USING analysis_used_this_month::numeric(10,2);

-- Option B: Si la colonne est de type text ou varchar
-- ALTER TABLE users 
-- ALTER COLUMN analysis_used_this_month TYPE numeric(10,2) 
-- USING CASE 
--   WHEN analysis_used_this_month = '' THEN 0
--   ELSE analysis_used_this_month::numeric(10,2)
-- END;

-- 4. VÉRIFIER QUE LA MODIFICATION A FONCTIONNÉ
SELECT 
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'analysis_used_this_month';

-- 5. TESTER AVEC UNE VALEUR DÉCIMALE
-- Remplacez 'VOTRE_USER_ID' par votre ID utilisateur réel
-- Vous pouvez trouver votre ID avec: SELECT id, email FROM users WHERE email = 'votre@email.com';
/*
UPDATE users 
SET analysis_used_this_month = 8.5
WHERE id = 'VOTRE_USER_ID';

-- Vérifier que la valeur a été enregistrée correctement
SELECT 
    id,
    email,
    analysis_used_this_month,
    pg_typeof(analysis_used_this_month) as column_type
FROM users
WHERE id = 'VOTRE_USER_ID';
*/

-- 6. VÉRIFIER LES PERMISSIONS (Row Level Security)
-- Assurez-vous que les utilisateurs peuvent lire et mettre à jour leur propre ligne
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
WHERE tablename = 'users';

-- 7. VÉRIFIER LES TRIGGERS QUI POURRAIENT INTERFÉRER
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users';


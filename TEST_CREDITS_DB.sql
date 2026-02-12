-- Script de test pour vérifier que les crédits sont bien déduits dans la DB
-- À exécuter dans Supabase SQL Editor

-- 1. Trouver votre user_id (remplacez l'email par le vôtre)
SELECT id, email, analysis_used_this_month, analysis_quota
FROM users 
WHERE email = 'votre-email@example.com';

-- 2. Voir la valeur actuelle AVANT la génération d'un listing
-- Notez cette valeur (ex: 10.0)

-- 3. Générez un listing dans l'application

-- 4. Vérifiez la valeur APRÈS la génération (elle devrait être +0.5)
SELECT id, email, analysis_used_this_month, analysis_quota,
       pg_typeof(analysis_used_this_month) as column_type
FROM users 
WHERE email = 'votre-email@example.com';

-- Si analysis_used_this_month n'a pas changé, le problème est dans l'API
-- Si analysis_used_this_month a changé mais l'UI ne se met pas à jour, le problème est dans le rafraîchissement

-- 5. Test manuel : Mettre une valeur décimale directement
UPDATE users
SET analysis_used_this_month = 10.5
WHERE email = 'votre-email@example.com';

-- 6. Vérifier que la valeur est bien stockée
SELECT id, email, analysis_used_this_month, 
       pg_typeof(analysis_used_this_month) as column_type
FROM users 
WHERE email = 'votre-email@example.com';

-- Vous devriez voir 10.5 dans analysis_used_this_month



















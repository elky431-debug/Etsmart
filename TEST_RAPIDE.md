# 🚀 Test rapide des décimales

## Option 1 : Si vous connaissez votre email

Copiez-collez ce script dans Supabase SQL Editor :

```sql
-- 1. Trouver votre user_id avec votre email
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE email = 'METTEZ-VOTRE-EMAIL-ICI@exemple.com';

-- 2. Mettre une valeur décimale (remplacez l'ID par celui trouvé à l'étape 1)
UPDATE users 
SET analysis_used_this_month = 8.5 
WHERE id = 'METTEZ-VOTRE-USER-ID-ICI';

-- 3. Vérifier que c'est bien stocké (vous devriez voir 8.5)
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE id = 'METTEZ-VOTRE-USER-ID-ICI';
```

## Option 2 : Si vous connaissez déjà votre user_id

Copiez-collez ce script (remplacez juste l'ID) :

```sql
-- Mettre une valeur décimale
UPDATE users 
SET analysis_used_this_month = 8.5 
WHERE id = 'METTEZ-VOTRE-USER-ID-ICI';

-- Vérifier
SELECT id, email, analysis_used_this_month 
FROM users 
WHERE id = 'METTEZ-VOTRE-USER-ID-ICI';
```

## Option 3 : Voir tous les utilisateurs

```sql
-- Voir tous les utilisateurs avec leurs crédits
SELECT id, email, analysis_used_this_month 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;
```

Puis utilisez l'ID de votre utilisateur dans les scripts ci-dessus.

## ✅ Résultat attendu

Après l'UPDATE, quand vous faites le SELECT, vous devriez voir :
- `analysis_used_this_month` = `8.5` ✅

Si vous voyez `8` ou `9`, il y a un problème.























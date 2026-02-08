# ✅ Test : Vérification des décimales

## Étape 1 : Vérifier le type de colonne

Exécutez ce script dans Supabase SQL Editor :

```sql
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'analysis_used_this_month';
```

**Résultat attendu :**
- `data_type` = `numeric` ✅
- `numeric_precision` = `10` ✅
- `numeric_scale` = `2` ✅

## Étape 2 : Tester avec une valeur décimale

1. **Trouvez votre user_id** :
   ```sql
   SELECT id, email, analysis_used_this_month 
   FROM users 
   LIMIT 5;
   ```

2. **Mettez une valeur décimale** (remplacez `'votre-user-id'` par votre ID) :
   ```sql
   UPDATE users 
   SET analysis_used_this_month = 8.5 
   WHERE id = 'votre-user-id';
   ```

3. **Vérifiez que la valeur est bien stockée** :
   ```sql
   SELECT id, analysis_used_this_month 
   FROM users 
   WHERE id = 'votre-user-id';
   ```

   **Vous devriez voir `8.5` et non `8` ou `9`** ✅

## Étape 3 : Tester dans l'application

1. **Faites une analyse** dans l'application
2. **Vérifiez l'en-tête** : les crédits devraient passer de `8` à `8.5`
3. **Vérifiez dans Supabase** :
   ```sql
   SELECT id, analysis_used_this_month 
   FROM users 
   WHERE id = 'votre-user-id';
   ```
   Vous devriez voir `8.5` ✅

## 🎉 Si tout fonctionne

- ✅ Le type de colonne est `numeric(10,2)`
- ✅ Les valeurs décimales sont stockées correctement (8.5, 8.75, etc.)
- ✅ L'affichage montre les décimales dans l'application
- ✅ Les crédits se mettent à jour après chaque opération

## ❌ Si ça ne fonctionne pas

1. Vérifiez que le script ALTER TABLE a bien été exécuté
2. Vérifiez que vous voyez `numeric` et non `integer` dans le type
3. Vérifiez les logs serveur pour voir si `incrementAnalysisCount` fonctionne
4. Vérifiez que `parseFloat()` est bien utilisé partout dans le code











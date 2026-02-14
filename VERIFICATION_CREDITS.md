# Vérification du système de crédits décimaux

## ✅ Vérifications effectuées dans le code

### 1. Stockage des crédits (0.5, 0.25)
- ✅ `src/app/api/ai-analyze/route.ts` : Appelle `incrementAnalysisCount(user.id, 0.5)` après analyse
- ✅ `src/app/api/generate-etsy-description/route.ts` : Appelle `incrementAnalysisCount(user.id, 0.25)` après génération listing
- ✅ `src/app/api/generate-images/route.ts` : Appelle `incrementAnalysisCount(user.id, 0.25)` après génération image
- ✅ `src/lib/subscription-quota.ts` : `incrementAnalysisCount` accepte un paramètre `amount` (défaut 0.5) et fait `newUsed = currentUsed + amount`

### 2. Lecture des crédits avec décimales
- ✅ `src/lib/subscription-quota.ts` : Utilise `parseFloat(user.analysis_used_this_month)` pour lire les décimales
- ✅ `src/app/api/check-stripe-subscription/route.ts` : Utilise `parseFloat(rawValue)` pour lire les décimales
- ✅ `src/hooks/useSubscription.ts` : Parse `used` et `remaining` avec `parseFloat()` dans les deux chemins (Stripe direct et API fallback)

### 3. Affichage des crédits avec décimales
- ✅ `src/components/steps/ResultsStep.tsx` : Affiche `{subscription.used % 1 === 0 ? subscription.used : subscription.used.toFixed(1)}`
- ✅ `src/components/steps/ProductImport.tsx` : Affiche les décimales
- ✅ `src/components/dashboard/DashboardSubscription.tsx` : Affiche les décimales
- ✅ `src/components/dashboard/QuotaDisplay.tsx` : Affiche les décimales pour `used` et `remaining`

### 4. Rafraîchissement après opérations
- ✅ `src/components/steps/AnalysisStep.tsx` : Rafraîchit après analyse avec délai de 1 seconde
- ✅ `src/components/steps/ImageGenerator.tsx` : Rafraîchit après génération image avec délai de 1 seconde
- ✅ `src/components/dashboard/DashboardListingImages.tsx` : Rafraîchit après génération listing avec délai de 1 seconde
- ✅ `src/components/dashboard/DashboardSubscription.tsx` : Écoute l'événement `subscription-refresh` pour se rafraîchir

## ⚠️ VÉRIFICATION CRITIQUE : Type de colonne dans Supabase

**IMPORTANT** : Pour que les décimales fonctionnent, la colonne `analysis_used_this_month` dans la table `users` de Supabase DOIT être de type `numeric` ou `real`, PAS `integer`.

### Comment vérifier/modifier dans Supabase :

1. **Ouvrir Supabase Dashboard**
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Vérifier le type de colonne**
   - Allez dans "Table Editor" → Table `users`
   - Cliquez sur la colonne `analysis_used_this_month`
   - Vérifiez le type affiché

3. **Si le type est `integer` :**
   - Allez dans "SQL Editor"
   - Exécutez cette commande SQL :
   ```sql
   ALTER TABLE users 
   ALTER COLUMN analysis_used_this_month TYPE numeric(10,2);
   ```
   - Cela changera le type de `integer` à `numeric(10,2)` qui supporte les décimales (10 chiffres au total, 2 après la virgule)

4. **Vérifier que ça fonctionne**
   - Faites une analyse
   - Vérifiez dans Supabase que la valeur est bien `8.5` et non `8` ou `9`

## 🔍 Test manuel

1. **Faire une analyse**
   - Importez un produit
   - Lancez une analyse
   - Vérifiez que les crédits passent de `8` à `8.5` dans l'en-tête

2. **Faire une génération listing**
   - Allez dans "Listing et Images"
   - Générez une description
   - Vérifiez que les crédits passent de `8.5` à `8.75`

3. **Faire une génération image**
   - Générez une image
   - Vérifiez que les crédits passent de `8.75` à `9`

## 📝 Logs à vérifier

Dans la console du navigateur, vous devriez voir :
```
✅ Quota incremented successfully after analysis: {
  used: 8.5,
  quota: 100,
  remaining: 91.5,
  amount: 0.5
}
```

Dans les logs serveur (Netlify Functions), vous devriez voir :
```
[incrementAnalysisCount] Incrementing from 8 to 8.5 (0.5 credit)
[incrementAnalysisCount] ✅ Successfully incremented to 8.5
```

## 🚨 Si ça ne fonctionne toujours pas

1. Vérifiez que le type de colonne est bien `numeric` ou `real` dans Supabase
2. Vérifiez les logs serveur pour voir si l'update fonctionne
3. Vérifiez que `parseFloat()` est bien utilisé partout où on lit les valeurs
4. Vérifiez que l'affichage utilise bien `.toFixed(1)` pour les décimales





















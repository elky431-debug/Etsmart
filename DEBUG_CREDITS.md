# 🔍 Debug des crédits qui ne se mettent pas à jour

## ✅ Vérification effectuée
Le type de colonne est **correct** : `numeric(10,2)` ✅

## 🔍 Prochaines étapes de debug

### 1. Vérifier si l'API déduit bien les crédits dans la DB

1. **Notez votre valeur actuelle** :
   ```sql
   SELECT id, email, analysis_used_this_month 
   FROM users 
   WHERE email = 'votre-email@example.com';
   ```
   Notez la valeur de `analysis_used_this_month` (ex: `10.0`)

2. **Générez un listing** dans l'application

3. **Vérifiez si la valeur a changé dans la DB** :
   ```sql
   SELECT id, email, analysis_used_this_month 
   FROM users 
   WHERE email = 'votre-email@example.com';
   ```
   La valeur devrait être `10.5` (si elle était `10.0` avant)

### 2. Diagnostic

**Si la valeur dans la DB n'a PAS changé** :
- ❌ Le problème est dans l'API `/api/generate-etsy-description`
- L'API ne déduit pas les crédits correctement
- Vérifiez les logs du serveur pour voir si `incrementAnalysisCount` est appelé

**Si la valeur dans la DB a changé MAIS l'UI ne se met pas à jour** :
- ✅ L'API fonctionne correctement
- ❌ Le problème est dans le rafraîchissement de l'UI
- Vérifiez les logs de la console du navigateur

### 3. Test manuel pour vérifier l'affichage

1. **Mettez une valeur décimale directement dans la DB** :
   ```sql
   UPDATE users
   SET analysis_used_this_month = 10.5
   WHERE email = 'votre-email@example.com';
   ```

2. **Rafraîchissez la page** dans l'application

3. **Vérifiez si l'UI affiche `10.5`** :
   - Si OUI → Le problème est que l'API ne déduit pas les crédits
   - Si NON → Le problème est que l'UI ne lit pas correctement les valeurs décimales

## 📊 Logs à vérifier

### Dans la console du navigateur (F12) :
- `[LISTING GENERATION]` : Logs de la génération
- `[useSubscription]` : Logs du hook de subscription
- `[DashboardListing]` : Logs du composant

### Dans les logs du serveur :
- `[DESCRIPTION GENERATION]` : Logs de l'API
- `[incrementAnalysisCount]` : Logs de la déduction de crédits

## 🎯 Solution selon le diagnostic

1. **Si l'API ne déduit pas** → Vérifier `src/app/api/generate-etsy-description/route.ts`
2. **Si l'UI ne se met pas à jour** → Vérifier `src/hooks/useSubscription.ts` et `src/components/dashboard/DashboardListing.tsx`

















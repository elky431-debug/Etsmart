# 🔄 Instructions pour voir les crédits mis à jour dans le SAAS

## ✅ Étape 1 : Vérifier que les crédits sont bien à 0 dans Supabase

Exécute cette requête dans **Supabase SQL Editor** :

```sql
SELECT 
  email,
  subscription_plan,
  analysis_quota,
  analysis_used_this_month,
  (analysis_quota - COALESCE(analysis_used_this_month, 0)) as remaining
FROM users
WHERE email = 'elky431@gmail.com';
```

Tu devrais voir `analysis_used_this_month = 0`.

## 🔄 Étape 2 : Forcer le rafraîchissement dans le navigateur

Le frontend met en cache les données pendant 2 minutes. Pour voir les crédits mis à jour immédiatement :

### Option A : Rafraîchir la page (simple)
1. Va sur le dashboard
2. Appuie sur **F5** (ou **Cmd+R** sur Mac)
3. Les crédits devraient maintenant s'afficher correctement

### Option B : Vider le cache (si F5 ne suffit pas)
1. Appuie sur **Ctrl+Shift+R** (ou **Cmd+Shift+R** sur Mac)
2. Cela force un rechargement complet sans cache

### Option C : Ouvrir la console et forcer le refresh
1. Ouvre la console du navigateur (F12)
2. Tape cette commande :
```javascript
window.dispatchEvent(new CustomEvent('subscription-refresh'));
```
3. Puis appuie sur **F5**

## 🔍 Vérification

Après le rafraîchissement, tu devrais voir :
- **Crédits utilisés** : 0
- **Crédits restants** : Le quota complet selon le plan

## ⚠️ Si ça ne marche toujours pas

1. **Vérifie dans Supabase** que `analysis_used_this_month = 0` pour cet email
2. **Déconnecte-toi puis reconnecte-toi** dans le SAAS
3. **Vide complètement le cache** du navigateur :
   - Chrome/Edge : Paramètres → Confidentialité → Effacer les données de navigation → Cocher "Images et fichiers en cache"
   - Firefox : Paramètres → Vie privée → Effacer les données → Cocher "Cache"

## 📝 Note technique

Le hook `useSubscription` met en cache les données pendant 2 minutes pour éviter trop de requêtes. C'est pourquoi il faut rafraîchir la page pour voir les changements immédiats.


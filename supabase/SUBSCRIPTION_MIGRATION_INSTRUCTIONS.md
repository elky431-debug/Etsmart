# Migration: Add Subscription Columns to Users Table

## Problème
L'erreur "No subscription found. Please subscribe to access this feature." apparaît car les colonnes d'abonnement sont manquantes dans la table `users` de Supabase.

## Solution
Exécuter la migration SQL pour ajouter les colonnes d'abonnement nécessaires.

## Instructions

1. **Ouvrir Supabase Dashboard**
   - Aller sur https://supabase.com/dashboard
   - Sélectionner votre projet Etsmart

2. **Ouvrir l'éditeur SQL**
   - Dans le menu de gauche, cliquer sur "SQL Editor"
   - Cliquer sur "New query"

3. **Exécuter la migration**
   - Copier le contenu du fichier `supabase/add_subscription_columns.sql`
   - Coller dans l'éditeur SQL
   - Cliquer sur "Run" (ou appuyer sur Cmd/Ctrl + Enter)

4. **Vérifier**
   - La migration devrait s'exécuter sans erreur
   - Les colonnes d'abonnement sont maintenant disponibles dans la table `users`

## Contenu de la migration

```sql
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS subscriptionPlan TEXT DEFAULT 'FREE' CHECK (subscriptionPlan IN ('FREE', 'SMART', 'PRO', 'SCALE')),
ADD COLUMN IF NOT EXISTS subscriptionStatus TEXT DEFAULT 'inactive' CHECK (subscriptionStatus IN ('active', 'inactive', 'canceled', 'past_due')),
ADD COLUMN IF NOT EXISTS stripeCustomerId TEXT,
ADD COLUMN IF NOT EXISTS stripeSubscriptionId TEXT,
ADD COLUMN IF NOT EXISTS analysisQuota INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS analysisUsedThisMonth INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS currentPeriodStart TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS currentPeriodEnd TIMESTAMP WITH TIME ZONE;
```

## Après la migration

Une fois la migration exécutée :
- Les utilisateurs existants auront `subscriptionPlan = 'FREE'` et `subscriptionStatus = 'inactive'` par défaut
- Les nouveaux abonnements via Stripe pourront être correctement sauvegardés
- Le système de paywall pourra vérifier les abonnements correctement
- L'erreur "No subscription found" disparaîtra pour les utilisateurs avec un abonnement actif

## Note importante

⚠️ **Les utilisateurs existants n'auront pas d'abonnement actif par défaut**. Ils devront :
1. Soit souscrire à un abonnement via l'interface
2. Soit avoir leur abonnement mis à jour manuellement dans la base de données si nécessaire


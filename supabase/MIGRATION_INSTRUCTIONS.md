# Migration: Add Strengths and Risks Columns

## Problème
Les colonnes `strengths` et `risks` sont manquantes dans la table `product_analyses` de Supabase, ce qui empêche la sauvegarde des données d'analyse.

## Solution
Exécuter la migration SQL pour ajouter ces colonnes.

## Instructions

1. **Ouvrir Supabase Dashboard**
   - Aller sur https://supabase.com/dashboard
   - Sélectionner votre projet Etsmart

2. **Ouvrir l'éditeur SQL**
   - Dans le menu de gauche, cliquer sur "SQL Editor"
   - Cliquer sur "New query"

3. **Exécuter la migration**
   - Copier le contenu du fichier `supabase/add_strengths_risks_columns.sql`
   - Coller dans l'éditeur SQL
   - Cliquer sur "Run" (ou appuyer sur Cmd/Ctrl + Enter)

4. **Vérifier**
   - La migration devrait s'exécuter sans erreur
   - Les colonnes `strengths` et `risks` sont maintenant disponibles dans la table `product_analyses`

## Contenu de la migration

```sql
-- Add strengths column (array of strings)
ALTER TABLE public.product_analyses
ADD COLUMN IF NOT EXISTS strengths TEXT[] DEFAULT '{}';

-- Add risks column (array of strings)
ALTER TABLE public.product_analyses
ADD COLUMN IF NOT EXISTS risks TEXT[] DEFAULT '{}';
```

## Après la migration

Une fois la migration exécutée :
- Les nouvelles analyses pourront sauvegarder les `strengths` et `risks`
- Les sections "Strengths" et "Risks" s'afficheront correctement dans l'interface
- L'erreur "Could not find the 'risks' column" disparaîtra


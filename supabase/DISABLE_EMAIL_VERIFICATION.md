# Désactiver la vérification d'email dans Supabase

## Instructions

Pour désactiver complètement la vérification d'email lors de l'inscription, vous devez modifier la configuration dans le dashboard Supabase :

### Étapes

1. **Ouvrir Supabase Dashboard**
   - Aller sur https://supabase.com/dashboard
   - Sélectionner votre projet Etsmart

2. **Aller dans Authentication Settings**
   - Dans le menu de gauche, cliquer sur "Authentication"
   - Cliquer sur "Settings" (ou "Configuration")

3. **Désactiver la vérification d'email**
   - Trouver la section "Email Auth" ou "Email Authentication"
   - Désactiver l'option "Enable email confirmations" ou "Require email confirmation"
   - Sauvegarder les changements

### Alternative : Via SQL

Vous pouvez aussi désactiver la vérification d'email via SQL dans l'éditeur SQL :

```sql
-- Désactiver la vérification d'email pour tous les nouveaux utilisateurs
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Note: Cette commande confirme tous les emails non confirmés
-- Pour désactiver complètement, utilisez le dashboard Supabase
```

### Configuration recommandée

- **Enable email confirmations**: `OFF` (désactivé)
- **Secure email change**: `OFF` (optionnel, pour permettre le changement d'email sans vérification)
- **Enable sign ups**: `ON` (activé)

### Après la configuration

Une fois la vérification d'email désactivée :
- Les nouveaux utilisateurs seront automatiquement connectés après l'inscription
- Aucun email de confirmation ne sera envoyé
- Les utilisateurs pourront utiliser l'application immédiatement

## Note importante

⚠️ **Sécurité** : Désactiver la vérification d'email réduit la sécurité de votre application. Assurez-vous que c'est ce que vous voulez pour votre cas d'usage.


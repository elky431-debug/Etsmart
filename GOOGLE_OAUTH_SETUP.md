# Configuration Google OAuth pour Etsmart

## Erreur actuelle
Si vous voyez l'erreur : `"Unsupported provider: provider is not enabled"`, cela signifie que Google OAuth n'est pas encore activé dans votre projet Supabase.

## Étapes pour activer Google OAuth

### Étape 1 : Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Donnez un nom à votre projet (ex: "Etsmart OAuth")

### Étape 2 : Configurer l'écran de consentement OAuth

1. Dans Google Cloud Console, allez dans **APIs & Services > OAuth consent screen**
2. Choisissez **External** (ou Internal si vous avez un compte Google Workspace)
3. Remplissez les informations :
   - **App name** : Etsmart
   - **User support email** : votre email
   - **Developer contact information** : votre email
4. Cliquez sur **Save and Continue**
5. Sur la page **Scopes**, cliquez sur **Save and Continue** (pas besoin d'ajouter de scopes)
6. Sur la page **Test users**, vous pouvez ajouter des emails de test (optionnel)
7. Cliquez sur **Save and Continue**

### Étape 3 : Créer les identifiants OAuth

1. Dans Google Cloud Console, allez dans **APIs & Services > Credentials**
2. Cliquez sur **Create Credentials > OAuth client ID**
3. Choisissez **Web application** comme type d'application
4. Donnez un nom (ex: "Etsmart Supabase")
5. **IMPORTANT** : Dans **Authorized redirect URIs**, ajoutez :
   ```
   https://[VOTRE-PROJECT-REF].supabase.co/auth/v1/callback
   ```
   Remplacez `[VOTRE-PROJECT-REF]` par votre référence de projet Supabase.
   
   Pour trouver votre référence :
   - Allez dans Supabase > Settings > API
   - Votre Project URL ressemble à : `https://xxxxx.supabase.co`
   - La partie `xxxxx` est votre référence de projet
   
   Exemple : Si votre URL est `https://drjfsqsxxpsjzmabafas.supabase.co`, alors ajoutez :
   ```
   https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback
   ```
6. Cliquez sur **Create**
7. **Copiez le Client ID et le Client Secret** (vous en aurez besoin)

### Étape 4 : Activer Google dans Supabase

1. Allez dans votre projet Supabase
2. Allez dans **Authentication > Providers**
3. Trouvez **Google** dans la liste
4. Cliquez sur le toggle pour **activer** Google
5. Collez le **Client ID** (copié depuis Google Cloud Console)
6. Collez le **Client Secret** (copié depuis Google Cloud Console)
7. Cliquez sur **Save**

### Étape 5 : Configurer les URLs de redirection (optionnel mais recommandé)

1. Dans Supabase, allez dans **Authentication > URL Configuration**
2. Dans **Redirect URLs**, ajoutez :
   - `http://localhost:3000/auth/callback` (pour le développement)
   - `https://votre-domaine.com/auth/callback` (pour la production, si vous avez un domaine)

## Vérification

Une fois configuré :
1. Rechargez votre application
2. Cliquez sur "Continuer avec Google"
3. Vous devriez être redirigé vers la page de connexion Google
4. Après connexion, vous serez redirigé vers le dashboard

## Dépannage

### Erreur "redirect_uri_mismatch"
- Vérifiez que l'URL de redirection dans Google Cloud Console correspond exactement à celle de Supabase
- L'URL doit être : `https://[VOTRE-PROJECT-REF].supabase.co/auth/v1/callback`

### Erreur "provider is not enabled"
- Vérifiez que Google est bien activé dans Supabase > Authentication > Providers
- Vérifiez que le Client ID et Client Secret sont correctement collés

### L'authentification fonctionne mais la redirection échoue
- Vérifiez que l'URL `/auth/callback` est bien configurée dans votre application
- Vérifiez les logs de la console du navigateur pour voir les erreurs

## Notes importantes

- Le Client Secret est sensible, ne le partagez jamais publiquement
- Pour la production, vous devrez peut-être soumettre votre application pour vérification Google
- En mode test, seuls les utilisateurs ajoutés dans "Test users" pourront se connecter


















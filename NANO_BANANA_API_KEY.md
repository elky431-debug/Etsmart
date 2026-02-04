# Comment obtenir la clé API Nano Banana

## Étapes pour obtenir votre clé API

### 1. Créer un compte Nano Banana

1. Allez sur le site officiel de Nano Banana : **https://nanobanana.com** (ou le site officiel)
2. Cliquez sur **"Sign Up"** ou **"Créer un compte"**
3. Remplissez le formulaire d'inscription avec :
   - Votre email
   - Un mot de passe sécurisé
   - Vos informations de base

### 2. Accéder à votre tableau de bord

1. Connectez-vous à votre compte
2. Naviguez vers la section **"API"** ou **"Developers"** dans votre tableau de bord
3. Cherchez la section **"API Keys"** ou **"Clés API"**

### 3. Générer une nouvelle clé API

1. Cliquez sur **"Create API Key"** ou **"Générer une clé"**
2. Donnez un nom à votre clé (ex: "Etsmart Production")
3. Copiez la clé API générée **immédiatement** (elle ne sera affichée qu'une seule fois)

### 4. Configurer dans Etsmart

1. Ouvrez votre fichier `.env.local` à la racine du projet
2. Ajoutez la ligne suivante :

```env
NANO_BANANA_API_KEY=votre_cle_api_ici
NANO_BANANA_API_URL=https://api.nanobanana.com/v1/generate
```

3. Remplacez `votre_cle_api_ici` par la clé que vous avez copiée
4. Sauvegardez le fichier
5. **Redémarrez votre serveur de développement** pour que les changements prennent effet

### 5. Vérifier que ça fonctionne

1. Lancez votre serveur : `npm run dev`
2. Allez sur http://localhost:3003
3. Lancez une analyse de produit
4. Accédez à l'onglet **"Images générées"**
5. Uploadez une image et cliquez sur **"GENERATE X IMAGES"**

Si tout fonctionne, vous verrez les images générées. Sinon, vérifiez :
- Que la clé API est correctement copiée (sans espaces)
- Que le serveur a été redémarré après l'ajout de la variable
- Les logs dans la console du serveur pour voir les erreurs éventuelles

## Notes importantes

- ⚠️ **Ne partagez jamais votre clé API** publiquement
- ⚠️ **Ne commitez pas** votre fichier `.env.local` dans Git (il est déjà dans `.gitignore`)
- 💰 Vérifiez les **tarifs et crédits** sur votre compte Nano Banana
- 🔒 Si votre clé est compromise, **révoquez-la immédiatement** et générez-en une nouvelle

## Support

Si vous avez des problèmes :
1. Vérifiez la documentation officielle de Nano Banana
2. Contactez le support Nano Banana
3. Vérifiez les logs dans la console du serveur (`npm run dev`)




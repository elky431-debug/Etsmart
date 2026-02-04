# Comment trouver l'API Nanonbanana

## 📚 Documentation officielle

### 1. Site principal
- **URL** : https://nanobananaapi.ai
- **Dashboard** : https://nanobananaapi.ai/dashboard
- **Gestion des clés API** : https://nanobananaapi.ai/api-key

### 2. Documentation API
- **URL** : https://docs.nanobananaapi.ai
- **Page principale** : https://docs.nanobananaapi.ai/index
- **Quickstart** : https://docs.nanobananaapi.ai/quickstart

### 3. Endpoints principaux

#### Génération/Édition d'image
- **Endpoint** : `POST /api/v1/nanobanana/generate`
- **Base URL** : `https://api.nanobananaapi.ai`
- **Documentation** : https://docs.nanobananaapi.ai/nanobanana-api/generate-or-edit-image

#### Détails d'une tâche
- **Endpoint** : `GET /api/v1/nanobanana/record-info`
- **Documentation** : https://docs.nanobananaapi.ai/nanobanana-api/get-task-details

#### Crédits du compte
- **Endpoint** : `GET /api/v1/common/credit`
- **Documentation** : https://docs.nanobananaapi.ai/common-api/get-account-credits

## 🔑 Authentification

### Format de l'en-tête
```
Authorization: Bearer YOUR_API_KEY
```

### Où obtenir la clé API
1. Va sur https://nanobananaapi.ai/api-key
2. Connecte-toi à ton compte
3. Génère ou copie ta clé API
4. Ajoute-la dans ton `.env.local` :
   ```env
   NANONBANANA_API_KEY=ta_cle_api_ici
   ```

## 📋 Format de requête pour Image-to-Image

### Paramètres obligatoires
```json
{
  "type": "IMAGETOIAMGE",  // ⚠️ EN MAJUSCULES (pas "image-to-image")
  "prompt": "votre prompt ici",
  "imageUrls": ["https://example.com/image.jpg"],  // Tableau d'URLs (pas base64 direct)
  "callBackUrl": "https://votre-site.com/callback",  // OBLIGATOIRE
  "image_size": "1:1",  // Format : 1:1, 16:9, 9:16, etc.
  "numImages": 1  // Nombre d'images (1-4)
}
```

### Types de `type` acceptés
- `"TEXTTOIAMGE"` : Génération texte vers image
- `"IMAGETOIAMGE"` : Édition d'image (image-to-image)

### Formats d'image acceptés
- URLs d'images publiques
- Data URLs (base64) : `data:image/jpeg;base64,{base64_string}`

## 📥 Format de réponse

### Réponse initiale (avec taskId)
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "task12345"
  }
}
```

### Réponse du callback (quand l'image est prête)
L'API Nanonbanana enverra un POST à ton `callBackUrl` avec les résultats.

## 🔍 Comment inspecter les requêtes dans le Playground

### Méthode 1 : Outils de développement du navigateur
1. Va sur https://nanobananaapi.ai/playground (ou le dashboard)
2. Ouvre les outils de développement (F12)
3. Va dans l'onglet **Network**
4. Lance une génération d'image
5. Clique sur la requête `generate` dans la liste
6. Regarde les onglets :
   - **Headers** : URL, méthode, en-têtes
   - **Payload** ou **Request** : Corps de la requête JSON
   - **Response** : Réponse de l'API

### Méthode 2 : Documentation interactive
1. Va sur https://docs.nanobananaapi.ai/nanobanana-api/generate-or-edit-image
2. La documentation contient des exemples de requêtes
3. Tu peux voir le schéma OpenAPI complet

## ⚠️ Points importants

1. **Type en majuscules** : `"IMAGETOIAMGE"` (pas `"image-to-image"`)
2. **CallBackUrl obligatoire** : L'API est asynchrone, elle envoie les résultats via callback
3. **imageUrls au lieu de image** : Utiliser un tableau d'URLs, pas un champ `image` avec base64
4. **Whitelist IP** : Assure-toi que ton IP est whitelistée sur nanobananaapi.ai
5. **Crédits** : Vérifie que tu as des crédits disponibles

## 🐛 Dépannage

### Erreur 403
- Vérifie que ta clé API est correcte
- Vérifie que ton IP est whitelistée
- Vérifie que tu as des crédits

### Erreur 422 "type can not be blank"
- Assure-toi d'envoyer le paramètre `type`
- Utilise `"IMAGETOIAMGE"` en majuscules (pas `"image-to-image"`)

### Erreur 422 "Incorrect type"
- Utilise exactement `"IMAGETOIAMGE"` ou `"TEXTTOIAMGE"` (en majuscules)

### Erreur 413 "Request Entity Too Large"
- Compresse l'image avant de l'envoyer
- Réduis la résolution de l'image
- Utilise `imageUrls` avec une URL au lieu de base64 si possible

## 📞 Support

- **Email** : support@nanobananaapi.ai
- **Dashboard** : https://nanobananaapi.ai/dashboard
- **Documentation** : https://docs.nanobananaapi.ai



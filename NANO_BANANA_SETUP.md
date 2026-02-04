# Configuration Nano Banana

## ⚠️ Comment obtenir votre clé API

**Voir le fichier `NANO_BANANA_API_KEY.md` pour les instructions détaillées.**

En résumé :
1. Créez un compte sur https://nanobanana.com
2. Allez dans votre tableau de bord → Section "API" ou "Developers"
3. Générez une nouvelle clé API
4. Copiez-la et ajoutez-la dans votre `.env.local`

## Variables d'environnement requises

Ajoutez ces variables dans votre fichier `.env.local` :

```env
# Nano Banana API Configuration (modèle standard, pas Pro)
NANO_BANANA_API_KEY=your_api_key_here
NANO_BANANA_API_URL=https://api.nanobanana.com/v1/generate
```

## Format de l'API attendu

L'intégration actuelle attend que l'API Nano Banana accepte :

### Requête POST
```json
{
  "model": "nano-banana",
  "prompt": "string (prompt fixe + instructions personnalisées)",
  "image": "string (base64)",
  "width": 1024,
  "height": 1024,
  "num_images": 1,
  "art_direction": "auto",
  "quality": "high",
  "style": "lifestyle"
}
```

### Réponse attendue
```json
{
  "image_url": "https://...",
  // OU
  "images": [{"url": "https://..."}],
  // OU
  "url": "https://..."
}
```

## Adaptation si l'API est différente

Si l'API Nano Banana utilise un format différent, modifiez la section dans `src/app/api/generate-images/route.ts` :

1. **Format de requête** : Lignes 138-149
2. **Format de réponse** : Lignes 175-177
3. **URL de l'endpoint** : Ligne 107

## Fallback

Si `NANO_BANANA_API_KEY` n'est pas configurée, l'API utilisera un mode fallback avec des images placeholder pour le développement.

## Test

Pour tester l'intégration :

1. Configurez les variables d'environnement
2. Redémarrez le serveur de développement
3. Accédez à l'onglet "Images générées" sur localhost
4. Uploadez une image et générez

## Notes

- Timeout : 15 secondes par image (selon cahier des charges)
- Génération en parallèle pour la performance
- Gestion d'erreurs avec fallback sur placeholder


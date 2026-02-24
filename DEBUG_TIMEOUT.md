# 🔍 Guide de Debug - Problème de Timeout

## Vérifications à faire

### 1. Vérifier les logs Netlify
```bash
# Via Netlify CLI
npx netlify logs

# Ou dans le Dashboard Netlify
# Site Settings → Functions → Logs
```

### 2. Vérifier les variables d'environnement
Dans Netlify Dashboard → Site Settings → Environment Variables :
- ✅ `OPENAI_API_KEY` est définie
- ✅ La clé commence par `sk-`
- ✅ La clé est valide (testez sur platform.openai.com)

### 3. Tester l'API directement
```bash
curl -X POST https://votre-app.netlify.app/api/ai-analyze \
  -H "Content-Type: application/json" \
  -d '{
    "productPrice": 10,
    "niche": "jewelry",
    "productImageUrl": "https://via.placeholder.com/600x600"
  }'
```

### 4. Vérifier le timeout Netlify
- Plan Free : 10s max
- Plan Pro : 50s max (mais peut être moins selon la région)
- Vérifiez dans Netlify Dashboard → Site Settings → Functions

### 5. Vérifier les crédits OpenAI
- Allez sur platform.openai.com
- Vérifiez que vous avez des crédits
- Vérifiez que GPT-4o-mini est disponible sur votre compte

## Solutions possibles

### Solution 1: Réduire encore le timeout
Si Netlify timeout est < 25s, réduire à 20s dans le code.

### Solution 2: Utiliser Background Functions
Pour les opérations longues, utiliser Background Functions (jusqu'à 15 min).

### Solution 3: Vérifier la taille de l'image
Les images très grandes peuvent ralentir l'API. Compresser avant envoi.

### Solution 4: Vérifier la connexion réseau
Si vous êtes dans une région avec latence élevée vers OpenAI, cela peut expliquer les timeouts.

## Logs à vérifier

Cherchez dans les logs Netlify :
- `📤 Calling OpenAI API` - Confirme que l'API est appelée
- `✅ GPT-4o-mini responded` - Confirme que l'API répond
- `⏱️ TIMEOUT` - Indique un timeout
- `❌ Fetch error` - Indique une erreur réseau























































# Comment trouver les logs pour débugger la génération d'images

## 1. Logs du serveur Next.js (Terminal)

Les logs du serveur s'affichent dans le **terminal où tu as lancé `npm run dev`**.

### Où les trouver :
1. **Ouvre le terminal** où tourne le serveur
2. **Regarde les messages** qui s'affichent quand tu génères une image
3. **Cherche les lignes qui commencent par** `[IMAGE GENERATION]`

### Exemple de ce que tu devrais voir :
```
[IMAGE GENERATION] Replicate API token configured: r8_HNP...
[IMAGE GENERATION] Starting generation with Stable Diffusion via Replicate
[IMAGE GENERATION] Final prompt: Professional lifestyle product...
[IMAGE GENERATION] Generating image 1/5...
[IMAGE GENERATION] Prediction created: abc123 Status: starting
[IMAGE GENERATION] Prediction abc123 status: processing (attempt 1/60)
[IMAGE GENERATION] Prediction abc123 status: succeeded (attempt 5/60)
[IMAGE GENERATION] Image 1 generated successfully
```

### Si tu vois des erreurs :
- `[IMAGE GENERATION] Error generating image 1: ...` → Copie cette ligne complète
- `Replicate API error: ...` → Copie le message d'erreur
- `Failed to check prediction status: ...` → Copie l'erreur

## 2. Logs du navigateur (Console)

### Où les trouver :
1. **Ouvre les DevTools** du navigateur (F12 ou Cmd+Option+I sur Mac)
2. **Va dans l'onglet "Console"**
3. **Regarde les erreurs en rouge**

### Exemple de ce que tu devrais voir :
- Erreurs en rouge qui commencent par `Failed to load resource`
- Messages `[IMAGE GENERATION] API Error: ...`
- Erreurs de réseau

## 3. Logs de l'API route (Fichier)

Les logs sont aussi écrits dans la console du serveur, mais tu peux aussi vérifier :

### Vérifier que le token est bien chargé :
```bash
# Dans le terminal, vérifie que le token est dans .env.local
cat .env.local | grep REPLICATE
```

## 4. Test rapide de l'API

Pour tester si l'API fonctionne, tu peux faire :

```bash
# Dans un nouveau terminal
curl -X POST http://localhost:3003/api/generate-images \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TON_TOKEN_SUPABASE" \
  -d '{
    "sourceImage": "data:image/png;base64,iVBORw0KGgoAAAANS...",
    "quantity": 1,
    "aspectRatio": "1:1",
    "artDirection": "auto"
  }'
```

## 5. Vérifications à faire

1. ✅ Le serveur tourne-t-il ? (regarde le terminal)
2. ✅ Le token Replicate est-il dans `.env.local` ?
3. ✅ Le serveur a-t-il été redémarré après l'ajout du token ?
4. ✅ Y a-t-il des erreurs dans la console du navigateur ?
5. ✅ Y a-t-il des erreurs dans les logs du serveur ?

## 6. Ce qu'il faut me copier si ça ne marche pas

Si ça ne fonctionne toujours pas, copie-moi :
1. **Les dernières lignes du terminal** (où tourne `npm run dev`)
2. **Les erreurs de la console du navigateur** (F12 → Console)
3. **Le message d'erreur exact** qui s'affiche dans l'interface




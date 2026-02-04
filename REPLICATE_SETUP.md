# Configuration Replicate API pour la génération d'images

## Étape 1 : Créer un compte Replicate

1. Aller sur https://replicate.com
2. Cliquer sur "Sign up" et créer un compte (gratuit)
3. Vérifier ton email si nécessaire

## Étape 2 : Obtenir la clé API

1. Une fois connecté, aller sur : **https://replicate.com/account/api-tokens**
   - Ou cliquer sur ton nom en haut à droite → "Account" → "API tokens"

2. Tu verras une section "API tokens"
   - Si tu n'as pas encore de token, clique sur "Create token"
   - Donne-lui un nom (ex: "Etsmart Image Generation")
   - Clique sur "Create"

3. **IMPORTANT** : Copie le token immédiatement (il commence par `r8_`)
   - ⚠️ Tu ne pourras plus le voir après ! Si tu le perds, il faudra en créer un nouveau

## Étape 3 : Ajouter le token dans ton projet

1. Ouvre le fichier `.env.local` à la racine du projet
2. Ajoute cette ligne :
   ```
   REPLICATE_API_TOKEN=r8_ton_token_ici
   ```
3. Remplace `r8_ton_token_ici` par le token que tu as copié

## Étape 4 : Redémarrer le serveur

```bash
# Arrête le serveur (Ctrl+C)
# Puis relance-le
npm run dev
```

## Coût

- **Gratuit** : Replicate offre des crédits gratuits pour commencer
- **Payant** : ~$0.002-0.005 par image générée (très économique)
- Tu peux voir ton usage et ajouter des crédits sur : https://replicate.com/account/billing

## Test

Une fois configuré, tu peux tester la génération d'images dans Etsmart. Si ça ne fonctionne pas, vérifie :
- Que le token est bien dans `.env.local`
- Que le serveur a été redémarré
- Les logs du serveur pour voir les erreurs éventuelles




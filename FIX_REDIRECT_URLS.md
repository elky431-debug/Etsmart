# 🔧 Résolution du problème des Redirect URLs

## ⚠️ Problème

Supabase affiche "Please provide a valid URL" pour les URLs de redirection, même si elles semblent correctes.

## ✅ Solutions

### Solution 1 : Format des URLs

Supabase peut être strict sur le format. Essayez ces variantes :

**Pour la production :**
```
https://etsmart.app/auth/callback
```

**Pour le développement local :**
```
http://localhost:3000/auth/callback
```

### Solution 2 : Vérifier le format exact

Assurez-vous que :
- ✅ Pas d'espaces avant/après
- ✅ Pas de `/` à la fin
- ✅ `http://` pour localhost (pas `https://`)
- ✅ `https://` pour la production

### Solution 3 : Ajouter les URLs une par une

Au lieu d'ajouter les deux URLs en même temps :

1. **Ajoutez d'abord** : `https://etsmart.app/auth/callback`
   - Cliquez sur "+ Add URL"
   - Cliquez sur "Save URLs"

2. **Puis ajoutez** : `http://localhost:3000/auth/callback`
   - Cliquez sur "+ Add URL"
   - Cliquez sur "Save URLs"

### Solution 4 : Vérifier dans l'interface

Parfois, les URLs peuvent déjà exister. Vérifiez :

1. **Fermez le modal** "Add new redirect URLs"
2. **Regardez la liste** des Redirect URLs existantes
3. **Si les URLs sont déjà là**, vous n'avez pas besoin de les ajouter

### Solution 5 : Format alternatif (si ça ne marche toujours pas)

Essayez avec un chemin absolu complet :

**Pour la production :**
```
https://etsmart.app/auth/callback
```

**Pour le développement :**
```
http://127.0.0.1:3000/auth/callback
```

## 🔍 Vérification

Après avoir ajouté les URLs :

1. **Fermez le modal**
2. **Vérifiez la liste** des Redirect URLs
3. **Vous devriez voir** :
   - `https://etsmart.app/auth/callback`
   - `http://localhost:3000/auth/callback`

## ⚠️ Note importante

Les Redirect URLs dans Supabase sont différentes du Callback URL pour Google OAuth :

- **Redirect URLs (Supabase)** : URLs où Supabase redirige après authentification
  - `https://etsmart.app/auth/callback`
  - `http://localhost:3000/auth/callback`

- **Callback URL (Google OAuth)** : URL où Google redirige vers Supabase
  - `https://drjfsqsxxpsjzmabafas.supabase.co/auth/v1/callback`

Les deux doivent être configurés correctement !

## 🧪 Test après configuration

Une fois les URLs ajoutées :

1. **Testez en local** :
   ```bash
   npm run dev
   ```
   - Allez sur `http://localhost:3000/login`
   - Cliquez sur "Continuer avec Google"

2. **Testez en production** :
   - Allez sur `https://etsmart.app/login`
   - Cliquez sur "Continuer avec Google"

---

**💡 Astuce** : Si le problème persiste, essayez de rafraîchir la page Supabase ou de vous déconnecter/reconnecter.


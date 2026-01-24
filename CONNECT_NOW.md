# 🚀 Connecter votre projet à GitHub - MAINTENANT

## Après avoir cliqué sur "Create repository" sur GitHub :

### Option 1 : Utiliser le script automatique (RECOMMANDÉ)

Remplacez `VOTRE_USERNAME` par votre nom d'utilisateur GitHub :

```bash
./connect-github.sh VOTRE_USERNAME Etsmart
```

**Exemple** (si votre username est `yacineelfahim`) :
```bash
./connect-github.sh yacineelfahim Etsmart
```

### Option 2 : Commandes manuelles

Si vous préférez faire manuellement :

```bash
# Remplacez VOTRE_USERNAME par votre nom d'utilisateur GitHub
git remote add origin https://github.com/VOTRE_USERNAME/Etsmart.git
git branch -M main
git push -u origin main
```

## Vérification

Après avoir exécuté les commandes, vérifiez que tout fonctionne :

```bash
git remote -v
```

Vous devriez voir :
```
origin  https://github.com/VOTRE_USERNAME/Etsmart.git (fetch)
origin  https://github.com/VOTRE_USERNAME/Etsmart.git (push)
```

## ✅ C'est fait !

Votre code sera maintenant sur GitHub. Vous pouvez le voir sur :
`https://github.com/VOTRE_USERNAME/Etsmart`


















# Guide de connexion à GitHub

## Étape 1 : Préparer le projet local

Tous les fichiers sont prêts. Vous devez maintenant :

1. **Ajouter tous les fichiers au staging**
   ```bash
   git add .
   ```

2. **Faire un commit initial**
   ```bash
   git commit -m "Initial commit: Etsmart - Copilote IA pour Etsy"
   ```

## Étape 2 : Créer un dépôt sur GitHub

1. Allez sur [github.com](https://github.com) et connectez-vous
2. Cliquez sur le bouton **"+"** en haut à droite → **"New repository"**
3. Remplissez les informations :
   - **Repository name** : `etsmart` (ou le nom que vous préférez)
   - **Description** : "Copilote IA pour analyser et lancer des produits rentables sur Etsy"
   - **Visibilité** : Choisissez Public ou Private
   - **NE COCHEZ PAS** "Initialize this repository with a README" (vous avez déjà un README)
4. Cliquez sur **"Create repository"**

## Étape 3 : Connecter le projet local à GitHub

Après avoir créé le dépôt, GitHub vous donnera des instructions. Utilisez celles-ci :

```bash
# Remplacez YOUR_USERNAME par votre nom d'utilisateur GitHub
git remote add origin https://github.com/YOUR_USERNAME/etsmart.git
git branch -M main
git push -u origin main
```

**OU** si vous préférez utiliser SSH :

```bash
git remote add origin git@github.com:YOUR_USERNAME/etsmart.git
git branch -M main
git push -u origin main
```

## Étape 4 : Vérifier la connexion

```bash
git remote -v
```

Vous devriez voir :
```
origin  https://github.com/YOUR_USERNAME/etsmart.git (fetch)
origin  https://github.com/YOUR_USERNAME/etsmart.git (push)
```

## Commandes utiles pour la suite

```bash
# Voir l'état des fichiers
git status

# Ajouter des fichiers modifiés
git add .

# Faire un commit
git commit -m "Description de vos changements"

# Pousser vers GitHub
git push

# Récupérer les changements depuis GitHub
git pull
```

## ⚠️ Important

- **Ne commitez JAMAIS** le fichier `.env.local` (il contient vos clés secrètes)
- Le fichier `.gitignore` est déjà configuré pour exclure les fichiers sensibles
- Vérifiez toujours avec `git status` avant de faire un commit


#!/bin/bash

# Script pour connecter le projet à GitHub
# Usage: ./connect-github.sh YOUR_USERNAME REPO_NAME

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Usage: ./connect-github.sh YOUR_USERNAME REPO_NAME"
  echo "   Exemple: ./connect-github.sh yacineelfahim etsmart"
  exit 1
fi

USERNAME=$1
REPO_NAME=$2

echo "🔗 Connexion à GitHub..."
echo "   Repository: https://github.com/$USERNAME/$REPO_NAME"
echo ""

# Vérifier si le remote existe déjà
if git remote get-url origin &> /dev/null; then
  echo "⚠️  Un remote 'origin' existe déjà."
  read -p "Voulez-vous le remplacer? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git remote remove origin
  else
    echo "❌ Annulé."
    exit 1
  fi
fi

# Ajouter le remote
echo "📡 Ajout du remote GitHub..."
git remote add origin https://github.com/$USERNAME/$REPO_NAME.git

# Vérifier la connexion
echo "✅ Remote ajouté!"
echo ""
echo "📋 Vérification..."
git remote -v
echo ""

# Demander si on veut pousser maintenant
read -p "Voulez-vous pousser le code maintenant? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🚀 Push vers GitHub..."
  git push -u origin main
  echo ""
  echo "✅ Projet connecté et poussé vers GitHub!"
  echo "   Voir: https://github.com/$USERNAME/$REPO_NAME"
else
  echo "ℹ️  Pour pousser plus tard, utilisez:"
  echo "   git push -u origin main"
fi




























































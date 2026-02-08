#!/bin/bash

echo "🚀 Déploiement forcé sur Netlify..."

# Vérifier s'il y a des changements
if [ -z "$(git status --porcelain)" ]; then
    echo "⚠️  Aucun changement détecté. Création d'un commit vide pour forcer le build..."
    git commit --allow-empty -m "chore: Force Netlify build"
else
    echo "📦 Ajout des fichiers modifiés..."
    git add -A
    
    echo "💾 Commit des modifications..."
    git commit -m "fix: Amélioration système notation, listing et progression"
fi

echo "📤 Push vers GitHub..."
git push origin main

echo "✅ Push terminé! Le build Netlify devrait se déclencher automatiquement."
echo "📊 Vérifiez le dashboard Netlify: https://app.netlify.com"


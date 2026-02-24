#!/bin/bash

# Script de déploiement Netlify
# Usage: ./deploy.sh [--prod]

echo "🚀 Déploiement sur Netlify..."

# Vérifier si Netlify CLI est installé
if ! command -v netlify &> /dev/null; then
    echo "📦 Installation de Netlify CLI..."
    npm install -g netlify-cli || {
        echo "⚠️  Installation globale échouée, utilisation de npx..."
        USE_NPX=true
    }
fi

# Build du projet
echo "🔨 Build du projet..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build"
    exit 1
fi

# Déploiement
if [ "$USE_NPX" = true ]; then
    echo "📤 Déploiement avec npx..."
    if [ "$1" = "--prod" ]; then
        npx netlify deploy --prod
    else
        npx netlify deploy
    fi
else
    echo "📤 Déploiement avec Netlify CLI..."
    if [ "$1" = "--prod" ]; then
        netlify deploy --prod
    else
        netlify deploy
    fi
fi

echo "✅ Déploiement terminé!"























































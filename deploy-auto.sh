#!/bin/bash

# Script de déploiement automatique Netlify
# Ce script force un commit et un push pour déclencher le build Netlify

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement automatique Netlify..."
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis la racine du projet"
    exit 1
fi

# Vérifier que git est initialisé
if [ ! -d ".git" ]; then
    echo "❌ Erreur: Git n'est pas initialisé"
    exit 1
fi

# Vérifier la branche actuelle
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Branche actuelle: $CURRENT_BRANCH"

# S'assurer qu'on est sur main
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Vous n'êtes pas sur la branche main. Basculement vers main..."
    git checkout main
fi

# Récupérer les dernières modifications
echo "📥 Récupération des dernières modifications..."
git fetch origin main

# Vérifier s'il y a des changements locaux
if [ -z "$(git status --porcelain)" ]; then
    echo "⚠️  Aucun changement local détecté."
    echo "📝 Création d'un commit vide pour forcer le build Netlify..."
    git commit --allow-empty -m "chore: Force Netlify deployment - $(date +%Y-%m-%d\ %H:%M:%S)"
else
    echo "📦 Ajout des fichiers modifiés..."
    git add -A
    
    echo "💾 Commit des modifications..."
    git commit -m "fix: Amélioration système notation, listing et progression - $(date +%Y-%m-%d\ %H:%M:%S)"
fi

# Push vers GitHub (cela déclenchera automatiquement le build Netlify)
echo "📤 Push vers GitHub (déclenchera le build Netlify automatiquement)..."
git push origin main

echo ""
echo "✅ Push terminé avec succès!"
echo ""
echo "📊 Le build Netlify devrait se déclencher automatiquement dans quelques secondes."
echo "🔗 Vérifiez le statut sur: https://app.netlify.com"
echo ""
echo "💡 Si le build ne se déclenche pas automatiquement:"
echo "   1. Vérifiez dans Netlify Dashboard → Site settings → Build & deploy"
echo "   2. Assurez-vous que 'Continuous Deployment' est activé"
echo "   3. Vérifiez que la branche 'main' est configurée pour déclencher les builds"
echo "   4. Vérifiez que le webhook GitHub est bien configuré"


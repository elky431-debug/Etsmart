#!/bin/bash

echo "🚀 Déploiement rapide..."

# Ajouter tous les fichiers
git add -A

# Commit
git commit -m "fix: Correction syntaxe netlify.toml pour déploiement automatique"

# Push
git push origin main

echo "✅ Déploiement déclenché!"


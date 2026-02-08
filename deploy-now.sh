#!/bin/bash

# Script de déploiement rapide pour Netlify
echo "🚀 Déploiement sur Netlify..."

# Ajouter tous les fichiers modifiés
echo "📦 Ajout des fichiers..."
git add -A

# Vérifier le statut
echo "📊 Statut Git:"
git status --short

# Commit
echo "💾 Commit des modifications..."
git commit -m "Fix: Amélioration système notation, listing et progression - Système de notation avec règles spéciales (bijoux <3, bébés >=7, seagrass=10, niches >=8) - Listing corrigé pour utiliser uniquement description visuelle - Progression forcée à 100% avant transition - Bouton nouvelle analyse corrigé"

# Push vers le dépôt
echo "📤 Push vers GitHub (déclenchera le déploiement Netlify)..."
git push

echo "✅ Déploiement déclenché! Vérifiez Netlify Dashboard pour suivre le build."


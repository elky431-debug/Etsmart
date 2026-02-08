#!/bin/bash

echo "🚀 Déploiement automatique sur Netlify..."

# Ajouter tous les fichiers
git add -A

# Commit
git commit -m "feat: Ajout règles scoring - minimum 4 pour tous sauf bijoux/masques Halloween/sacs"

# Push
git push origin main

echo "✅ Déploiement déclenché! Le build Netlify devrait se lancer automatiquement."
echo "📊 Vérifiez: https://app.netlify.com"

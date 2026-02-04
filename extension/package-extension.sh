#!/bin/bash

# Script pour créer un package ZIP propre de l'extension pour Chrome Web Store

echo "📦 Création du package de l'extension..."

# Nom du package
PACKAGE_NAME="etsmart-extension-v1.0.1.zip"
TEMP_DIR="package-temp"

# Créer un dossier temporaire
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Copier uniquement les fichiers nécessaires
echo "📋 Copie des fichiers..."
cp manifest.json "$TEMP_DIR/"
cp background.js "$TEMP_DIR/"
cp content-script.js "$TEMP_DIR/"
cp popup.html "$TEMP_DIR/"
cp icon16.png "$TEMP_DIR/" 2>/dev/null || echo "⚠️  icon16.png non trouvé (optionnel)"

# Créer le ZIP
echo "🗜️  Création du ZIP..."
cd "$TEMP_DIR"
zip -r "../$PACKAGE_NAME" . -x "*.DS_Store" "*.git*"
cd ..

# Nettoyer
rm -rf "$TEMP_DIR"

echo "✅ Package créé : $PACKAGE_NAME"
echo "📤 Prêt pour la soumission sur Chrome Web Store !"


#!/bin/bash

# Script pour ajouter l'image d'exemple de screenshot
# Usage: ./scripts/add-example-image.sh [chemin-vers-image.png]

EXAMPLE_DIR="public/examples"
EXAMPLE_FILE="$EXAMPLE_DIR/screenshot-example.png"

# Créer le dossier s'il n'existe pas
mkdir -p "$EXAMPLE_DIR"

# Si un chemin d'image est fourni en argument
if [ -n "$1" ]; then
    if [ -f "$1" ]; then
        echo "📸 Copie de l'image depuis: $1"
        cp "$1" "$EXAMPLE_FILE"
        echo "✅ Image copiée avec succès vers: $EXAMPLE_FILE"
    else
        echo "❌ Erreur: Le fichier $1 n'existe pas"
        exit 1
    fi
else
    echo "📸 Veuillez fournir le chemin vers l'image:"
    echo "Usage: ./scripts/add-example-image.sh [chemin-vers-image.png]"
    echo ""
    echo "Ou copiez manuellement votre image vers: $EXAMPLE_FILE"
fi


















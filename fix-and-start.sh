#!/bin/bash
cd /Users/yacineelfahim/Etsmart

# Tuer tous les processus Next.js
echo "🛑 Arrêt des processus Next.js..."
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "node.*next" 2>/dev/null
sleep 2

# Supprimer le fichier de verrouillage
echo "🔓 Suppression du fichier de verrouillage..."
rm -f .next/dev/lock
rm -rf .next/cache 2>/dev/null

# Démarrer le serveur
echo "🚀 Démarrage du serveur sur le port 3009..."
npm run dev:3009


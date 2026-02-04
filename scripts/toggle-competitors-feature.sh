#!/bin/bash

# Script pour basculer entre la version "Coming Soon" et la version complète
# Usage: ./scripts/toggle-competitors-feature.sh [coming-soon|full]

MODE=${1:-coming-soon}

COMPETITORS_DIR="src/app/dashboard/competitors"
SHOP_ANALYZE_DIR="src/app/dashboard/shop/analyze"

if [ "$MODE" = "coming-soon" ]; then
  echo "🔄 Activation du mode 'Coming Soon'..."
  
  # Competitors page
  if [ -f "$COMPETITORS_DIR/page.tsx" ]; then
    mv "$COMPETITORS_DIR/page.tsx" "$COMPETITORS_DIR/page.tsx.backup"
    echo "✅ $COMPETITORS_DIR/page.tsx sauvegardé"
  fi
  
  if [ -f "$COMPETITORS_DIR/page-coming-soon.tsx" ]; then
    cp "$COMPETITORS_DIR/page-coming-soon.tsx" "$COMPETITORS_DIR/page.tsx"
    echo "✅ Version 'Coming Soon' activée pour competitors"
  fi
  
  # Shop analyze page
  if [ -f "$SHOP_ANALYZE_DIR/page.tsx" ]; then
    mv "$SHOP_ANALYZE_DIR/page.tsx" "$SHOP_ANALYZE_DIR/page.tsx.backup"
    echo "✅ $SHOP_ANALYZE_DIR/page.tsx sauvegardé"
  fi
  
  if [ -f "$SHOP_ANALYZE_DIR/page-coming-soon.tsx" ]; then
    cp "$SHOP_ANALYZE_DIR/page-coming-soon.tsx" "$SHOP_ANALYZE_DIR/page.tsx"
    echo "✅ Version 'Coming Soon' activée pour shop/analyze"
  fi
  
  echo ""
  echo "✅ Mode 'Coming Soon' activé !"
  echo "📝 Les pages originales sont sauvegardées avec l'extension .backup"
  
elif [ "$MODE" = "full" ]; then
  echo "🔄 Activation de la version complète..."
  
  # Competitors page
  if [ -f "$COMPETITORS_DIR/page.tsx.backup" ]; then
    mv "$COMPETITORS_DIR/page.tsx.backup" "$COMPETITORS_DIR/page.tsx"
    echo "✅ Version complète restaurée pour competitors"
  fi
  
  # Shop analyze page
  if [ -f "$SHOP_ANALYZE_DIR/page.tsx.backup" ]; then
    mv "$SHOP_ANALYZE_DIR/page.tsx.backup" "$SHOP_ANALYZE_DIR/page.tsx"
    echo "✅ Version complète restaurée pour shop/analyze"
  fi
  
  echo ""
  echo "✅ Version complète activée !"
  
else
  echo "❌ Mode invalide. Utilisez 'coming-soon' ou 'full'"
  echo "Usage: ./scripts/toggle-competitors-feature.sh [coming-soon|full]"
  exit 1
fi


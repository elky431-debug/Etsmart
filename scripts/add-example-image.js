#!/usr/bin/env node

/**
 * Script pour ajouter l'image d'exemple de screenshot
 * Usage:
 *   node scripts/add-example-image.js [chemin-vers-image.png]
 *   ou
 *   node scripts/add-example-image.js [URL-de-l-image]
 */

const fs = require('fs');
const path = require('path');

const EXAMPLE_DIR = path.join(process.cwd(), 'public', 'examples');
const EXAMPLE_FILE = path.join(EXAMPLE_DIR, 'screenshot-example.png');

// Créer le dossier s'il n'existe pas
if (!fs.existsSync(EXAMPLE_DIR)) {
  fs.mkdirSync(EXAMPLE_DIR, { recursive: true });
}

const imagePath = process.argv[2];

if (!imagePath) {
  console.log('📸 Veuillez fournir le chemin ou l\'URL de l\'image:');
  console.log('Usage: node scripts/add-example-image.js [chemin-ou-url]');
  console.log('');
  console.log('Exemples:');
  console.log('  node scripts/add-example-image.js ./Downloads/screenshot.png');
  console.log('  node scripts/add-example-image.js https://example.com/image.png');
  console.log('');
  console.log('Ou copiez manuellement votre image vers:');
  console.log(`  ${EXAMPLE_FILE}`);
  process.exit(1);
}

// Vérifier si c'est une URL
if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
  console.log('📥 Téléchargement de l\'image depuis:', imagePath);
  const https = require('https');
  const http = require('http');
  const client = imagePath.startsWith('https://') ? https : http;
  
  client.get(imagePath, (response) => {
    if (response.statusCode !== 200) {
      console.error('❌ Erreur lors du téléchargement:', response.statusCode);
      process.exit(1);
    }
    
    const fileStream = fs.createWriteStream(EXAMPLE_FILE);
    response.pipe(fileStream);
    
    fileStream.on('finish', () => {
      fileStream.close();
      console.log('✅ Image téléchargée avec succès vers:', EXAMPLE_FILE);
    });
  }).on('error', (err) => {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  });
} else {
  // C'est un chemin local
  const fullPath = path.isAbsolute(imagePath) ? imagePath : path.join(process.cwd(), imagePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error('❌ Erreur: Le fichier n\'existe pas:', fullPath);
    process.exit(1);
  }
  
  console.log('📸 Copie de l\'image depuis:', fullPath);
  fs.copyFileSync(fullPath, EXAMPLE_FILE);
  console.log('✅ Image copiée avec succès vers:', EXAMPLE_FILE);
}















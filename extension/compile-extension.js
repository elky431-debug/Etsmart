#!/usr/bin/env node
// Script pour compiler les fichiers .ts.extension vers .js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = [
  { input: 'background.ts.extension', output: 'background.js' },
  { input: 'content-script.ts.extension', output: 'content-script.js' },
  { input: 'types.ts.extension', output: 'types.js' }
];

const tscOptions = [
  '--target ES2020',
  '--module ESNext',
  '--lib ES2020,DOM',
  '--moduleResolution node',
  '--strict',
  '--esModuleInterop',
  '--skipLibCheck',
  '--types chrome',
  '--resolveJsonModule',
  '--allowJs false'
].join(' ');

files.forEach(({ input, output }) => {
  try {
    // Lire le fichier .ts.extension
    const content = fs.readFileSync(input, 'utf8');
    
    // Créer un fichier temporaire .ts (avec le nom de sortie sans extension)
    const tempFile = output.replace('.js', '.ts');
    fs.writeFileSync(tempFile, content);
    
    // Compiler le fichier temporaire avec outDir pour garder ESNext
    const compileOptions = [
      tempFile,
      '--outDir', '.',
      '--target', 'ES2020',
      '--module', 'ESNext',
      '--lib', 'ES2020,DOM',
      '--moduleResolution', 'node',
      '--strict',
      '--esModuleInterop',
      '--skipLibCheck',
      '--types', 'chrome',
      '--resolveJsonModule'
    ].join(' ');
    
    execSync(`npx tsc ${compileOptions}`, {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    // Renommer le fichier compilé si nécessaire (tsc crée le fichier avec le même nom)
    const compiledFile = tempFile.replace('.ts', '.js');
    if (fs.existsSync(compiledFile) && compiledFile !== output) {
      fs.renameSync(compiledFile, output);
    }
    
    // Supprimer le fichier temporaire
    fs.unlinkSync(tempFile);
    
    console.log(`✓ Compilé ${input} → ${output}`);
  } catch (error) {
    console.error(`✗ Erreur lors de la compilation de ${input}:`, error.message);
    // Nettoyer les fichiers temporaires en cas d'erreur
    const tempFile = output.replace('.js', '.ts');
    const compiledFile = tempFile.replace('.ts', '.js');
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    if (fs.existsSync(compiledFile) && compiledFile !== output) {
      fs.unlinkSync(compiledFile);
    }
    process.exit(1);
  }
});

console.log('Compilation terminée avec succès!');


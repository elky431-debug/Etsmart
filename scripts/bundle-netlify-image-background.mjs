import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

await esbuild.build({
  entryPoints: [path.join(root, 'netlify/build/generate-images-background-entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: path.join(root, 'netlify/functions/generate-images-background.js'),
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
  alias: {
    '@': path.join(root, 'src'),
  },
  external: ['sharp'],
});

console.log('[bundle-netlify-image-background] OK → netlify/functions/generate-images-background.js');

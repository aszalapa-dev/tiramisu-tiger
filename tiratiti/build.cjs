const fs = require('node:fs');
const path = require('node:path');
const files = require('./public-files.json');

const root = fs.realpathSync(__dirname);
const output = path.resolve(root, 'dist');
// Only the generated dist directory may be cleared.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') {
  throw new Error('Dossier de sortie non valide.');
}
if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) {
  throw new Error('Le dossier dist ne doit pas être un lien symbolique.');
}

let totalBytes = 0;
for (const file of files) {
  const source = path.resolve(root, file);
  if (!source.startsWith(root + path.sep) || source.startsWith(output + path.sep)) {
    throw new Error(`Chemin non valide : ${file}`);
  }
  const stat = fs.statSync(source);
  if (!stat.isFile()) throw new Error(`Fichier manquant : ${file}`);
  totalBytes += stat.size;
}

fs.rmSync(output, { recursive: true, force: true });
for (const file of files) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}
console.log(`Tiratiti : ${files.length} fichiers préparés dans dist (${(totalBytes / 1000000).toFixed(2)} Mo).`);

// Mapbox public browser token is configured in Vercel, never committed.
const localEnv = path.join(root, '.env.local');
const localToken = fs.existsSync(localEnv)
  ? fs.readFileSync(localEnv, 'utf8').match(/^MAPBOX_PUBLIC_TOKEN=(.+)$/m)?.[1].trim()
  : '';
const mapboxToken = (process.env.MAPBOX_PUBLIC_TOKEN || localToken || '').trim();
if (mapboxToken && !mapboxToken.startsWith('pk.')) {
  throw new Error('MAPBOX_PUBLIC_TOKEN doit être un jeton public pk.');
}
const mapboxConfig = `window.TIRATITI_MAPBOX_TOKEN = ${JSON.stringify(mapboxToken)};\n`;
fs.writeFileSync(path.join(output, 'mapbox-config.js'), mapboxConfig);
fs.writeFileSync(path.join(root, 'mapbox-config.js'), mapboxConfig);
if (!mapboxToken) console.warn('MAPBOX_PUBLIC_TOKEN absent : lien OpenStreetMap utilisé à la place de la carte.');

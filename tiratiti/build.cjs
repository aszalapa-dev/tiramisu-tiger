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

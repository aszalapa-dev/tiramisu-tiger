const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv.includes('--dist') ? path.join(__dirname, 'dist') : __dirname;
const port = Number(process.env.PORT || (process.argv.includes('--dist') ? 4174 : 4173));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.glb':'model/gltf-binary', '.svg':'image/svg+xml' };
http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Content-Length':stat.size});
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log(`Tiratiti: http://127.0.0.1:${port}`));

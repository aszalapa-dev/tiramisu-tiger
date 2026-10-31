const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv.includes('--dist') ? path.join(__dirname, 'dist') : __dirname;
const port = Number(process.env.PORT || (process.argv.includes('--dist') ? 4174 : 4173));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.h264':'video/h264', '.woff2':'font/woff2', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.glb':'model/gltf-binary', '.svg':'image/svg+xml' };
http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    let start=0,end=stat.size-1;
    if(req.headers.range){
      const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!range||!range[1]&&!range[2]){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
      if(range[1]){start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));}
      else start=Math.max(0,stat.size-Number(range[2]));
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
    }
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes'};
    if(req.headers.range)headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
    res.writeHead(req.headers.range?206:200,headers);
    if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(file,{start,end});res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log(`Tiratiti: http://127.0.0.1:${port}`));

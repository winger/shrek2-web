import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { root } from './prepare-runtime.mjs';
const port = Number(process.env.PORT || 4173);
const prefix = process.env.BASE_PATH || '/';
const directory = path.join(root, 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.md': 'text/plain', '.bin': 'application/octet-stream', '.png': 'image/png' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const requested = decodeURIComponent(url.pathname.slice(prefix.length));
    const file = path.resolve(directory, requested || 'index.html');
    if (!file.startsWith(directory + path.sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Length', info.size);
    res.setHeader('Cache-Control', 'no-cache');
    // Deliberately no COOP/COEP headers: this reproduces GitHub Pages, so the
    // service worker's first-visit isolation flow is exercised during local QA.
    if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}${prefix}`));

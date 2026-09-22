import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

// Minimal local stand-in for Vercel's Node function runtime, so files under
// /api/ can be exercised with `node serve.mjs` using the exact same code
// that ships to Vercel.
async function handleApi(urlPath, req, res) {
  const apiFile = path.join(__dirname, 'api', urlPath.replace(/^\/api\//, '') + '.js');
  let mod;
  try {
    mod = await import(pathToFileURL(apiFile).href + `?t=${Date.now()}`);
  } catch {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    if (raw) {
      try {
        req.body = JSON.parse(raw);
      } catch {
        req.body = {};
      }
    } else {
      req.body = {};
    }

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (obj) => {
      const body = JSON.stringify(obj);
      res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json' });
      res.end(body);
    };

    try {
      await mod.default(req, res);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Internal error' }));
    }
  });
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath.startsWith('/api/')) {
    handleApi(urlPath, req, res);
    return;
  }

  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

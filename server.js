const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.ico': 'image/x-icon',
};

// Routes that map to specific HTML files
const ROUTES = {
  '/': '/index.html',
  '/admin': '/admin.html',
  '/admin/': '/admin.html',
};

const STATIC_EXTS = ['.css', '.js', '.json', '.png', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.ico', '.jpg', '.gif', '.webp'];

function serveFile(res, filePath) {
  const full = path.join(PUBLIC, filePath);
  // Prevent path traversal
  if (!full.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function serveRaw(res, sessionId) {
  const configPath = path.join(PUBLIC, 'assets', 'firebase-config.js');
  fs.readFile(configPath, 'utf8', (err, configText) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error: config not found');
      return;
    }
    const m = configText.match(/databaseURL:\s*["']([^"']+)["']/);
    if (!m) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error: databaseURL not configured');
      return;
    }
    const dbUrl = m[1].replace(/\/$/, '');
    const fbUrl = dbUrl + '/drafts/' + encodeURIComponent(sessionId) + '.json';

    const proto = fbUrl.startsWith('https') ? https : http;
    proto.get(fbUrl, (fbRes) => {
      let body = '';
      fbRes.on('data', c => body += c);
      fbRes.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data && typeof data.content === 'string') {
            // Decode Base64
            let decoded;
            try {
              const bin = Buffer.from(data.content, 'base64').toString('binary');
              decoded = Buffer.from(bin, 'binary').toString('utf8');
            } catch (e) {
              decoded = data.content;
            }
            res.writeHead(200, {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'public, max-age=10',
            });
            res.end(decoded);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Draft tidak ditemukan.');
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Error parsing response.');
        }
      });
    }).on('error', () => {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error: Firebase unreachable.');
    });
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;
  const method = req.method;

  // Security: block path traversal
  if (pathname.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Block direct access to internal .html
  if (pathname === '/viewer.html' || pathname === '/raw.html' || pathname === '/viewer' || pathname === '/raw') {
    res.writeHead(302, { Location: '/' });
    res.end();
    return;
  }

  // Static route map
  if (ROUTES[pathname] !== undefined) {
    serveFile(res, ROUTES[pathname]);
    return;
  }

  // Viewer: /d/ or /d/{id}
  if (pathname === '/d' || pathname.startsWith('/d/')) {
    serveFile(res, '/viewer.html');
    return;
  }

  // Raw: /raw/{id}
  if (pathname.startsWith('/raw/')) {
    const parts = pathname.split('/').filter(Boolean);
    const sessionId = parts.length >= 2 ? parts[1] : null;
    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No session ID.');
      return;
    }
    serveRaw(res, sessionId);
    return;
  }

  // Serve static files
  const ext = path.extname(pathname).toLowerCase();
  if (STATIC_EXTS.includes(ext) || pathname.startsWith('/assets/') || pathname.startsWith('/css/') || pathname.startsWith('/fonts/')) {
    serveFile(res, pathname);
    return;
  }

  // Fallback: index.html (SPA)
  serveFile(res, '/index.html');
});

// Vercel serverless export
module.exports = server;

// Standalone
if (require.main === module) {
  server.listen(PORT, () => {
    console.log('GhostDraft running on http://localhost:' + PORT);
  });
}

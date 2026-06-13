const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load .env file (Node.js doesn't auto-load it)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (_) { /* .env optional */ }

// Validate required config
const missing = [];
if (!process.env.FIREBASE_API_KEY) missing.push('FIREBASE_API_KEY');
if (!process.env.FIREBASE_DATABASE_URL) missing.push('FIREBASE_DATABASE_URL');
if (missing.length) {
  console.warn('[GhostDraft] WARNING: Missing env vars:', missing.join(', '));
  console.warn('[GhostDraft] Copy .env.example to .env and fill in your Firebase config.');
} else {
  console.log('[GhostDraft] Firebase config loaded from .env (databaseURL: ' + process.env.FIREBASE_DATABASE_URL + ')');
}

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

// ---------- Firebase config from env ----------
function getFirebaseConfig() {
  return {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
  };
}

function injectConfig(html) {
  const config = getFirebaseConfig();
  const script = '<script>var firebaseConfig = ' + JSON.stringify(config) + ';</script>';
  return html.replace('<!-- FIREBASE_CONFIG -->', script);
}

// ---------- Static file serving ----------
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
    let content = data;
    // Inject Firebase config into HTML files
    if (ext === '.html') {
      content = injectConfig(data.toString('utf8'));
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- Raw proxy (server-side, no client Firebase needed) ----------
function serveRaw(res, sessionId) {
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Error: FIREBASE_DATABASE_URL not configured.');
    return;
  }
  const dbUrl = databaseURL.replace(/\/$/, '');
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
}

// ---------- Server ----------
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

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

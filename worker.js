// GhostDraft — Cloudflare Workers entry point
//
// Firebase config via env bindings. Set vars with EITHER method:
//   1. Cloudflare Dashboard > Workers & Pages > [worker] > Settings > Variables
//   2. wrangler.jsonc → vars section, then npx wrangler deploy
//   3. npx wrangler secret put FIREBASE_API_KEY (encrypted)
// All three expose the value as env.FIREBASE_API_KEY inside the worker.
// After adding/changing variables, REDEPLOY the worker.

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Home / editor
      if (path === '/' || path === '') {
        return serveHTML(env, '/index.html', url);
      }

      // Admin
      if (path === '/admin' || path === '/admin/') {
        return serveHTML(env, '/admin.html', url);
      }

      // Viewer
      if (path === '/d' || path.startsWith('/d/')) {
        return serveHTML(env, '/viewer.html', url);
      }

      // Raw — server-side Firebase REST proxy
      if (path.startsWith('/raw/')) {
        const sessionId = path.split('/').filter(Boolean).pop();
        if (!sessionId) {
          return new Response('No session ID.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
        return serveRaw(env, sessionId);
      }

      // Block direct access to internal pages
      if (path === '/viewer.html' || path === '/raw.html' || path === '/viewer' || path === '/raw') {
        return Response.redirect(url.origin + '/', 302);
      }

      // All other paths: serve static asset (inject config if HTML)
      return serveHTML(env, path, url);
    } catch (e) {
      return new Response('GhostDraft Error: ' + e.message, { status: 500 });
    }
  }
};

// ---------- Firebase config ----------
function getFirebaseConfig(env) {
  return {
    apiKey: env.FIREBASE_API_KEY || '',
    authDomain: env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: env.FIREBASE_DATABASE_URL || '',
    projectId: env.FIREBASE_PROJECT_ID || '',
    storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.FIREBASE_APP_ID || '',
    measurementId: env.FIREBASE_MEASUREMENT_ID || '',
  };
}

// ---------- Inject Firebase config into HTML ----------
function injectConfig(html, env) {
  const config = getFirebaseConfig(env);
  const script =
    '<script>' +
    'var firebaseConfig = ' + JSON.stringify(config) + ';' +
    'if(!firebaseConfig.apiKey||!firebaseConfig.databaseURL){' +
    'console.warn("GhostDraft: Firebase config missing. Set env vars in Cloudflare Dashboard or wrangler.jsonc, then redeploy.");' +
    '}' +
    '</script>';

  // Replace placeholder (standard path)
  if (html.includes('<!-- FIREBASE_CONFIG -->')) {
    return html.replace('<!-- FIREBASE_CONFIG -->', script);
  }

  // Fallback: inject before </head> (old HTML without placeholder)
  return html.replace('</head>', script + '</head>');
}

// ---------- Serve HTML with config injection ----------
async function serveHTML(env, filePath, url) {
  // Fetch asset from ASSETS binding using absolute URL
  const assetUrl = url.origin + (filePath.startsWith('/') ? filePath : '/' + filePath);
  let resp = await env.ASSETS.fetch(new Request(assetUrl));

  // Follow clean-URL redirects
  while ((resp.status === 301 || resp.status === 302 || resp.status === 307) && resp.headers.get('Location')) {
    resp = await env.ASSETS.fetch(new Request(resp.headers.get('Location')));
  }

  const contentType = resp.headers.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    const html = await resp.text();
    return new Response(injectConfig(html, env), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return resp;
}

// ---------- Raw proxy: fetch from Firebase REST API ----------
async function serveRaw(env, sessionId) {
  const databaseURL = env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    return new Response('Error: FIREBASE_DATABASE_URL not configured.', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  try {
    const dbUrl = databaseURL.replace(/\/$/, '');
    const fbUrl = dbUrl + '/drafts/' + encodeURIComponent(sessionId) + '.json';
    const fbResp = await fetch(fbUrl);
    if (!fbResp.ok) {
      return new Response('Draft tidak ditemukan.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const data = await fbResp.json();
    if (data && typeof data.content === 'string') {
      var decoded;
      try {
        var bin = atob(data.content);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        decoded = new TextDecoder().decode(bytes);
      } catch(e) {
        decoded = data.content;
      }
      return new Response(decoded, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return new Response('Draft tidak ditemukan.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (e) {
    return new Response('Error: ' + e.message, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

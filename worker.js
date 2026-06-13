export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route: home / editor
    if (path === '/' || path === '') {
      return fetchAsset(env, '/index.html', url.origin);
    }

    // Route: admin
    if (path === '/admin' || path === '/admin/') {
      return fetchAsset(env, '/admin.html', url.origin);
    }

    // Route: viewer
    if (path === '/d' || path.startsWith('/d/')) {
      return fetchAsset(env, '/viewer.html', url.origin);
    }

    // Route: raw — fetch from Firebase REST API, return text/plain
    if (path.startsWith('/raw/')) {
      const sessionId = path.split('/').filter(Boolean).pop();
      if (!sessionId) {
        return new Response('No session ID.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      return serveRaw(env, sessionId);
    }

    // Block direct access to internal html files and clean-url paths
    if (path === '/viewer.html' || path === '/raw.html' || path === '/viewer' || path === '/raw') {
      return new Response('', { status: 302, headers: { 'Location': '/' } });
    }

    // Serve static files via ASSETS binding, injecting config into HTML
    return serveAsset(env, request);
  }
};

// ---------- Firebase config from Cloudflare env bindings ----------
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

function injectConfig(html, env) {
  const config = getFirebaseConfig(env);
  const script = '<script>var firebaseConfig = ' + JSON.stringify(config) + ';</script>';
  return html.replace('<!-- FIREBASE_CONFIG -->', script);
}

// ---------- Serve asset with config injection for HTML ----------
async function serveAsset(env, request) {
  let resp = await env.ASSETS.fetch(request);
  const ct = resp.headers.get('Content-Type') || '';
  if (ct.includes('text/html')) {
    const html = await resp.text();
    return new Response(injectConfig(html, env), {
      status: resp.status,
      headers: resp.headers,
    });
  }
  return resp;
}

// ---------- Raw proxy ----------
async function serveRaw(env, sessionId) {
  const databaseURL = env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    return new Response('Error: FIREBASE_DATABASE_URL not configured.', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  try {
    const fbUrl = databaseURL + '/drafts/' + encodeURIComponent(sessionId) + '.json';
    const fbResp = await fetch(fbUrl);
    if (!fbResp.ok) {
      return new Response('Draft tidak ditemukan.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const data = await fbResp.json();
    if (data && typeof data.content === 'string') {
      // Decode Base64 to raw text (with fallback for old data)
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

// ---------- Fetch an asset, following ASSETS clean-URL redirects ----------
async function fetchAsset(env, filePath, origin) {
  const url = filePath.startsWith('http') ? filePath : origin + filePath;
  let resp = await env.ASSETS.fetch(new Request(url));

  // Follow ASSETS clean-URL redirect (307) server-side
  if ((resp.status === 307 || resp.status === 301 || resp.status === 302) && resp.headers.get('Location')) {
    const loc = resp.headers.get('Location');
    const redirectUrl = loc.startsWith('http') ? loc : origin + loc;
    resp = await env.ASSETS.fetch(new Request(redirectUrl));
  }

  // Inject config into HTML assets
  const ct = resp.headers.get('Content-Type') || '';
  if (ct.includes('text/html')) {
    const html = await resp.text();
    return new Response(injectConfig(html, env), {
      status: resp.status,
      headers: resp.headers,
    });
  }

  return resp;
}

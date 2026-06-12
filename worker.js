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

    // Route: raw - fetch from Firebase REST API, return text/plain
    if (path.startsWith('/raw/')) {
      const sessionId = path.split('/').filter(Boolean).pop();
      if (!sessionId) {
        return new Response('No session ID.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      return serveRaw(env, sessionId, url.origin);
    }

    // Block direct access to internal html files and clean-url paths
    if (path === '/viewer.html' || path === '/raw.html' || path === '/viewer' || path === '/raw') {
      return new Response('', { status: 302, headers: { 'Location': '/' } });
    }

    // Serve static files via ASSETS binding
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  }
};

async function serveRaw(env, sessionId, origin) {
  try {
    // Read databaseURL from firebase-config.js
    const configResp = await fetchAsset(env, '/assets/firebase-config.js', origin);
    const configText = await configResp.text();
    const m = configText.match(/databaseURL:\s*["']([^"']+)["']/);
    if (!m) {
      return new Response('Error: databaseURL not configured.', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const dbUrl = m[1];

    // Fetch from Firebase REST API
    const fbUrl = dbUrl + '/drafts/' + encodeURIComponent(sessionId) + '.json';
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

async function fetchAsset(env, filePath, origin) {
  const url = filePath.startsWith('http') ? filePath : origin + filePath;
  let resp = await env.ASSETS.fetch(new Request(url));
  
  // Follow ASSETS clean-URL redirect (307) server-side
  if ((resp.status === 307 || resp.status === 301 || resp.status === 302) && resp.headers.get('Location')) {
    const loc = resp.headers.get('Location');
    const redirectUrl = loc.startsWith('http') ? loc : origin + loc;
    resp = await env.ASSETS.fetch(new Request(redirectUrl));
  }
  
  return resp;
}

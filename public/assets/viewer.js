// ---------- Firebase ----------
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------- Extract session ID from URL ----------
const path = location.pathname; // e.g. /d/abc123xyz
const parts = path.split('/').filter(Boolean);
const sessionId = parts.length >= 2 ? parts[1] : null;

// ---------- DOM ----------
const el = {
  sessionId:        document.getElementById('viewerSessionId'),
  connectionStatus: document.getElementById('connectionStatus'),
  viewerContent:    document.getElementById('viewerContent'),
  notFound:         document.getElementById('notFound'),
  pasteTitle:       document.getElementById('pasteTitle'),
  viewerLang:       document.getElementById('viewerLang'),
};

function setStatus(text, cls) {
  el.connectionStatus.textContent = text;
  el.connectionStatus.className = 'status ' + cls;
}

function showNotFound(id) {
  el.viewerContent.classList.add('hidden');
  el.notFound.classList.remove('hidden');
  el.notFound.innerHTML = '<h2>Draft tidak ditemukan</h2>' +
    '<p style="font-family:var(--font-mono);font-size:9pt;color:#888">Session: ' + (id || '?') + '</p>' +
    '<p style="font-size:10pt;color:#888">The draft does not exist or may have been removed.</p>' +
    '<a href="/" style="font-size:10pt">Create a new draft</a>';
  setStatus('Not found', 'error');
}

// ---------- Guard ----------
if (!sessionId) {
  showNotFound(null);
} else {
  el.sessionId.textContent = sessionId;
  const draftRef = db.ref('drafts/' + sessionId);
  let seenData = false;

  draftRef.on('value', (snap) => {
    const data = snap.val();
    if (data && typeof data.content === 'string') {
      seenData = true;
      var decoded = gdDecode(data.content);
      var lang = data.language || '';
      
      // Apply syntax highlighting
      if (lang && hljs.getLanguage(lang)) {
        var highlighted = hljs.highlight(decoded, { language: lang, ignoreIllegals: true }).value;
        el.viewerContent.innerHTML = highlighted;
        el.viewerLang.textContent = lang;
      } else if (lang) {
        // Language not in highlight.js bundle - try auto-detect
        var highlighted = hljs.highlightAuto(decoded).value;
        el.viewerContent.innerHTML = highlighted;
        el.viewerLang.textContent = lang + ' (auto)';
      } else {
        el.viewerContent.textContent = decoded;
        el.viewerLang.textContent = 'plain text';
      }
      el.viewerContent.classList.remove('loading');
      el.notFound.classList.add('hidden');
      if (data.title) el.pasteTitle.textContent = data.title;
      setStatus('Live', 'live');
    } else if (data === null) {
      showNotFound(sessionId);
    } else {
      if (!seenData) {
        setStatus('Waiting…', 'connecting');
      } else {
        showNotFound(sessionId);
      }
    }
  }, (err) => {
    console.error('GhostDraft viewer error:', err);
    if (!seenData) showNotFound(sessionId);
    setStatus('Error', 'error');
  });

  setTimeout(() => {
    if (!seenData) showNotFound(sessionId);
  }, 10000);
}

// ---------- Wrap toggle ----------
var wrapBtn = document.getElementById('wrapBtn');
wrapBtn.addEventListener('click', function() {
  var on = el.viewerContent.classList.toggle('wrap-on');
  wrapBtn.textContent = on ? 'No Wrap' : 'Wrap';
  localStorage.setItem('gd_wrap', on ? '1' : '0');
});
if (localStorage.getItem('gd_wrap') === '1') {
  el.viewerContent.classList.add('wrap-on');
  wrapBtn.textContent = 'No Wrap';
}

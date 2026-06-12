// ---------- Firebase ----------
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------- Session ID ----------
function generateId(len = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => chars[b % chars.length]).join('');
}

function getOrCreateSessionId() {
  let id = sessionStorage.getItem('gd_session');
  if (!id) {
    id = generateId();
    sessionStorage.setItem('gd_session', id);
  }
  return id;
}

function clearSession() {
  sessionStorage.removeItem('gd_session');
}

// ---------- DOM ----------
const el = {
  sessionId:    document.getElementById('sessionId'),
  viewerLink:   document.getElementById('viewerLink'),
  rawLink:      document.getElementById('rawLink'),
  copySession:  document.getElementById('copySessionBtn'),
  copyViewer:   document.getElementById('copyViewerBtn'),
  editor:       document.getElementById('editor'),
  saveStatus:   document.getElementById('saveStatus'),
  newDraftBtn:  document.getElementById('newDraftBtn'),
  pasteTitle:   document.getElementById('pasteTitle'),
  langSelect:   document.getElementById('langSelect'),
  qrBtn:        document.getElementById('qrBtn'),
  qrModal:      document.getElementById('qrModal'),
  qrModalBg:    document.getElementById('qrModalBg'),
  qrCloseBtn:   document.getElementById('qrCloseBtn'),
  qrImage:      document.getElementById('qrImage'),
  qrUrl:        document.getElementById('qrUrl'),
};

const sessionId = getOrCreateSessionId();
const draftRef = db.ref('drafts/' + sessionId);
const viewerUrl = location.origin + '/d/' + sessionId;

// ---------- UI setup ----------
el.sessionId.textContent = sessionId;
el.viewerLink.href = viewerUrl;
el.viewerLink.textContent = '/d/' + sessionId;
el.rawLink.href = '/raw/' + sessionId;

function copyToClipboard(text, btn, label) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = label; }, 1500);
  }).catch(() => {});
}

el.copySession.addEventListener('click', () => copyToClipboard(sessionId, el.copySession, 'Copy ID'));
el.copyViewer.addEventListener('click', () => copyToClipboard(viewerUrl, el.copyViewer, 'Copy link'));

// ---------- Status ----------
function setStatus(text, cls) {
  el.saveStatus.textContent = text;
  el.saveStatus.className = 'status ' + (cls || text.toLowerCase().replace(/[^a-z]/g, ''));
}

// ---------- Load existing content ----------
let remoteContent = null;
let loadedRemote = false;
let titleDirty = false;

draftRef.on('value', (snap) => {
  const data = snap.val();
  if (data && typeof data.content === 'string') {
    remoteContent = gdDecode(data.content);
    if (!loadedRemote && !el.editor.value) {
      el.editor.value = remoteContent;
    }
    if (!loadedRemote && data.title && !titleDirty) {
      el.pasteTitle.textContent = data.title;
    }
    if (!loadedRemote && data.language) {
      el.langSelect.value = data.language;
    }
    loadedRemote = true;
    isNew = false;
    updateRawLink();
  }
});

// ---------- Title autosave (on blur / Enter) ----------
el.pasteTitle.addEventListener('blur', saveTitle);
el.pasteTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); el.pasteTitle.blur(); el.editor.focus(); }
});
el.pasteTitle.addEventListener('input', () => {
  // Show placeholder when empty, hide when has text
  if (el.pasteTitle.textContent.trim()) {
    el.pasteTitle.setAttribute('data-div-placeholder-content', '1');
  } else {
    el.pasteTitle.removeAttribute('data-div-placeholder-content');
  }
});

// Init: hide placeholder if title already has text
if (el.pasteTitle.textContent.trim()) {
  el.pasteTitle.setAttribute('data-div-placeholder-content', '1');
}

// Language change: save immediately (always)
el.langSelect.addEventListener('change', () => {
  draftRef.update({ language: el.langSelect.value }).catch(err => {
    console.error('Language save error:', err);
  });
});

function saveTitle() {
  const raw = el.pasteTitle.textContent.trim();
  const title = raw || 'GhostDraft';
  // Restore text if empty
  if (!raw) {
    el.pasteTitle.textContent = 'GhostDraft';
    el.pasteTitle.setAttribute('data-div-placeholder-content', '1');
  }
  if (!titleDirty && title === 'GhostDraft') return; // No change
  titleDirty = true;
  if (isNew) {
    // Create draft with just title (no content yet)
    const encoded = gdEncode(el.editor.value || '');
    var lang = el.langSelect.value;
    draftRef.set({
      title,
      language: lang,
      content: encoded,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      length: encoded.length,
      userAgent: navigator.userAgent || 'unknown',
    }).then(() => { isNew = false; }).catch(() => {});
    return;
  }
  draftRef.update({ title }).catch(() => {});
}

function updateRawLink() {
  if (!isNew && el.editor.value.trim()) {
    el.rawLink.classList.remove('hidden');
    el.qrBtn.classList.remove('hidden');
  }
}

// ---------- Autosave ----------
const DEBOUNCE_MS = 1000;
let timer = null;
let isNew = true;

async function doSave() {
  const content = el.editor.value;

  // Size guard: raw text 700KB, encoded max ~934KB
  if (content.length > 700000) {
    setStatus('Error: too large (>700 KB)', 'error');
    return;
  }
  const encoded = gdEncode(content);
  // Double safety: encoded must fit rules limit (1MB)
  if (encoded.length > 1000000) {
    setStatus('Error: too large (>700 KB)', 'error');
    return;
  }

  setStatus('Saving…', 'saving');

  try {
    if (isNew) {
      const title = el.pasteTitle.textContent.trim() || 'GhostDraft';
      var lang = el.langSelect.value;
      await draftRef.set({
        title,
        language: lang,
        content: encoded,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        length: encoded.length,
        userAgent: navigator.userAgent || 'unknown',
      });
      isNew = false;
    } else {
      await draftRef.update({
        content: encoded,
        language: el.langSelect.value,
        updatedAt: Date.now(),
        length: encoded.length,
      });
    }
    remoteContent = content;
    setStatus('Saved', 'saved');
    updateRawLink();
  } catch (err) {
    console.error('GhostDraft save error:', err);
    setStatus('Error: ' + (err.message || err.code || 'unknown'), 'error');
    // Retry on next keystroke - debounce will trigger again
  }
}

el.editor.addEventListener('input', () => {
  clearTimeout(timer);
  setStatus('Unsaved', 'unsaved');
  updateRawLink();
  timer = setTimeout(doSave, DEBOUNCE_MS);
});

// ---------- New Draft ----------
el.newDraftBtn.addEventListener('click', () => {
  if (el.editor.value && !confirm('Start a new draft? Current draft is already autosaved.')) return;
  clearSession();
  location.href = '/';
});

// ---------- Before unload: confirm + flush save ----------
window.addEventListener('beforeunload', (e) => {
  const content = el.editor.value.trim();
  
  // Show confirmation dialog if there's content
  if (content) {
    e.preventDefault();
    e.returnValue = '';
  }
  
  // Flush save
  if (timer) {
    clearTimeout(timer);
    if (content && content.length <= 700000) {
      var encodedBefore = gdEncode(content);
      var lang = el.langSelect.value;
      const payload = isNew
        ? { title: el.pasteTitle.textContent.trim() || 'GhostDraft', language: lang, content: encodedBefore, createdAt: Date.now(), updatedAt: Date.now(), length: encodedBefore.length, userAgent: navigator.userAgent || 'unknown' }
        : { content: encodedBefore, language: el.langSelect.value, updatedAt: Date.now(), length: encodedBefore.length };
      (isNew ? draftRef.set(payload) : draftRef.update(payload)).catch(() => {});
    }
  }
});

// ---------- Focus ----------
el.editor.focus();

// ---------- Wrap toggle ----------
var wrapBtn = document.getElementById('wrapBtn');
wrapBtn.addEventListener('click', function() {
  var on = el.editor.classList.toggle('wrap-on');
  wrapBtn.textContent = on ? 'No Wrap' : 'Wrap';
  localStorage.setItem('gd_wrap', on ? '1' : '0');
});
// Restore wrap preference
if (localStorage.getItem('gd_wrap') === '1') {
  el.editor.classList.add('wrap-on');
  wrapBtn.textContent = 'No Wrap';
}

// ---------- QR Code ----------
el.qrBtn.addEventListener('click', function() {
  el.qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(viewerUrl);
  el.qrUrl.textContent = viewerUrl;
  el.qrModal.classList.remove('hidden');
});
el.qrCloseBtn.addEventListener('click', function() { el.qrModal.classList.add('hidden'); });
el.qrModalBg.addEventListener('click', function() { el.qrModal.classList.add('hidden'); });

// Show QR button when content exists
function updateQrBtn() {
  if (!isNew && el.editor.value.trim()) {
    el.qrBtn.classList.remove('hidden');
  }
}

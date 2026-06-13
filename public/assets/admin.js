// ---------- Firebase ----------
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// ---------- DOM ----------
const el = {
  loginSection:       document.getElementById('loginSection'),
  loginForm:          document.getElementById('loginForm'),
  email:              document.getElementById('email'),
  password:           document.getElementById('password'),
  loginError:         document.getElementById('loginError'),
  dashboardSection:   document.getElementById('dashboardSection'),
  logoutBtn:          document.getElementById('logoutBtn'),
  draftsList:         document.getElementById('draftsList'),
  draftDetail:        document.getElementById('draftDetail'),
  detailContent:      document.getElementById('detailContent'),
  closeDetailBtn:     document.getElementById('closeDetailBtn'),
  draftsListContainer:document.getElementById('draftsListContainer'),
  selectAllBtn:       document.getElementById('selectAllBtn'),
  deleteSelectedBtn:  document.getElementById('deleteSelectedBtn'),
  selectedCount:      document.getElementById('selectedCount'),
  draftCount:         document.getElementById('draftCount'),
};

let allEntries = [];
let allDrafts = {};
let selected = {};
let selectAll = false;

// ---------- Auth state ----------
auth.onAuthStateChanged((user) => {
  if (user) {
    el.loginSection.classList.add('hidden');
    el.dashboardSection.classList.remove('hidden');
    el.logoutBtn.classList.remove('hidden');
    loadDrafts();
  } else {
    el.loginSection.classList.remove('hidden');
    el.dashboardSection.classList.add('hidden');
    el.logoutBtn.classList.add('hidden');
    el.draftDetail.classList.add('hidden');
  }
});

// ---------- Login ----------
el.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.loginError.classList.add('hidden');
  const email = el.email.value.trim();
  const password = el.password.value;
  if (!email || !password) { showLoginError('Email and password are required.'); return; }
  try {
    await auth.signInWithEmailAndPassword(email, password);
    el.password.value = '';
  } catch (err) {
    showLoginError(mapAuthError(err.code));
  }
});

function showLoginError(msg) { el.loginError.textContent = msg; el.loginError.classList.remove('hidden'); }

function mapAuthError(code) {
  const map = {
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/too-many-requests': 'Too many attempts.',
    'auth/network-request-failed': 'Network error.',
  };
  return map[code] || code;
}

el.logoutBtn.addEventListener('click', () => auth.signOut());

// ---------- Load drafts ----------
async function loadDrafts() {
  el.draftsList.innerHTML = '<p class="empty-state">Loading drafts…</p>';
  try {
    const snap = await db.ref('drafts').once('value');
    const drafts = snap.val();
    if (!drafts) {
      el.draftsList.innerHTML = '<p class="empty-state">No drafts found.</p>';
      el.draftCount.textContent = '';
      return;
    }
    allDrafts = drafts;
    allEntries = Object.entries(drafts).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    selected = {};
    selectAll = false;
    el.selectAllBtn.textContent = 'Select All';
    renderTable();
  } catch (err) {
    if (err.code === 'PERMISSION_DENIED') {
      el.draftsList.innerHTML = '<div class="error-msg">Access denied. Your email is not authorized to list all drafts.</div>';
    } else {
      el.draftsList.innerHTML = '<div class="error-msg">Failed to load drafts: ' + esc(err.message) + '</div>';
    }
  }
}

function renderTable() {
  el.draftCount.textContent = '(' + allEntries.length + ' drafts)';

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.innerHTML = '<thead><tr>' +
    '<th style="width:30px"><input type="checkbox" id="selectAllCheck"></th>' +
    '<th>Title</th>' +
    '<th>Session ID</th>' +
    '<th style="width:70px">Lang</th>' +
    '<th style="width:70px">Chars</th>' +
    '<th style="width:140px">Created</th>' +
    '<th style="width:140px">Updated</th>' +
    '<th style="width:90px">Action</th>' +
    '</tr></thead><tbody></tbody>';

  const tbody = table.querySelector('tbody');

  for (const [id, draft] of allEntries) {
    const tr = document.createElement('tr');
    const checked = selected[id] ? ' checked' : '';
    tr.innerHTML =
      '<td><input type="checkbox" class="row-check" data-id="' + esc(id) + '"' + checked + '></td>' +
      '<td>' + esc(draft.title || '—') + '</td>' +
      '<td><code>' + esc(id) + '</code></td>' +
      '<td>' + esc(draft.language || '—') + '</td>' +
      '<td>' + (draft.length || 0) + '</td>' +
      '<td>' + fmtTime(draft.createdAt) + '</td>' +
      '<td>' + fmtTime(draft.updatedAt) + '</td>' +
      '<td>' +
        '<button class="btn btn-small view-btn" data-id="' + esc(id) + '">View</button> ' +
        '<button class="btn btn-small delete-btn" data-id="' + esc(id) + '" style="background:#a33;background-image:linear-gradient(to bottom,#c44,#822)">✕</button>' +
      '</td>';
    tbody.appendChild(tr);
  }

  el.draftsList.innerHTML = '';
  el.draftsList.appendChild(table);

  // Select all checkbox
  document.getElementById('selectAllCheck').addEventListener('change', function() {
    selectAll = this.checked;
    if (selectAll) {
      allEntries.forEach(([id]) => { selected[id] = true; });
    } else {
      selected = {};
    }
    updateSelectedUI();
    renderTable();
  });

  // Row checkboxes
  tbody.querySelectorAll('.row-check').forEach(cb => {
    cb.addEventListener('change', function() {
      const id = this.dataset.id;
      if (this.checked) selected[id] = true;
      else delete selected[id];
      selectAll = false;
      document.getElementById('selectAllCheck').checked = false;
      updateSelectedUI();
    });
  });

  // View buttons
  tbody.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => showDetail(btn.dataset.id, allDrafts[btn.dataset.id]));
  });

  // Delete buttons
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteSingle(btn.dataset.id));
  });

  updateSelectedUI();
}

function updateSelectedUI() {
  const count = Object.keys(selected).length;
  el.selectedCount.textContent = count;
  if (count > 0) {
    el.deleteSelectedBtn.classList.remove('hidden');
    el.selectAllBtn.textContent = 'Deselect';
  } else {
    el.deleteSelectedBtn.classList.add('hidden');
    el.selectAllBtn.textContent = 'Select All';
  }
}

// ---------- Select All toggle ----------
el.selectAllBtn.addEventListener('click', () => {
  selectAll = !selectAll;
  if (selectAll) {
    allEntries.forEach(([id]) => { selected[id] = true; });
  } else {
    selected = {};
  }
  renderTable();
});

// ---------- Delete single ----------
async function deleteSingle(id) {
  if (!confirm('Delete draft ' + id + '?\n\nThis cannot be undone.')) return;
  try {
    await db.ref('drafts/' + id).remove();
    loadDrafts();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

// ---------- Mass delete ----------
el.deleteSelectedBtn.addEventListener('click', async () => {
  const ids = Object.keys(selected);
  if (ids.length === 0) return;
  if (!confirm('Delete ' + ids.length + ' selected draft(s)?\n\nThis cannot be undone.')) return;

  el.deleteSelectedBtn.disabled = true;
  el.deleteSelectedBtn.textContent = 'Deleting…';

  let errors = 0;
  for (const id of ids) {
    try { await db.ref('drafts/' + id).remove(); }
    catch (e) { errors++; }
  }

  if (errors) alert(errors + ' delete(s) failed.');
  loadDrafts();
});

// ---------- Detail view ----------
function showDetail(id, draft) {
  el.draftsListContainer.classList.add('hidden');
  el.draftDetail.classList.remove('hidden');
  el.detailContent.innerHTML =
    '<h4>' + esc(draft.title || id) + '</h4>' +
    '<p><strong>Session:</strong> <code>' + esc(id) + '</code></p>' +
    '<p><strong>Language:</strong> ' + esc(draft.language || 'plain text') + '</p>' +
    '<p><strong>Created:</strong> ' + fmtTime(draft.createdAt) + '</p>' +
    '<p><strong>Updated:</strong> ' + fmtTime(draft.updatedAt) + '</p>' +
    '<p><strong>Length:</strong> ' + (draft.length || 0) + ' characters</p>' +
    '<p><strong>User Agent:</strong> ' + esc(draft.userAgent || '—') + '</p>' +
    '<h5>Content</h5>' +
    '<pre class="draft-content">' + esc(gdDecode(draft.content || '')) + '</pre>' +
    '<p style="margin-top:12px"><a href="/d/' + esc(id) + '" target="_blank" rel="noopener">Open viewer →</a></p>' +
    '<p><button class="btn btn-small delete-btn" data-id="' + esc(id) + '" style="background:#a33;background-image:linear-gradient(to bottom,#c44,#822);margin-top:8px">Delete this draft</button></p>';
  // Delete inside detail
  el.detailContent.querySelector('.delete-btn').addEventListener('click', async () => {
    if (!confirm('Delete ' + id + '?')) return;
    await db.ref('drafts/' + id).remove();
    el.draftDetail.classList.add('hidden');
    el.draftsListContainer.classList.remove('hidden');
    loadDrafts();
  });
}

el.closeDetailBtn.addEventListener('click', () => {
  el.draftDetail.classList.add('hidden');
  el.draftsListContainer.classList.remove('hidden');
});

// ---------- Helpers ----------
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').replace(/\..+/, '');
}

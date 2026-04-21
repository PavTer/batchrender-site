/* ═══════════════════════════════════════════════════════════════════════════
 * BatchRender Inline Editor v2
 * Architecture: edit.html = full copy of index.html + editor overlay
 * Texts live in T{} object in the page. We make [data-key] elements
 * contenteditable, track changes, and on Save — patch T{} in edit.html
 * and index.html via GitHub API (using git tree to bypass 100KB limit).
 * ══════════════════════════════════════════════════════════════════════════ */

const EDITOR_CONFIG = {
  REPO: 'PavTer/batchrender-site',
  BRANCH: 'main',
  OAUTH_URL: 'https://batchrender-oauth.vercel.app/auth',
  ALLOWED_USERS: ['PavTer'],
};

const editorState = {
  token: null,
  user: null,
  lang: 'en',
  dirty: new Map(), // key -> { el, key, lang, oldVal, newVal }
  indexSha: null,
  editSha: null,
};

// ─── OAUTH ────────────────────────────────────────────────────────────────
function editorStartOAuth() {
  return new Promise((resolve, reject) => {
    const popup = window.open(EDITOR_CONFIG.OAUTH_URL, 'br_oauth', 'width=600,height=700');
    if (!popup) { reject(new Error('Popup blocked — allow popups for this site')); return; }
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'string') return;
      if (e.data === 'authorizing:github') {
        try { popup.postMessage('authorizing:github', e.origin || '*'); } catch(_) {}
        return;
      }
      const m = e.data.match(/^authorization:github:success:(.+)$/);
      if (m) {
        try { const d = JSON.parse(m[1]); window.removeEventListener('message', handler); popup.close(); resolve(d.token); } catch(err) { reject(err); }
      }
      const em = e.data.match(/^authorization:github:error:(.+)$/);
      if (em) { window.removeEventListener('message', handler); popup.close(); reject(new Error(em[1])); }
    };
    window.addEventListener('message', handler);
    setTimeout(() => { window.removeEventListener('message', handler); if(!popup.closed) popup.close(); reject(new Error('OAuth timeout')); }, 120000);
  });
}

async function editorGetUser(token) {
  const r = await fetch('https://api.github.com/user', {
    headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json' }
  });
  if (!r.ok) throw new Error('GitHub auth failed: ' + r.status);
  return r.json();
}

// ─── GITHUB API ───────────────────────────────────────────────────────────
async function ghGet(path) {
  const r = await fetch(`https://api.github.com/repos/${EDITOR_CONFIG.REPO}/contents/${path}?ref=${EDITOR_CONFIG.BRANCH}`, {
    headers: { Authorization: 'token ' + editorState.token, Accept: 'application/vnd.github+json' }
  });
  if (!r.ok) throw new Error(`GitHub GET ${path}: ${r.status}`);
  return r.json();
}

// Use git tree API to update large files (bypasses 100KB limit of contents API)
async function ghUpdateFilesViaTree(files, message) {
  const headers = {
    Authorization: 'token ' + editorState.token,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
  const base = EDITOR_CONFIG.REPO;
  const branch = EDITOR_CONFIG.BRANCH;

  // 1. Get current commit SHA
  const refR = await fetch(`https://api.github.com/repos/${base}/git/refs/heads/${branch}`, { headers });
  if (!refR.ok) throw new Error('Cannot get branch ref: ' + refR.status);
  const ref = await refR.json();
  const baseSha = ref.object.sha;

  // 2. Get base tree SHA
  const commitR = await fetch(`https://api.github.com/repos/${base}/git/commits/${baseSha}`, { headers });
  if (!commitR.ok) throw new Error('Cannot get commit: ' + commitR.status);
  const commit = await commitR.json();
  const baseTreeSha = commit.tree.sha;

  // 3. Create blobs for each file
  const treeItems = [];
  for (const { path, content } of files) {
    const blobR = await fetch(`https://api.github.com/repos/${base}/git/blobs`, {
      method: 'POST', headers,
      body: JSON.stringify({ content, encoding: 'utf-8' })
    });
    if (!blobR.ok) throw new Error('Cannot create blob for ' + path + ': ' + blobR.status);
    const blob = await blobR.json();
    treeItems.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 4. Create new tree
  const treeR = await fetch(`https://api.github.com/repos/${base}/git/trees`, {
    method: 'POST', headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
  });
  if (!treeR.ok) throw new Error('Cannot create tree: ' + treeR.status);
  const tree = await treeR.json();

  // 5. Create commit
  const newCommitR = await fetch(`https://api.github.com/repos/${base}/git/commits`, {
    method: 'POST', headers,
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] })
  });
  if (!newCommitR.ok) throw new Error('Cannot create commit: ' + newCommitR.status);
  const newCommit = await newCommitR.json();

  // 6. Update branch ref
  const updateR = await fetch(`https://api.github.com/repos/${base}/git/refs/heads/${branch}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ sha: newCommit.sha })
  });
  if (!updateR.ok) throw new Error('Cannot update ref: ' + updateR.status);
  return newCommit;
}

// ─── MAKE ELEMENTS EDITABLE ───────────────────────────────────────────────
function editorActivate() {
  // All [data-key] elements become editable
  document.querySelectorAll('[data-key]').forEach(el => {
    // Skip elements whose content contains HTML tags (heroTitle etc) — too complex
    const key = el.getAttribute('data-key');
    const inner = el.innerHTML;
    if (inner.includes('<') && inner.includes('>') && !inner.startsWith('"')) return;
    // Skip buttons and links that are navigational
    if (el.tagName === 'A' && el.closest('.lang-bar')) return;
    if (el.classList.contains('btn-nav')) return;

    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-edit', '');
    el.setAttribute('data-path', key);
    el.setAttribute('data-original', el.innerHTML);

    el.addEventListener('input', onEditInput);
    el.addEventListener('paste', onEditPaste);
    el.addEventListener('keydown', onEditKeydown);
    el.addEventListener('focus', onEditFocus);
    el.addEventListener('blur', onEditBlur);
  });

  // Also make [data-nav-key] links editable
  document.querySelectorAll('[data-nav-key]').forEach(el => {
    const key = el.getAttribute('data-nav-key');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-edit', '');
    el.setAttribute('data-path', 'nav_' + key);
    el.setAttribute('data-original', el.textContent);
    el.addEventListener('input', onEditInput);
    el.addEventListener('paste', onEditPaste);
    el.addEventListener('keydown', onEditKeydown);
  });
}

function onEditFocus(e) {
  // Prevent link navigation
  e.target.closest('a')?.addEventListener('click', stopNav, { once: true });
}
function onEditBlur() {}
function stopNav(e) { e.preventDefault(); }

function onEditInput(e) {
  const el = e.target;
  const key = el.dataset.path;
  const original = el.dataset.original;
  const current = el.innerHTML;

  if (current !== original) {
    editorState.dirty.set(key, { el, key, lang: editorState.lang, newVal: el.textContent, newHTML: current });
    el.classList.add('dirty');
  } else {
    editorState.dirty.delete(key);
    el.classList.remove('dirty');
  }
  editorUpdateUI();
}

function onEditPaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text');
  document.execCommand('insertText', false, text);
}

function onEditKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); }
  if (e.key === 'Escape') { e.target.blur(); }
}

// ─── UI ───────────────────────────────────────────────────────────────────
function editorUpdateUI() {
  const count = editorState.dirty.size;
  document.getElementById('editor-count').textContent = count;
  document.getElementById('editor-save-btn').disabled = count === 0;
  document.getElementById('editor-discard-btn').disabled = count === 0;
  const ind = document.getElementById('editor-changes');
  const txt = ind.querySelector('.txt');
  if (count === 0) { ind.classList.remove('saved'); txt.textContent = 'No changes'; }
  else { ind.classList.remove('saved'); txt.textContent = count + ' unsaved change' + (count > 1 ? 's' : ''); }
}

function editorShowToast(msg, isError) {
  const t = document.getElementById('editor-toast');
  t.textContent = (isError ? '✗ ' : '✓ ') + msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), isError ? 6000 : 3500);
}

// ─── SAVE ────────────────────────────────────────────────────────────────
async function editorSave() {
  if (editorState.dirty.size === 0) return;
  const btn = document.getElementById('editor-save-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Saving...';

  try {
    // Get current content of index.html and edit.html
    const [indexFile, editFile] = await Promise.all([
      ghGet('index.html'),
      ghGet('edit.html'),
    ]);

    let indexContent = atob(indexFile.content.replace(/\n/g, ''));
    let editContent = atob(editFile.content.replace(/\n/g, ''));

    // For each dirty key, patch the T object string in both files
    const changes = Array.from(editorState.dirty.values());
    const changedKeys = [];

    for (const { key, lang, newVal } of changes) {
      const isNavKey = key.startsWith('nav_');
      const realKey = isNavKey ? key.slice(4) : key;

      // Build replacement for the T object entry
      // Pattern: key:"oldvalue" or key:'oldvalue'
      // We do it per-language: find the lang block and replace within it
      // Simple approach: replace all occurrences of this key in T[lang] section
      const escaped = newVal.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");

      // Replace in both files
      [indexContent, editContent] = [indexContent, editContent].map(content => {
        // Match: realKey:"...") or realKey:'...' in the right lang section
        // Use a regex that finds the key followed by colon and quoted string
        const patterns = [
          new RegExp(`(${realKey}:)"[^"]*"`, 'g'),
          new RegExp(`(${realKey}:)'[^']*'`, 'g'),
        ];
        // Only replace in the correct language block
        // Find lang block boundaries and replace only there
        const langStart = content.indexOf(`${lang}:`);
        const nextLangStart = ['en','ru','zh'].filter(l => l !== lang)
          .map(l => content.indexOf(`${l}:`, langStart + 1))
          .filter(i => i > langStart)
          .reduce((min, i) => i < min ? i : min, Infinity);
        
        if (langStart === -1) return content;
        
        const before = content.slice(0, langStart);
        const langBlock = nextLangStart === Infinity 
          ? content.slice(langStart) 
          : content.slice(langStart, nextLangStart);
        const after = nextLangStart === Infinity ? '' : content.slice(nextLangStart);
        
        let newBlock = langBlock;
        patterns.forEach(re => {
          newBlock = newBlock.replace(re, (match, prefix) => {
            return `${prefix}"${newVal}"`;
          });
        });
        
        return before + newBlock + after;
      });
      changedKeys.push(realKey);
    }

    // Commit both files
    const commitMsg = `edit: update ${[...new Set(changedKeys)].slice(0,5).join(', ')} via inline editor`;
    await ghUpdateFilesViaTree([
      { path: 'index.html', content: indexContent },
      { path: 'edit.html', content: editContent },
    ], commitMsg);

    // Clear dirty state
    editorState.dirty.forEach(({ el }) => {
      el.classList.remove('dirty');
      el.dataset.original = el.innerHTML; // update baseline
    });
    editorState.dirty.clear();
    editorUpdateUI();

    const ind = document.getElementById('editor-changes');
    ind.classList.add('saved');
    ind.querySelector('.txt').textContent = 'Saved ✓';
    editorShowToast('Committed! Vercel deploying (~30s)...');
  } catch (err) {
    console.error('Editor save error:', err);
    editorShowToast(err.message || 'Save failed', true);
  } finally {
    btn.querySelector('span').textContent = 'Save';
    btn.disabled = editorState.dirty.size === 0;
  }
}

// ─── DISCARD ─────────────────────────────────────────────────────────────
function editorDiscard() {
  editorState.dirty.forEach(({ el }) => {
    el.innerHTML = el.dataset.original;
    el.classList.remove('dirty');
  });
  editorState.dirty.clear();
  editorUpdateUI();
  editorShowToast('Changes discarded');
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────
function editorLogout() {
  sessionStorage.removeItem('br_editor_token');
  sessionStorage.removeItem('br_editor_user');
  location.reload();
}

// ─── BOOT ────────────────────────────────────────────────────────────────
async function editorBoot() {
  const loginScreen = document.getElementById('editor-login');
  const bar = document.getElementById('editor-bar');
  const hint = document.getElementById('editor-hint');
  const errEl = document.getElementById('editor-login-error');

  // Restore session
  const cachedToken = sessionStorage.getItem('br_editor_token');
  const cachedUser = sessionStorage.getItem('br_editor_user');
  if (cachedToken && cachedUser) {
    editorState.token = cachedToken;
    editorState.user = JSON.parse(cachedUser);
    editorEnter();
    return;
  }

  // Login button
  document.getElementById('editor-login-btn').addEventListener('click', async () => {
    errEl.textContent = '';
    const btn = document.getElementById('editor-login-btn');
    btn.textContent = 'Connecting...';
    btn.disabled = true;
    try {
      const token = await editorStartOAuth();
      const user = await editorGetUser(token);
      if (!EDITOR_CONFIG.ALLOWED_USERS.includes(user.login)) {
        errEl.textContent = `@${user.login} is not authorized to edit this site.`;
        btn.textContent = 'Sign in with GitHub';
        btn.disabled = false;
        return;
      }
      editorState.token = token;
      editorState.user = user;
      sessionStorage.setItem('br_editor_token', token);
      sessionStorage.setItem('br_editor_user', JSON.stringify(user));
      editorEnter();
    } catch (err) {
      errEl.textContent = err.message || 'Login failed';
      btn.textContent = 'Sign in with GitHub';
      btn.disabled = false;
    }
  });
}

function editorEnter() {
  const loginScreen = document.getElementById('editor-login');
  const bar = document.getElementById('editor-bar');
  const hint = document.getElementById('editor-hint');

  // Show user in bar
  const userBox = document.getElementById('editor-user');
  if (editorState.user) {
    userBox.innerHTML = `<img src="${editorState.user.avatar_url}" alt=""> @${editorState.user.login}`;
  }

  // Wire up buttons
  document.getElementById('editor-save-btn').addEventListener('click', editorSave);
  document.getElementById('editor-discard-btn').addEventListener('click', editorDiscard);
  document.getElementById('editor-logout-btn').addEventListener('click', editorLogout);

  // Lang switch — sync with site's own switcher
  document.querySelectorAll('#editor-lang-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      editorState.lang = lang;
      document.querySelectorAll('#editor-lang-switch button').forEach(b => b.classList.toggle('active', b === btn));
      // Trigger the site's own setLang so content updates
      if (typeof setLang === 'function') {
        const map = { en: 'en', ru: 'ru', zh: 'zh' };
        setLang(map[lang]);
      }
      // Re-activate editable elements after lang switch
      setTimeout(() => {
        editorActivate();
      }, 100);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); editorSave(); }
  });

  // Hide login, show bar
  loginScreen.style.display = 'none';
  bar.style.display = 'flex';
  hint.classList.add('show');

  // Activate editing
  editorActivate();
  editorUpdateUI();
}

// Start
document.addEventListener('DOMContentLoaded', editorBoot);

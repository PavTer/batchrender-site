/* ═══════════════════════════════════════════════════════════════════════════
 * BatchRender Inline Editor v3 (fix/edit-page)
 *
 * Architecture:
 *   /edit         → Vercel rewrite → /edit.html
 *   /edit.html    = full clone of index.html + editor overlay (this script)
 *   On Save        → patch T{} object in BOTH index.html and edit.html
 *                    via GitHub Trees API (commit on main, Vercel auto-deploys)
 *
 * Changes vs v2:
 *   - Activate ALL [data-key] elements, not just plain-text ones.
 *     We edit innerHTML so users can keep <span>/<br>/<strong> markup.
 *   - Idempotent activation — re-activating after lang switch does NOT
 *     duplicate event listeners.
 *   - Smarter T{} patching: scope to lang block + handle escaped quotes,
 *     HTML entities, multi-line strings.
 *   - Block link/button navigation while editing (capture-phase preventDefault).
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
  // dirty: key -> { el, key, lang, oldHTML, newHTML, newText }
  dirty: new Map(),
};

// ═══════════════════════════════════════════════════════════════════════════
// OAUTH
// ═══════════════════════════════════════════════════════════════════════════

function editorStartOAuth() {
  return new Promise((resolve, reject) => {
    const popup = window.open(EDITOR_CONFIG.OAUTH_URL, 'br_oauth', 'width=600,height=700');
    if (!popup) {
      reject(new Error('Popup blocked — allow popups for this site'));
      return;
    }
    const handler = (e) => {
      if (!e.data || typeof e.data !== 'string') return;
      if (e.data === 'authorizing:github') {
        try { popup.postMessage('authorizing:github', e.origin || '*'); } catch (_) {}
        return;
      }
      const m = e.data.match(/^authorization:github:success:(.+)$/);
      if (m) {
        try {
          const d = JSON.parse(m[1]);
          window.removeEventListener('message', handler);
          popup.close();
          resolve(d.token);
        } catch (err) { reject(err); }
      }
      const em = e.data.match(/^authorization:github:error:(.+)$/);
      if (em) {
        window.removeEventListener('message', handler);
        popup.close();
        reject(new Error(em[1]));
      }
    };
    window.addEventListener('message', handler);
    setTimeout(() => {
      window.removeEventListener('message', handler);
      if (!popup.closed) popup.close();
      reject(new Error('OAuth timeout'));
    }, 120000);
  });
}

async function editorGetUser(token) {
  const r = await fetch('https://api.github.com/user', {
    headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json' }
  });
  if (!r.ok) throw new Error('GitHub auth failed: ' + r.status);
  return r.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB API
// ═══════════════════════════════════════════════════════════════════════════

async function ghGet(path) {
  const r = await fetch(
    `https://api.github.com/repos/${EDITOR_CONFIG.REPO}/contents/${path}?ref=${EDITOR_CONFIG.BRANCH}`,
    { headers: { Authorization: 'token ' + editorState.token, Accept: 'application/vnd.github+json' } }
  );
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

  const refR = await fetch(`https://api.github.com/repos/${base}/git/refs/heads/${branch}`, { headers });
  if (!refR.ok) throw new Error('Cannot get branch ref: ' + refR.status);
  const ref = await refR.json();
  const baseSha = ref.object.sha;

  const commitR = await fetch(`https://api.github.com/repos/${base}/git/commits/${baseSha}`, { headers });
  if (!commitR.ok) throw new Error('Cannot get commit: ' + commitR.status);
  const commit = await commitR.json();
  const baseTreeSha = commit.tree.sha;

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

  const treeR = await fetch(`https://api.github.com/repos/${base}/git/trees`, {
    method: 'POST', headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
  });
  if (!treeR.ok) throw new Error('Cannot create tree: ' + treeR.status);
  const tree = await treeR.json();

  const newCommitR = await fetch(`https://api.github.com/repos/${base}/git/commits`, {
    method: 'POST', headers,
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] })
  });
  if (!newCommitR.ok) throw new Error('Cannot create commit: ' + newCommitR.status);
  const newCommit = await newCommitR.json();

  const updateR = await fetch(`https://api.github.com/repos/${base}/git/refs/heads/${branch}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ sha: newCommit.sha })
  });
  if (!updateR.ok) throw new Error('Cannot update ref: ' + updateR.status);
  return newCommit;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAKE ELEMENTS EDITABLE (idempotent — safe to call multiple times)
// ═══════════════════════════════════════════════════════════════════════════

function shouldSkipElement(el) {
  // Skip language switcher — it's not content, it's UI controls
  if (el.closest('.lang-bar') || el.closest('#editor-bar') || el.closest('#editor-login')) return true;
  return false;
}

function editorActivate() {
  // Activate ALL [data-key] elements regardless of inner HTML.
  // We edit innerHTML so vlozhenny markup (<span class="grad">, <br>, <strong>) survives.
  document.querySelectorAll('[data-key]').forEach((el) => {
    if (shouldSkipElement(el)) return;
    if (el.dataset.editorReady === '1') {
      // Already activated — just refresh baseline (lang switched, content was repopulated)
      el.dataset.original = el.innerHTML;
      el.classList.remove('dirty');
      return;
    }
    const key = el.getAttribute('data-key');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-edit', '');
    el.setAttribute('data-path', key);
    el.dataset.original = el.innerHTML;
    el.dataset.editorReady = '1';

    el.addEventListener('input', onEditInput);
    el.addEventListener('paste', onEditPaste);
    el.addEventListener('keydown', onEditKeydown);
    el.addEventListener('click', stopNavInEdit, true); // capture phase
  });

  // Same for [data-nav-key] (top nav links)
  document.querySelectorAll('[data-nav-key]').forEach((el) => {
    if (shouldSkipElement(el)) return;
    if (el.dataset.editorReady === '1') {
      el.dataset.original = el.innerHTML;
      el.classList.remove('dirty');
      return;
    }
    const key = el.getAttribute('data-nav-key');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-edit', '');
    el.setAttribute('data-path', 'nav_' + key);
    el.dataset.original = el.innerHTML;
    el.dataset.editorReady = '1';

    el.addEventListener('input', onEditInput);
    el.addEventListener('paste', onEditPaste);
    el.addEventListener('keydown', onEditKeydown);
    el.addEventListener('click', stopNavInEdit, true);
  });
}

function stopNavInEdit(e) {
  // If user clicks on a link that has data-edit, prevent navigation so they can edit
  const target = e.target.closest('a[data-edit], button[data-edit], a[contenteditable], button[contenteditable]');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    target.focus();
  }
}

function onEditInput(e) {
  const el = e.currentTarget;
  const key = el.dataset.path;
  const original = el.dataset.original;
  const current = el.innerHTML;

  if (current !== original) {
    editorState.dirty.set(key, {
      el,
      key,
      lang: editorState.lang,
      oldHTML: original,
      newHTML: current,
      newText: el.textContent,
    });
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
  // Esc — blur to deselect
  if (e.key === 'Escape') { e.currentTarget.blur(); return; }
  // Enter without shift — blur (commit). Shift+Enter — newline allowed.
  if (e.key === 'Enter' && !e.shiftKey) {
    // For inline elements (links, h1, span), block enter entirely
    const tag = e.currentTarget.tagName;
    if (tag === 'A' || tag === 'BUTTON' || tag === 'SPAN' || /^H[1-6]$/.test(tag)) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════════════════

function editorUpdateUI() {
  const count = editorState.dirty.size;
  document.getElementById('editor-count').textContent = count;
  document.getElementById('editor-save-btn').disabled = count === 0;
  document.getElementById('editor-discard-btn').disabled = count === 0;
  const ind = document.getElementById('editor-changes');
  const txt = ind.querySelector('.txt');
  if (count === 0) {
    ind.classList.remove('saved');
    txt.textContent = 'No changes';
  } else {
    ind.classList.remove('saved');
    txt.textContent = count + ' unsaved change' + (count > 1 ? 's' : '');
  }
}

function editorShowToast(msg, isError) {
  const t = document.getElementById('editor-toast');
  t.textContent = (isError ? '✗ ' : '✓ ') + msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), isError ? 6000 : 3500);
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE — patch T{...} in both index.html and edit.html
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find the boundary of a language block inside T = { ... } object.
 * Returns [start, end) of the *value* portion (inside the {}), or null if not found.
 *
 * The page T object looks like:
 *   const T = {
 *     en: {
 *       heroTitle: '...',
 *       ...
 *     },
 *     ru: {
 *       ...
 *     },
 *     zh: { ... }
 *   };
 *
 * We need the inner content of the e.g. `en:` block.
 */
function findLangBlockBounds(content, lang) {
  // Find `<lang>:` followed by `{` (allowing whitespace/newline)
  const re = new RegExp(`\\b${lang}\\s*:\\s*\\{`, 'g');
  const match = re.exec(content);
  if (!match) return null;
  // Position of the `{`
  let depth = 1;
  let i = re.lastIndex; // index right after the `{`
  const start = i;
  while (i < content.length && depth > 0) {
    const ch = content[i];
    // Skip strings
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < content.length) {
        if (content[i] === '\\') { i += 2; continue; }
        if (content[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  if (depth !== 0) return null;
  return [start, i - 1]; // exclude the closing `}`
}

/**
 * Replace `key: '...'` (or `key: "..."`) inside a slice of JS source.
 * Properly handles escaped quotes inside string values.
 * Returns the new slice, or null if key not found.
 */
function replaceKeyInBlock(slice, key, newValue) {
  // Find `key:` (not preceded by alphanumerics/$/_)
  const keyRe = new RegExp(`(^|[\\s,{])(${key})\\s*:\\s*(['"])`, 'g');
  let m = keyRe.exec(slice);
  if (!m) return null;
  const quote = m[3];
  const valueStart = keyRe.lastIndex; // right after opening quote
  // Find matching closing quote, respecting backslash escapes
  let i = valueStart;
  while (i < slice.length) {
    if (slice[i] === '\\') { i += 2; continue; }
    if (slice[i] === quote) break;
    i++;
  }
  if (i >= slice.length) return null;
  const valueEnd = i; // position of closing quote

  // Escape newValue for the chosen quote style
  const escaped = newValue
    .replace(/\\/g, '\\\\')
    .replace(new RegExp(quote, 'g'), '\\' + quote);

  return slice.slice(0, valueStart) + escaped + slice.slice(valueEnd);
}

async function editorSave() {
  if (editorState.dirty.size === 0) return;
  const btn = document.getElementById('editor-save-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Saving...';

  try {
    const [indexFile, editFile] = await Promise.all([
      ghGet('index.html'),
      ghGet('edit.html'),
    ]);

    let indexContent = atob(indexFile.content.replace(/\n/g, ''));
    let editContent = atob(editFile.content.replace(/\n/g, ''));

    // For each dirty entry, patch T[lang][key] in BOTH files.
    const changes = Array.from(editorState.dirty.values());
    const changedKeys = [];
    const failures = [];

    for (const { key, lang, newHTML } of changes) {
      const isNavKey = key.startsWith('nav_');
      const realKey = isNavKey ? key.slice(4) : key;

      let success = true;
      [indexContent, editContent] = [indexContent, editContent].map((content) => {
        const bounds = findLangBlockBounds(content, lang);
        if (!bounds) { success = false; return content; }
        const [bStart, bEnd] = bounds;
        const before = content.slice(0, bStart);
        const block = content.slice(bStart, bEnd);
        const after = content.slice(bEnd);
        const newBlock = replaceKeyInBlock(block, realKey, newHTML);
        if (newBlock === null) { success = false; return content; }
        return before + newBlock + after;
      });

      if (success) changedKeys.push(realKey);
      else failures.push(realKey);
    }

    if (failures.length > 0 && changedKeys.length === 0) {
      throw new Error(`Could not patch keys: ${failures.join(', ')}`);
    }

    const summary = [...new Set(changedKeys)].slice(0, 5).join(', ');
    const more = changedKeys.length > 5 ? ` (+${changedKeys.length - 5} more)` : '';
    const commitMsg = `edit: update ${summary}${more} via inline editor`;

    await ghUpdateFilesViaTree([
      { path: 'index.html', content: indexContent },
      { path: 'edit.html', content: editContent },
    ], commitMsg);

    // Clear dirty state, set new baseline
    editorState.dirty.forEach(({ el }) => {
      el.classList.remove('dirty');
      el.dataset.original = el.innerHTML;
    });
    editorState.dirty.clear();
    editorUpdateUI();

    const ind = document.getElementById('editor-changes');
    ind.classList.add('saved');
    ind.querySelector('.txt').textContent = 'Saved ✓';

    if (failures.length > 0) {
      editorShowToast(`Saved ${changedKeys.length}, failed: ${failures.join(', ')}`, true);
    } else {
      editorShowToast('Committed! Vercel deploying (~30s)...');
    }
  } catch (err) {
    console.error('Editor save error:', err);
    editorShowToast(err.message || 'Save failed', true);
  } finally {
    btn.querySelector('span').textContent = 'Save';
    btn.disabled = editorState.dirty.size === 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCARD / LOGOUT
// ═══════════════════════════════════════════════════════════════════════════

function editorDiscard() {
  editorState.dirty.forEach(({ el }) => {
    el.innerHTML = el.dataset.original;
    el.classList.remove('dirty');
  });
  editorState.dirty.clear();
  editorUpdateUI();
  editorShowToast('Changes discarded');
}

function editorLogout() {
  sessionStorage.removeItem('br_editor_token');
  sessionStorage.removeItem('br_editor_user');
  location.reload();
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════

async function editorBoot() {
  const errEl = document.getElementById('editor-login-error');

  const cachedToken = sessionStorage.getItem('br_editor_token');
  const cachedUser = sessionStorage.getItem('br_editor_user');
  if (cachedToken && cachedUser) {
    editorState.token = cachedToken;
    try { editorState.user = JSON.parse(cachedUser); } catch (_) {}
    editorEnter();
    return;
  }

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

  const userBox = document.getElementById('editor-user');
  if (editorState.user) {
    userBox.innerHTML = `<img src="${editorState.user.avatar_url}" alt=""> @${editorState.user.login}`;
  }

  document.getElementById('editor-save-btn').addEventListener('click', editorSave);
  document.getElementById('editor-discard-btn').addEventListener('click', editorDiscard);
  document.getElementById('editor-logout-btn').addEventListener('click', editorLogout);

  // Lang switch — drive site's setLang(), then re-baseline editable elements.
  document.querySelectorAll('#editor-lang-switch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Warn if there are unsaved changes — switching lang will lose them
      if (editorState.dirty.size > 0) {
        if (!confirm(`You have ${editorState.dirty.size} unsaved change(s). Switch language anyway? Changes will be lost.`)) {
          return;
        }
        editorState.dirty.clear();
        editorUpdateUI();
      }
      const lang = btn.dataset.lang;
      editorState.lang = lang;
      document.querySelectorAll('#editor-lang-switch button').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      if (typeof setLang === 'function') setLang(lang);
      // Re-baseline: setLang() rewrote innerHTML, so refresh data-original.
      // editorActivate is idempotent thanks to data-editor-ready.
      setTimeout(() => editorActivate(), 50);
    });
  });

  // Cmd/Ctrl+S
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); editorSave(); }
  });

  // Warn on accidental tab close with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (editorState.dirty.size > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  loginScreen.style.display = 'none';
  bar.style.display = 'flex';
  hint.classList.add('show');

  editorActivate();
  editorUpdateUI();
}

document.addEventListener('DOMContentLoaded', editorBoot);

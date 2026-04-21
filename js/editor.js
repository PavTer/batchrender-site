/* ═══════════════════════════════════════════════════════════════════════════
 * BatchRender Inline Editor
 * - GitHub OAuth via existing proxy (batchrender-oauth.vercel.app)
 * - Loads site HTML from / and injects into #editor-site-root
 * - Loads content/{lang}.json and renders text into [data-edit] elements
 * - ContentEditable on all text nodes
 * - Save: builds updated JSON, commits via GitHub API
 * ══════════════════════════════════════════════════════════════════════════ */

const CONFIG = {
  REPO: 'PavTer/batchrender-site',
  BRANCH: 'main',
  OAUTH_URL: 'https://batchrender-oauth.vercel.app/auth',
  ALLOWED_USERS: ['PavTer'], // только эти юзеры могут редактировать
};

const state = {
  token: null,
  user: null,
  lang: 'en',
  content: { en: null, ru: null, zh: null },
  shas: { en: null, ru: null, zh: null }, // sha файлов в репо для update
  initial: {}, // { en: {...}, ru: {...}, zh: {...} } — начальные значения для diff
  dirty: {},   // { en: Set<path>, ru: Set<path>, zh: Set<path> }
};

// ─── UTILITY: get/set nested property by dot-path ─────────────────────────
function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    // Поддержка массивов: items[0].title
    const arrMatch = key.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) return acc[arrMatch[1]]?.[parseInt(arrMatch[2])];
    return acc[key];
  }, obj);
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const arrMatch = key.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) {
      if (!cur[arrMatch[1]]) cur[arrMatch[1]] = [];
      if (!cur[arrMatch[1]][parseInt(arrMatch[2])]) cur[arrMatch[1]][parseInt(arrMatch[2])] = {};
      cur = cur[arrMatch[1]][parseInt(arrMatch[2])];
    } else {
      if (!cur[key]) cur[key] = {};
      cur = cur[key];
    }
  }
  const last = parts[parts.length - 1];
  const arrMatch = last.match(/^(\w+)\[(\d+)\]$/);
  if (arrMatch) {
    if (!cur[arrMatch[1]]) cur[arrMatch[1]] = [];
    cur[arrMatch[1]][parseInt(arrMatch[2])] = value;
  } else {
    cur[last] = value;
  }
}

// ─── OAUTH FLOW ────────────────────────────────────────────────────────────
function startOAuth() {
  return new Promise((resolve, reject) => {
    const popup = window.open(CONFIG.OAUTH_URL, 'oauth', 'width=600,height=700');
    if (!popup) { reject(new Error('Popup blocked')); return; }

    const handler = (e) => {
      if (!e.data || typeof e.data !== 'string') return;
      // Handshake from our proxy: 'authorizing:github'
      if (e.data === 'authorizing:github') {
        popup.postMessage('authorizing:github', e.origin || '*');
        return;
      }
      // Success: 'authorization:github:success:{token,provider}'
      const m = e.data.match(/^authorization:github:success:(.+)$/);
      if (m) {
        try {
          const data = JSON.parse(m[1]);
          window.removeEventListener('message', handler);
          popup.close();
          resolve(data.token);
        } catch (err) { reject(err); }
      }
      // Error
      const em = e.data.match(/^authorization:github:error:(.+)$/);
      if (em) {
        window.removeEventListener('message', handler);
        popup.close();
        reject(new Error(em[1]));
      }
    };
    window.addEventListener('message', handler);

    // Timeout fallback
    setTimeout(() => {
      if (popup && !popup.closed) {
        window.removeEventListener('message', handler);
        popup.close();
        reject(new Error('OAuth timeout'));
      }
    }, 120000);
  });
}

async function getUser(token) {
  const r = await fetch('https://api.github.com/user', {
    headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json' }
  });
  if (!r.ok) throw new Error('Failed to fetch user');
  return r.json();
}

// ─── GITHUB API: get/put file ─────────────────────────────────────────────
async function ghGetFile(path) {
  const r = await fetch(`https://api.github.com/repos/${CONFIG.REPO}/contents/${path}?ref=${CONFIG.BRANCH}`, {
    headers: { Authorization: 'token ' + state.token, Accept: 'application/vnd.github+json' }
  });
  if (!r.ok) throw new Error(`GH get ${path}: ${r.status}`);
  return r.json();
}

async function ghPutFile(path, contentObj, sha, message) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj, null, 2) + '\n')));
  const r = await fetch(`https://api.github.com/repos/${CONFIG.REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: 'token ' + state.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content, sha, branch: CONFIG.BRANCH })
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`GH put ${path}: ${err.message || r.status}`);
  }
  return r.json();
}

// ─── LOAD CONTENT ─────────────────────────────────────────────────────────
async function loadAllContent() {
  for (const lang of ['en', 'ru', 'zh']) {
    const file = await ghGetFile(`content/${lang}.json`);
    const json = JSON.parse(decodeURIComponent(escape(atob(file.content))));
    state.content[lang] = json;
    state.shas[lang] = file.sha;
    state.initial[lang] = JSON.parse(JSON.stringify(json));
    state.dirty[lang] = new Set();
  }
}

// ─── INJECT THE REAL SITE ─────────────────────────────────────────────────
async function loadSite() {
  const r = await fetch('/index.html');
  const html = await r.text();
  // Extract body inner
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) throw new Error('Cannot parse index.html');

  const container = document.getElementById('editor-site-root');
  container.innerHTML = match[1];

  // Re-inject main.js-like logic inline (we'll call render ourselves)
  // Remove original lang switcher if present in site — we use our own
  // (не обязательно — сайт и свой переключатель может остаться)
}

// ─── RENDER CONTENT INTO DOM WITH data-edit ATTRIBUTES ────────────────────
function renderContent() {
  const t = state.content[state.lang];
  if (!t) return;

  const renderers = {
    // простые строки
    'nav.features': '#nav-features',
    'nav.pricing': '#nav-pricing',
    'nav.tutorials': '#nav-tutorials',
    'nav.docs': '#nav-docs',
    'nav.contact': '#nav-contact',
    'nav.login': '#nav-login',
    'nav.signup': '#nav-signup',

    'hero.badge': '#hero-badge-text',
    'hero.desc': '#hero-desc',
    'hero.cta1': '#hero-cta1',
    'hero.cta2': '#hero-cta2',
    'hero.stat1n': '#hero-stat1-n',
    'hero.stat1l': '#hero-stat1-l',
    'hero.stat2n': '#hero-stat2-n',
    'hero.stat2l': '#hero-stat2-l',
    'hero.stat3n': '#hero-stat3-n',
    'hero.stat3l': '#hero-stat3-l',

    'features.tag': '#feat-tag',
    'features.title': '#feat-title',
    'features.sub': '#feat-sub',

    'how.tag': '#how-tag',
    'how.title': '#how-title',

    'pricing.tag': '#pricing-tag',
    'pricing.title': '#pricing-title',
    'pricing.sub': '#pricing-sub',
    'pricing.note': '#pricing-note',

    'tutorials.tag': '#tut-tag',
    'tutorials.title': '#tut-title',
    'tutorials.sub': '#tut-sub',

    'testimonials.tag': '#test-tag',
    'testimonials.title': '#test-title',

    'faq.tag': '#faq-tag',
    'faq.title': '#faq-title',

    'contact.tag': '#contact-tag',
    'contact.title': '#contact-title',
    'contact.sub': '#contact-sub',

    'cta.title': '#cta-title',
    'cta.sub': '#cta-sub',
    'cta.btn1': '#cta-btn1',
    'cta.btn2': '#cta-btn2',

    'footer.desc': '#footer-desc',
    'footer.rights': '#footer-rights',
  };

  // Простые маппинги: один путь → один элемент
  Object.entries(renderers).forEach(([path, selector]) => {
    const el = document.querySelector('#editor-site-root ' + selector);
    if (!el) return;
    const val = getPath(t, path);
    if (val == null) return;
    el.textContent = val;
    el.setAttribute('data-edit', '');
    el.setAttribute('data-path', path);
    el.setAttribute('contenteditable', 'true');
  });

  // Hero title (special: title1 + title2 + title3 в одном <h1>)
  const heroTitle = document.querySelector('#editor-site-root #hero-title');
  if (heroTitle && t.hero) {
    heroTitle.innerHTML =
      `<span data-edit data-path="hero.title1" contenteditable="true">${t.hero.title1}</span><br>` +
      `<span class="grad-text">` +
        `<span data-edit data-path="hero.title2" contenteditable="true">${t.hero.title2}</span> ` +
        `<span data-edit data-path="hero.title3" contenteditable="true">${t.hero.title3}</span>` +
      `</span>`;
  }

  // Списки: features, how, pricing, tutorials, testimonials, faq, contact.info
  renderList('#features-grid', t.features?.items, (item, i) => `
    <div class="card fade-up">
      <div class="feature-icon" data-edit data-path="features.items[${i}].icon" contenteditable="true">${item.icon || ''}</div>
      <div class="feature-title" data-edit data-path="features.items[${i}].title" contenteditable="true">${item.title || ''}</div>
      <p class="feature-desc" data-edit data-path="features.items[${i}].desc" contenteditable="true">${item.desc || ''}</p>
    </div>
  `);

  renderList('#steps', t.how?.steps, (s, i) => `
    <div class="step fade-up">
      <div class="step-num">${i + 1}</div>
      <div class="step-title" data-edit data-path="how.steps[${i}].title" contenteditable="true">${s.title || ''}</div>
      <p class="step-desc" data-edit data-path="how.steps[${i}].desc" contenteditable="true">${s.desc || ''}</p>
    </div>
  `);

  renderList('#pricing-grid', t.pricing?.plans, (p, i) => `
    <div class="pricing-card ${p.popular ? 'popular' : ''} fade-up">
      ${p.popular ? `<div class="popular-badge">⭐ Most Popular</div>` : ''}
      <div class="pricing-name" data-edit data-path="pricing.plans[${i}].name" contenteditable="true">${p.name || ''}</div>
      <div class="pricing-price">
        <span class="currency" data-edit data-path="pricing.plans[${i}].currency" contenteditable="true">${p.currency || ''}</span>
        <span class="amount" data-edit data-path="pricing.plans[${i}].price" contenteditable="true">${p.price || ''}</span>
        <div class="period" data-edit data-path="pricing.plans[${i}].period" contenteditable="true">${p.period || ''}</div>
      </div>
      <p class="pricing-desc" data-edit data-path="pricing.plans[${i}].desc" contenteditable="true">${p.desc || ''}</p>
      <ul class="pricing-features">
        ${(p.features || []).map((f, j) => `<li data-edit data-path="pricing.plans[${i}].features[${j}]" contenteditable="true">${f}</li>`).join('')}
        ${(p.missing || []).map((f, j) => `<li class="no" data-edit data-path="pricing.plans[${i}].missing[${j}]" contenteditable="true">${f}</li>`).join('')}
      </ul>
      <button class="btn btn-${p.popular ? 'primary' : 'secondary'}" style="width:100%;justify-content:center">
        <span data-edit data-path="pricing.plans[${i}].cta" contenteditable="true">${p.cta || ''}</span>
      </button>
    </div>
  `);

  renderList('#tutorials-grid', t.tutorials?.items, (v, i) => `
    <div class="tutorial-card fade-up">
      <div class="tutorial-thumb">
        <div class="tutorial-thumb-bg"></div>
        <div class="play-btn">▶</div>
        <div class="tutorial-duration" data-edit data-path="tutorials.items[${i}].dur" contenteditable="true">${v.dur || ''}</div>
      </div>
      <div class="tutorial-body">
        <div class="tutorial-title" data-edit data-path="tutorials.items[${i}].title" contenteditable="true">${v.title || ''}</div>
        <div class="tutorial-level">🎯 <span data-edit data-path="tutorials.items[${i}].level" contenteditable="true">${v.level || ''}</span></div>
      </div>
    </div>
  `);

  renderList('#testimonials-grid', t.testimonials?.items, (r, i) => `
    <div class="testimonial-card fade-up">
      <div class="stars">★★★★★</div>
      <p class="testimonial-text" data-edit data-path="testimonials.items[${i}].text" contenteditable="true">${r.text || ''}</p>
      <div class="testimonial-author">
        <div class="author-avatar" data-edit data-path="testimonials.items[${i}].init" contenteditable="true">${r.init || ''}</div>
        <div>
          <div class="author-name" data-edit data-path="testimonials.items[${i}].name" contenteditable="true">${r.name || ''}</div>
          <div class="author-role" data-edit data-path="testimonials.items[${i}].role" contenteditable="true">${r.role || ''}</div>
        </div>
      </div>
    </div>
  `);

  renderList('#faq-list', t.faq?.items, (f, i) => `
    <div class="faq-item" id="faq-${i}">
      <button class="faq-q" type="button">
        <span data-edit data-path="faq.items[${i}].q" contenteditable="true">${f.q || ''}</span>
        <span class="faq-q-icon">+</span>
      </button>
      <div class="faq-a" data-edit data-path="faq.items[${i}].a" contenteditable="true">${f.a || ''}</div>
    </div>
  `);

  renderList('#contact-info', t.contact?.info, (c, i) => `
    <div class="contact-item">
      <div class="contact-icon" data-edit data-path="contact.info[${i}].icon" contenteditable="true">${c.icon || ''}</div>
      <div>
        <div class="contact-label" data-edit data-path="contact.info[${i}].label" contenteditable="true">${c.label || ''}</div>
        <div class="contact-value" data-edit data-path="contact.info[${i}].value" contenteditable="true">${c.value || ''}</div>
      </div>
    </div>
  `);

  // footer lists
  ['product', 'support', 'legal'].forEach(kind => {
    renderList(`#footer-${kind}`, t.footer?.[kind], (link, i) => `
      <a href="#" data-edit data-path="footer.${kind}[${i}]" contenteditable="true">${link}</a>
    `);
  });

  // Form placeholders
  if (t.contact?.form) {
    const f = t.contact.form;
    ['name', 'email', 'subject', 'message', 'send'].forEach(key => {
      const el = document.querySelector('#editor-site-root #cf-' + key);
      if (el && f[key]) {
        el.textContent = f[key];
        el.setAttribute('data-edit', '');
        el.setAttribute('data-path', `contact.form.${key}`);
        el.setAttribute('contenteditable', 'true');
      }
    });
  }

  attachEditHandlers();
  observeFade();
}

function renderList(selector, items, fn) {
  const el = document.querySelector('#editor-site-root ' + selector);
  if (!el || !items) return;
  el.innerHTML = items.map(fn).join('');
}

function observeFade() {
  const els = document.querySelectorAll('#editor-site-root .fade-up');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

// ─── EDIT HANDLERS ────────────────────────────────────────────────────────
function attachEditHandlers() {
  document.querySelectorAll('#editor-site-root [data-edit]').forEach(el => {
    if (el._editorBound) return;
    el._editorBound = true;

    el.addEventListener('input', () => {
      const path = el.dataset.path;
      const lang = state.lang;
      const newVal = el.textContent;
      const initialVal = getPath(state.initial[lang], path);
      setPath(state.content[lang], path, newVal);
      if (String(newVal) !== String(initialVal)) {
        state.dirty[lang].add(path);
        el.classList.add('dirty');
      } else {
        state.dirty[lang].delete(path);
        el.classList.remove('dirty');
      }
      updateUI();
    });

    el.addEventListener('paste', (e) => {
      // plain-text paste only
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      document.execCommand('insertText', false, text);
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      }
    });
  });
}

// ─── UI UPDATES ──────────────────────────────────────────────────────────
function updateUI() {
  const totalDirty = ['en', 'ru', 'zh'].reduce((sum, l) => sum + (state.dirty[l]?.size || 0), 0);
  document.getElementById('editor-count').textContent = totalDirty;
  document.getElementById('editor-save-btn').disabled = totalDirty === 0;
  document.getElementById('editor-discard-btn').disabled = totalDirty === 0;

  const ind = document.getElementById('editor-changes');
  const txt = ind.querySelector('.txt');
  if (totalDirty === 0) {
    ind.classList.remove('saved');
    txt.textContent = 'No changes';
  } else {
    ind.classList.remove('saved');
    txt.textContent = totalDirty + ' unsaved';
  }
}

function showToast(msg, isError) {
  const toast = document.getElementById('editor-toast');
  toast.textContent = (isError ? '✗ ' : '✓ ') + msg;
  toast.classList.toggle('error', !!isError);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), isError ? 5000 : 3000);
}

// ─── SAVE ─────────────────────────────────────────────────────────────────
async function save() {
  const langs = ['en', 'ru', 'zh'].filter(l => state.dirty[l]?.size > 0);
  if (!langs.length) return;

  const saveBtn = document.getElementById('editor-save-btn');
  saveBtn.disabled = true;
  saveBtn.querySelector('span').textContent = 'Saving...';

  try {
    for (const lang of langs) {
      const paths = Array.from(state.dirty[lang]);
      const msg = `edit(${lang}): ${paths.slice(0, 3).join(', ')}${paths.length > 3 ? ` +${paths.length - 3} more` : ''}`;
      const result = await ghPutFile(`content/${lang}.json`, state.content[lang], state.shas[lang], msg);
      state.shas[lang] = result.content.sha;
      state.initial[lang] = JSON.parse(JSON.stringify(state.content[lang]));
      state.dirty[lang].clear();
    }
    document.querySelectorAll('#editor-site-root [data-edit].dirty').forEach(el => el.classList.remove('dirty'));
    updateUI();
    const ind = document.getElementById('editor-changes');
    ind.classList.add('saved');
    ind.querySelector('.txt').textContent = 'Saved';
    showToast('Committed to repo. Vercel deploying...');
  } catch (e) {
    showToast(e.message || 'Save failed', true);
  } finally {
    saveBtn.querySelector('span').textContent = 'Save';
    saveBtn.disabled = false;
  }
}

// ─── DISCARD ──────────────────────────────────────────────────────────────
function discard() {
  for (const lang of ['en', 'ru', 'zh']) {
    state.content[lang] = JSON.parse(JSON.stringify(state.initial[lang]));
    state.dirty[lang].clear();
  }
  renderContent();
  updateUI();
  showToast('Discarded changes');
}

// ─── LANG SWITCH ──────────────────────────────────────────────────────────
function switchLang(lang) {
  state.lang = lang;
  document.querySelectorAll('#editor-lang-switch button').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  renderContent();
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────
function logout() {
  sessionStorage.removeItem('br_edit_token');
  sessionStorage.removeItem('br_edit_user');
  location.reload();
}

// ─── BOOT ─────────────────────────────────────────────────────────────────
async function boot() {
  const loginScreen = document.getElementById('editor-login');
  const bar = document.getElementById('editor-bar');
  const hint = document.getElementById('editor-hint');
  const errEl = document.getElementById('editor-login-error');

  // Try cached token
  const cachedToken = sessionStorage.getItem('br_edit_token');
  const cachedUser = sessionStorage.getItem('br_edit_user');
  if (cachedToken && cachedUser) {
    state.token = cachedToken;
    state.user = JSON.parse(cachedUser);
  }

  document.getElementById('editor-login-btn').addEventListener('click', async () => {
    errEl.textContent = '';
    try {
      const token = await startOAuth();
      const user = await getUser(token);
      if (!CONFIG.ALLOWED_USERS.includes(user.login)) {
        errEl.textContent = `User @${user.login} is not authorized.`;
        return;
      }
      state.token = token;
      state.user = user;
      sessionStorage.setItem('br_edit_token', token);
      sessionStorage.setItem('br_edit_user', JSON.stringify(user));
      await enterEditor();
    } catch (e) {
      errEl.textContent = e.message || 'Login failed';
    }
  });

  document.getElementById('editor-save-btn').addEventListener('click', save);
  document.getElementById('editor-discard-btn').addEventListener('click', discard);
  document.getElementById('editor-logout-btn').addEventListener('click', logout);
  document.querySelectorAll('#editor-lang-switch button').forEach(btn => {
    btn.addEventListener('click', () => switchLang(btn.dataset.lang));
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    if (e.key === 'Escape') {
      const active = document.activeElement;
      if (active && active.hasAttribute('data-edit')) active.blur();
    }
  });

  if (state.token && state.user) {
    await enterEditor();
  }
}

async function enterEditor() {
  const loginScreen = document.getElementById('editor-login');
  const bar = document.getElementById('editor-bar');
  const hint = document.getElementById('editor-hint');

  try {
    // Show user
    const userBox = document.getElementById('editor-user');
    userBox.innerHTML = `<img src="${state.user.avatar_url}" alt=""> @${state.user.login}`;

    // Load all content
    await loadAllContent();
    // Load site HTML
    await loadSite();
    // Render
    renderContent();

    loginScreen.style.display = 'none';
    bar.style.display = 'flex';
    hint.style.display = 'flex';
    updateUI();
  } catch (e) {
    document.getElementById('editor-login-error').textContent = 'Load failed: ' + e.message;
    // Token may be invalid
    if (/401|403|bad credentials/i.test(e.message)) {
      sessionStorage.removeItem('br_edit_token');
      sessionStorage.removeItem('br_edit_user');
    }
  }
}

boot();

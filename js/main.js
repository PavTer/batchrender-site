// ─── CONTENT LOADER ──────────────────────────────────────────────────────────
let T = {};

async function loadContent() {
  try {
    const res = await fetch('/content.json?v=' + Date.now());
    T = await res.json();
  } catch (e) {
    console.error('Failed to load content.json', e);
  }
  init();
}

// ─── LANG STATE ─────────────────────────────────────────────────────────────
let lang = localStorage.getItem('br_lang') || 'en';

function setLang(l) {
  lang = l;
  localStorage.setItem('br_lang', l);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === l));
  renderPage();
}

// ─── RENDER PAGE ─────────────────────────────────────────────────────────────
function renderPage() {
  const t = T[lang];
  if (!t) return;
  const page = document.body.dataset.page || 'home';

  // Nav
  setT('nav-features', t.nav.features);
  setT('nav-pricing', t.nav.pricing);
  setT('nav-tutorials', t.nav.tutorials);
  setT('nav-docs', t.nav.docs);
  setT('nav-contact', t.nav.contact);
  setT('nav-login', t.nav.login);
  setT('nav-signup', t.nav.signup);

  if (page === 'home') renderHome(t);
  if (page === 'contact') renderContact(t);
  if (page === 'dashboard') renderDash(t);
}

function setT(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setH(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function renderHome(t) {
  // Hero
  setT('hero-badge-text', t.hero.badge);
  setH('hero-title', `<span>${t.hero.title1}</span><br><span class="grad-text">${t.hero.title2} ${t.hero.title3}</span>`);
  setT('hero-desc', t.hero.desc);
  setT('hero-cta1', t.hero.cta1);
  setT('hero-cta2', t.hero.cta2);
  setT('hero-stat1-n', t.hero.stat1n); setT('hero-stat1-l', t.hero.stat1l);
  setT('hero-stat2-n', t.hero.stat2n); setT('hero-stat2-l', t.hero.stat2l);
  setT('hero-stat3-n', t.hero.stat3n); setT('hero-stat3-l', t.hero.stat3l);

  // Features
  setT('feat-tag', t.features.tag);
  setT('feat-title', t.features.title);
  setT('feat-sub', t.features.sub);
  const featGrid = document.getElementById('features-grid');
  if (featGrid) featGrid.innerHTML = t.features.items.map(f => `
    <div class="card fade-up">
      <div class="feature-icon">${f.icon}</div>
      <div class="feature-title">${f.title}</div>
      <p class="feature-desc">${f.desc}</p>
    </div>`).join('');

  // How it works
  setT('how-tag', t.how.tag);
  setT('how-title', t.how.title);
  const stepsEl = document.getElementById('steps');
  if (stepsEl) stepsEl.innerHTML = t.how.steps.map((s,i) => `
    <div class="step fade-up" data-delay="${i+1}">
      <div class="step-num">${i+1}</div>
      <div class="step-title">${s.title}</div>
      <p class="step-desc">${s.desc}</p>
    </div>`).join('');

  // Pricing
  setT('pricing-tag', t.pricing.tag);
  setT('pricing-title', t.pricing.title);
  setT('pricing-sub', t.pricing.sub);
  setT('pricing-note', t.pricing.note);
  const pricingGrid = document.getElementById('pricing-grid');
  if (pricingGrid) pricingGrid.innerHTML = t.pricing.plans.map(p => `
    <div class="pricing-card ${p.popular?'popular':''} fade-up">
      ${p.popular ? `<div class="popular-badge">⭐ Most Popular</div>` : ''}
      <div class="pricing-name">${p.name}</div>
      <div class="pricing-price">
        <span class="currency">${p.currency}</span><span class="amount">${p.price}</span>
        <div class="period">${p.period}</div>
      </div>
      <p class="pricing-desc">${p.desc}</p>
      <ul class="pricing-features">
        ${p.features.map(f=>`<li>${f}</li>`).join('')}
        ${p.missing.map(f=>`<li class="no">${f}</li>`).join('')}
      </ul>
      <button class="btn btn-${p.popular?'primary':'secondary'}" style="width:100%;justify-content:center" onclick="goTo('checkout')">${p.cta}</button>
    </div>`).join('');

  // Tutorials
  setT('tut-tag', t.tutorials.tag);
  setT('tut-title', t.tutorials.title);
  setT('tut-sub', t.tutorials.sub);
  const tutGrid = document.getElementById('tutorials-grid');
  if (tutGrid) tutGrid.innerHTML = t.tutorials.items.map(v => `
    <div class="tutorial-card fade-up">
      <div class="tutorial-thumb">
        <div class="tutorial-thumb-bg"></div>
        <div class="play-btn">▶</div>
        <div class="tutorial-duration">${v.dur}</div>
      </div>
      <div class="tutorial-body">
        <div class="tutorial-title">${v.title}</div>
        <div class="tutorial-level">🎯 ${v.level}</div>
      </div>
    </div>`).join('');

  // Testimonials
  setT('test-tag', t.testimonials.tag);
  setT('test-title', t.testimonials.title);
  const testGrid = document.getElementById('testimonials-grid');
  if (testGrid) testGrid.innerHTML = t.testimonials.items.map(r => `
    <div class="testimonial-card fade-up">
      <div class="stars">★★★★★</div>
      <p class="testimonial-text">${r.text}</p>
      <div class="testimonial-author">
        <div class="author-avatar">${r.init}</div>
        <div>
          <div class="author-name">${r.name}</div>
          <div class="author-role">${r.role}</div>
        </div>
      </div>
    </div>`).join('');

  // FAQ
  setT('faq-tag', t.faq.tag);
  setT('faq-title', t.faq.title);
  const faqList = document.getElementById('faq-list');
  if (faqList) {
    faqList.innerHTML = t.faq.items.map((f,i) => `
      <div class="faq-item" id="faq-${i}">
        <button class="faq-q" onclick="toggleFaq(${i})">
          <span>${f.q}</span>
          <span class="faq-q-icon">+</span>
        </button>
        <div class="faq-a">${f.a}</div>
      </div>`).join('');
  }

  // Contact
  setT('contact-tag', t.contact.tag);
  setT('contact-title', t.contact.title);
  setT('contact-sub', t.contact.sub);
  const cInfo = document.getElementById('contact-info');
  if (cInfo) cInfo.innerHTML = t.contact.info.map(c => `
    <div class="contact-item">
      <div class="contact-icon">${c.icon}</div>
      <div>
        <div class="contact-label">${c.label}</div>
        <div class="contact-value">${c.value}</div>
      </div>
    </div>`).join('');
  const cf = t.contact.form;
  setT('cf-name', cf.name); setT('cf-email', cf.email);
  setT('cf-subject', cf.subject); setT('cf-message', cf.message);
  setT('cf-send', cf.send);
  const sub = document.getElementById('form-subject');
  if (sub) sub.innerHTML = cf.subjects.map(s=>`<option>${s}</option>`).join('');
  const inp = document.getElementById('form-subject-inp');
  if (inp) inp.placeholder = cf.subject;

  // CTA
  setT('cta-title', t.cta.title);
  setT('cta-sub', t.cta.sub);
  setT('cta-btn1', t.cta.btn1);
  setT('cta-btn2', t.cta.btn2);

  // Footer
  setT('footer-desc', t.footer.desc);
  ['footer-product','footer-support','footer-legal'].forEach((id,i) => {
    const el = document.getElementById(id);
    const arr = [t.footer.product, t.footer.support, t.footer.legal][i];
    if (el && arr) el.innerHTML = arr.map(a=>`<a href="#">${a}</a>`).join('');
  });
  setT('footer-rights', t.footer.rights);

  observeFadeUp();
}

function renderContact(t) {}
function renderDash(t) {}

// ─── SCROLL ANIMATIONS ───────────────────────────────────────────────────────
function observeFadeUp() {
  const els = document.querySelectorAll('.fade-up');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

// ─── NAV SCROLL ──────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.querySelector('.nav')?.classList.toggle('scrolled', window.scrollY > 40);
});

// ─── FAQ ────────────────────────────────────────────────────────────────────
function toggleFaq(i) {
  const item = document.getElementById('faq-'+i);
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}

// ─── MOBILE MENU ────────────────────────────────────────────────────────────
function toggleMenu() {
  document.getElementById('mobile-menu')?.classList.toggle('open');
}

// ─── NAVIGATION ─────────────────────────────────────────────────────────────
function goTo(page) {
  const pages = { home:'index.html', login:'pages/login.html', signup:'pages/register.html', dashboard:'pages/dashboard.html', pricing:'#pricing', checkout:'pages/checkout.html', contact:'#contact', docs:'pages/docs.html', tutorials:'#tutorials', changelog:'pages/changelog.html' };
  const dest = pages[page];
  if (dest && dest.startsWith('#')) { document.querySelector(dest)?.scrollIntoView({behavior:'smooth'}); }
  else if (dest) { window.location.href = dest; }
}

// ─── CONTACT FORM ───────────────────────────────────────────────────────────
function submitContact(e) {
  e.preventDefault();
  showToast(T[lang].contact.form.success, 'success');
  e.target.reset();
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg, type='info') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 4000);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
function init() {
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.addEventListener('click', () => setLang(b.dataset.lang));
  });
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  renderPage();
}

document.addEventListener('DOMContentLoaded', loadContent);

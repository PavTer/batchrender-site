// ─── TRANSLATIONS ───────────────────────────────────────────────────────────
const T = {
  en: {
    nav: { features:'Features', pricing:'Pricing', tutorials:'Tutorials', docs:'Docs', contact:'Contact', login:'Sign In', signup:'Get Started' },
    hero: {
      badge: 'Version 2.1 — Now available',
      title1: 'Batch Render.',
      title2: 'Smarter.',
      title3: 'Faster.',
      desc: 'The professional tool for batch rendering video files. Queue, automate, and process hundreds of files — while you sleep.',
      cta1: 'Get Started', cta2: 'Watch Demo',
      stat1n:'500+', stat1l:'Active users',
      stat2n:'99%', stat2l:'Satisfaction',
      stat3n:'10×', stat3l:'Faster rendering',
    },
    features: {
      tag: 'Features',
      title: 'Everything you need to render at scale',
      sub: 'Powerful, flexible, and designed for professional video workflows.',
      items: [
        { icon:'⚡', title:'Batch Queue Engine', desc:'Add unlimited files to a smart queue. Drag & drop, folder watch, or CLI.' },
        { icon:'🎛️', title:'Per-file Settings', desc:'Set codec, bitrate, resolution, and output format individually for each file.' },
        { icon:'🔄', title:'Auto Retry', desc:'Failed jobs retry automatically with configurable delay and attempt count.' },
        { icon:'📊', title:'Real-time Progress', desc:'Track every render job live with detailed progress bars, ETA, and speed.' },
        { icon:'📁', title:'Smart Output', desc:'Custom output naming patterns, folder structure, and format presets.' },
        { icon:'🔔', title:'Notifications', desc:'Get notified on completion or error via desktop alert or email webhook.' },
        { icon:'🖥️', title:'GPU Acceleration', desc:'Leverage NVENC, QuickSync, and AMD VCE for hardware-accelerated encoding.' },
        { icon:'⏱️', title:'Scheduled Rendering', desc:'Schedule batch jobs to run overnight or at off-peak hours.' },
        { icon:'📋', title:'Detailed Logs', desc:'Full render logs per job. Export to CSV for analysis.' },
      ]
    },
    pricing: {
      tag: 'Pricing',
      title: 'Simple, honest pricing',
      sub: 'One-time license. No subscriptions. Yours forever.',
      plans: [
        {
          name:'Starter', price:'29', currency:'$', period:'one-time',
          desc:'For freelancers and beginners.',
          features:['Up to 100 files/batch','Basic codec presets','Email support','1 machine license','Free updates for 1 year'],
          missing:['GPU acceleration','Scheduled rendering','Priority support','Advanced logging'],
          cta:'Buy Starter'
        },
        {
          name:'Professional', price:'79', currency:'$', period:'one-time', popular:true,
          desc:'Best for working professionals.',
          features:['Unlimited files/batch','All codec presets','GPU acceleration','Scheduled rendering','2 machine licenses','Priority email support','Free updates for 3 years','Detailed export logs'],
          missing:[],
          cta:'Buy Professional'
        },
        {
          name:'Studio', price:'149', currency:'$', period:'one-time',
          desc:'For teams and studios.',
          features:['Unlimited files/batch','All codec presets','GPU acceleration','Scheduled rendering','5 machine licenses','Priority + phone support','Lifetime free updates','Advanced logging & CSV','Team license management'],
          missing:[],
          cta:'Buy Studio'
        }
      ],
      note: '30-day money-back guarantee. No questions asked.'
    },
    contact: {
      tag: 'Contact',
      title: 'Get in touch',
      sub: "Have a question, issue, or feedback? We'll get back to you within 24 hours.",
      info: [
        { icon:'✉️', label:'Email', value:'support@batchrender.com' },
        { icon:'📍', label:'Location', value:'Available worldwide' },
        { icon:'⏰', label:'Support hours', value:'Mon–Fri, 9:00–18:00 UTC' },
      ]
    },
    footer: {
      desc:'Professional batch rendering software for video creators.',
      rights:'© 2025 BatchRender. All rights reserved.',
    }
  }
};

let lang = 'en';

function setLang(newLang) {
  lang = newLang;
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.lang-btn').forEach(b => {
    if(b.dataset.lang === newLang) b.classList.add('active');
  });
  renderPage();
}

function renderPage() {
  const t = T[lang];
  
  // Update nav
  document.querySelectorAll('[data-nav]').forEach(el => {
    const key = el.getAttribute('data-nav');
    if(t.nav[key]) el.textContent = t.nav[key];
  });
  
  // Update hero
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.getAttribute('data-key');
    const value = getNestedValue(t, key);
    if(value) el.textContent = value;
  });
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, p) => o && o[p], obj);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.addEventListener('click', () => setLang(b.dataset.lang));
  });
  renderPage();
});

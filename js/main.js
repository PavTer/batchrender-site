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
      price: '14.99',
      desc: 'Best for working professionals',
      note: '30-day money-back guarantee. No questions asked.'
    },
    contact: {
      tag: 'Contact',
      title: 'Get in touch',
      sub: "Have a question, issue, or feedback? We'll get back to you within 24 hours.",
      email: 'support@batchrender.com'
    },
    footer: {
      desc:'Professional batch rendering software for video creators.',
      rights:'© 2026 BatchRender. All rights reserved.',
    }
  },
  ru: {
    nav: { features:'Функции', pricing:'Цены', tutorials:'Уроки', docs:'Документация', contact:'Контакт', login:'Войти', signup:'Начать' },
    hero: {
      badge: 'Версия 2.1 — Доступна сейчас',
      title1: 'Пакетный рендер.',
      title2: 'Умнее.',
      title3: 'Быстрее.',
      desc: 'Профессиональный инструмент для пакетного рендеринга видеофайлов. Очередь, автоматизация и обработка сотен файлов — пока вы спите.',
      cta1: 'Начать', cta2: 'Смотреть демо',
      stat1n:'500+', stat1l:'Активных пользователей',
      stat2n:'99%', stat2l:'Удовлетворённость',
      stat3n:'10×', stat3l:'Быстрее рендеринг',
    },
    features: {
      tag: 'Функции',
      title: 'Всё необходимое для рендеринга в масштабе',
      sub: 'Мощный, гибкий и созданный для профессиональных видеорабочих процессов.',
    },
    pricing: {
      tag: 'Цены',
      title: 'Простая, честная цена',
      sub: 'Разовая лицензия. Без подписок. Ваша навсегда.',
      price: '14.99',
      desc: 'Лучший выбор для профессионалов',
      note: '30-дневная гарантия возврата денег. Без вопросов.'
    },
    contact: {
      tag: 'Контакт',
      title: 'Связаться с нами',
      sub: 'Есть вопрос, проблема или отзыв? Мы ответим в течение 24 часов.',
      email: 'support@batchrender.com'
    },
    footer: {
      desc:'Профессиональное ПО для пакетного рендеринга для создателей видео.',
      rights:'© 2026 BatchRender. Все права защищены.',
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

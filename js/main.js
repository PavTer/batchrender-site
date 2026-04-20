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
    how: {
      tag: 'How it works',
      title: 'From files to finished renders in 4 steps',
      steps: [
        { title:'Add your files', desc:'Drag & drop files or watch a folder automatically.' },
        { title:'Configure settings', desc:'Set codec, output, resolution per file or globally.' },
        { title:'Start the queue', desc:'Hit render and BatchRender handles the rest.' },
        { title:'Collect results', desc:'Finished files land exactly where you set them.' },
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
    tutorials: {
      tag: 'Video Tutorials',
      title: 'Learn BatchRender fast',
      sub: 'From installation to advanced workflows — clear video guides for every skill level.',
      items: [
        { title:'Quick Start: Install & first render', dur:'4:32', level:'Beginner' },
        { title:'Setting up your first batch queue', dur:'6:15', level:'Beginner' },
        { title:'Codec presets explained', dur:'8:44', level:'Intermediate' },
        { title:'GPU acceleration setup (NVENC)', dur:'5:20', level:'Intermediate' },
        { title:'Scheduled rendering & automation', dur:'7:01', level:'Advanced' },
        { title:'Advanced logging & export to CSV', dur:'5:55', level:'Advanced' },
      ]
    },
    testimonials: {
      tag: 'Testimonials',
      title: 'Loved by video professionals',
      items: [
        { text:'"BatchRender cut my overnight render queue from 8 hours to 40 minutes. I genuinely cannot work without it now."', name:'Marcus H.', role:'Motion Designer, Berlin', init:'MH' },
        { text:'"Finally a batch renderer that just works. Setup took 5 minutes and the GPU acceleration is a game changer."', name:'Sarah K.', role:'Post-Production, London', init:'SK' },
        { text:'"We use BatchRender across our whole studio. The team licensing and scheduled jobs are exactly what we needed."', name:'Dmitri R.', role:'VFX Studio Lead, Moscow', init:'DR' },
      ]
    },
    contact: {
      tag: 'Contact',
      title: 'Get in touch',
      sub: "Have a question, issue, or feedback? We'll get back to you within 24 hours.",
      info: [
        { icon:'✉️', label:'Email', value:'support@batchrender.com' },
        { icon:'📍', label:'Location', value:'Available worldwide' },
        { icon:'⏰', label:'Support hours', value:'Mon–Fri, 9:00–18:00 UTC' },
      ],
      form: {
        name:'Full name', email:'Email address', subject:'Subject',
        subjects:['General question','Technical support','Billing','Partnership','Other'],
        message:'Your message', send:'Send message', success:'Message sent! We\'ll reply within 24 hours.'
      }
    },
    cta: {
      title:'Ready to render smarter?',
      sub:'Join 500+ professionals who save hours every week with BatchRender.',
      btn1:'Buy Now — from $29', btn2:'Try Free Demo'
    },
    footer: {
      desc:'Professional batch rendering software for video creators.',
      product:['Features','Pricing','Changelog','Roadmap'],
      support:['Documentation','Video Tutorials','Contact Support','Refund Policy'],
      legal:['Privacy Policy','Terms of Service','EULA','Cookie Policy'],
      rights:'© 2026 BatchRender. All rights reserved.',
    }
  }
};

let currentLang = 'en';

function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.lang-btn').forEach(b => { if(b.textContent.trim().toLowerCase() === lang || (lang==='zh' && b.textContent.trim()==='中文')) b.classList.add('active'); });
  const t = T[lang];
  
  // Update all data-key elements
  document.querySelectorAll('[data-key]').forEach(el => {
    const k = el.getAttribute('data-key');
    if(t[k] !== undefined) el.innerHTML = t[k];
  });
  
  document.documentElement.lang = lang;
}

document.addEventListener('DOMContentLoaded', () => {
  setLang('en');
});

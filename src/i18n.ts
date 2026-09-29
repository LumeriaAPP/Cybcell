/**
 * Azerbaijani lives in index.html (so it is what search engines and no-JS
 * visitors see). English is kept here and swapped in by key.
 */

export type Lang = 'az' | 'en';

const en: Record<string, string> = {
  skip: 'Skip to main content',
  'nav.label': 'Main navigation',
  'nav.concept': 'Concept',
  'nav.services': 'Services',
  'nav.dialogue': 'Dialogue',
  'nav.process': 'Process',
  'nav.contact': 'Contact',

  'hud.cells': 'Cells',
  'hud.links': 'Links',
  'hud.signals': 'Signals/s',

  'hero.eyebrow': 'Cybernetic cell systems',
  'hero.l1': 'Cells',
  'hero.l2': 'talk.',
  'hero.sub': 'Systems live.',
  'hero.lede':
    'CybCell builds digital systems the way nature builds organisms. Every module makes its own decisions, talks to its neighbours and protects the whole.',
  'hero.cta': 'Start a project',
  'hero.cta2': 'How it works',
  'hero.hint': 'Tap the screen and the cells will answer',
  'hero.scroll': 'Scroll down',

  'name.eyebrow': 'What the name means',
  'name.cyb.label': 'cybernetics',
  'name.cyb.text': 'The science of control and communication in the animal and the machine. Norbert Wiener, 1948.',
  'name.cell.label': 'cell',
  'name.cell.text': 'The smallest independent unit of life. Every living thing starts as one.',
  'name.result.label': 'our approach',
  'name.result.text': 'A living cell of a digital system: it decides for itself, talks to its neighbours and protects the whole.',
  'name.claim': 'We grow software like an organism: with code, with data and with security.',

  'story.label': 'The CybCell story',
  'ch1.name': 'Cell',
  'ch1.title': 'Everything starts with one cell.',
  'ch1.body':
    'We build every system from its smallest independent unit. Each cell has its own memory, its own rules and its own job. Get one cell right and a million will work right.',
  'ch1.tech': 'Modular architecture · Clean code · Tested units',
  'ch2.name': 'Division',
  'ch2.title': 'To grow is to divide.',
  'ch2.body':
    'When load rises, the system does not collapse. It divides. Every new cell carries its parent’s genetic code: the same quality, the same security, at any scale.',
  'ch2.tech': 'Microservices · Kubernetes · Autoscaling',
  'ch3.name': 'Signal',
  'ch3.title': 'Cells talk.',
  'ch3.body':
    'A single cell is data. Cells that talk are intelligence. Our systems pass signals to each other in real time, spread the news and decide together.',
  'ch3.tech': 'APIs · Event streams · Real-time data',
  'ch4.name': 'Immunity',
  'ch4.title': 'It recognises the threat and neutralises it.',
  'ch4.body':
    'The moment a foreign element enters the network, the nearest cell raises the alarm. Its neighbours respond at once, surround the threat and isolate it. Defence is a reflex of the whole organism.',
  'ch4.tech': 'Cyber security · 24/7 SOC · Zero Trust',
  'ch5.name': 'Organism',
  'ch5.title': 'Together, they are alive.',
  'ch5.body':
    'When thousands of cells unite around one purpose, something new appears: a system that learns, adapts and heals itself. We call it CybCell.',
  'ch5.tech': 'Artificial intelligence · Self-healing infrastructure',

  'svc.eyebrow': 'Cell types',
  'svc.title': 'Every service is a specialised cell.',
  'svc.intro': 'In the body, every cell has its own job. Same with us: six specialisations, one organism.',
  'svc.1.type': 'T-lymphocyte · immune cell',
  'svc.1.title': 'Cyber security',
  'svc.1.text': 'Penetration testing, 24/7 monitoring and incident response. We recognise a threat before it gets in.',
  'svc.2.type': 'Neuron · nerve cell',
  'svc.2.title': 'Artificial intelligence',
  'svc.2.text': 'LLM integrations, computer vision and predictive analytics. Systems that learn from data.',
  'svc.3.type': 'Stem cell · becomes anything',
  'svc.3.title': 'Software engineering',
  'svc.3.text': 'Web, mobile and enterprise platforms. Products that take the shape of your business and grow with it.',
  'svc.4.type': 'Erythrocyte · resource carrier',
  'svc.4.title': 'Cloud & DevOps',
  'svc.4.text': 'Kubernetes, CI/CD and cloud migration. We deliver resources to every cell on time.',
  'svc.5.type': 'Receptor · the sensing cell',
  'svc.5.title': 'IoT & sensors',
  'svc.5.text': 'Sensor networks, edge computing and smart devices. Systems that feel the physical world.',
  'svc.6.type': 'Memory B-cell · forgets nothing',
  'svc.6.title': 'Data & analytics',
  'svc.6.text': 'Data warehouses, BI dashboards and real-time analytics. Every signal is remembered, every decision rests on facts.',

  'dlg.eyebrow': 'Live dialogue',
  'dlg.title': 'The cells are talking right now.',
  'dlg.intro':
    'Every event is a message. Cells warn each other, share the load and neutralise threats together. This stream is a simplified example of the dialogue inside our systems.',
  'dlg.l.syn': 'joining',
  'dlg.l.div': 'division',
  'dlg.l.alert': 'alarm',
  'dlg.l.heal': 'recovery',
  'dlg.path': 'network',
  'dlg.live': 'live',

  'vit.eyebrow': 'Vital signs',
  'vit.title': 'The pulse of a healthy system.',
  'vit.intro': 'We hold every system we build to the same standards.',
  'vit.1.label': 'Monitoring',
  'vit.1.text': 'Cells never sleep.',
  'vit.2.label': 'Response target',
  'vit.2.text': 'From signal to decision.',
  'vit.3.label': 'Availability target',
  'vit.3.text': 'The system is always awake.',
  'vit.4.label': 'Single points of failure',
  'vit.4.text': 'If one cell stops, another carries on.',

  'lc.eyebrow': 'Life cycle',
  'lc.title': 'How a project lives.',
  'lc.1.title': 'Diagnosis',
  'lc.1.text': 'We study your system, your risks and your goals. Treatment does not start until we know exactly where it hurts.',
  'lc.2.title': 'Genome',
  'lc.2.text': 'We plan architecture and design at the cell level. Each module’s job and connections are written down up front.',
  'lc.3.title': 'Growth',
  'lc.3.text': 'We build, test and ship in short iterations. At the end of every stage you see a working result.',
  'lc.4.title': 'Immunity',
  'lc.4.text': 'We protect, monitor and improve the live system. As long as the organism lives, we are beside it.',

  'ct.eyebrow': 'Contact',
  'ct.title': 'Let’s bring your system to life.',
  'ct.intro': 'Describe your project in a few sentences. We will read it and get back to you.',
  'ct.direct': 'Write to us directly',
  'ct.copy': 'Copy',
  'ct.copied': 'Copied',
  'ct.f.name': 'Your name',
  'ct.f.email': 'Email',
  'ct.f.company': 'Company (optional)',
  'ct.f.msg': 'About the project',
  'ct.send': 'Send a signal',
  'ct.err': 'Please fill in your name, a valid email and a few words about the project.',
  'ct.ok': 'Your email app is opening with the message ready. If it does not open, write to the address on the left.',

  'ft.tag': 'Cells talk. Systems live.',
  'ft.nav': 'Footer navigation',
  'ft.rights': 'All rights reserved.',
};

/** Strings used from script only, in both languages. */
const runtime: Record<Lang, Record<string, string>> = {
  az: {
    'ct.copied': 'Kopyalandı',
    'ct.copy': 'Kopyala',
    'ct.err': 'Adınızı, düzgün e-poçt ünvanınızı və layihə haqqında bir neçə söz yazın.',
    'ct.ok': 'E-poçt proqramınız hazır mesajla açılır. Açılmasa, soldakı ünvana birbaşa yazın.',
    'lang.switch': 'Switch to English',
  },
  en: {
    'lang.switch': 'Azərbaycan dilinə keç',
  },
};

const az = new Map<Element, string>();
const azAttr = new Map<Element, Record<string, string>>();
let current: Lang = 'az';
const listeners: ((l: Lang) => void)[] = [];

export function t(key: string) {
  return runtime[current][key] ?? (current === 'en' ? en[key] : undefined) ?? runtime.az[key] ?? key;
}

export function lang() {
  return current;
}

export function onLang(fn: (l: Lang) => void) {
  listeners.push(fn);
}

export function initI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => az.set(el, el.innerHTML));
  document.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    const rec: Record<string, string> = {};
    for (const pair of el.dataset.i18nAttr!.split(';')) {
      const [attr] = pair.split(':');
      rec[attr] = el.getAttribute(attr) ?? '';
    }
    azAttr.set(el, rec);
  });

  let saved: string | null = null;
  try {
    saved = localStorage.getItem('cybcell-lang');
  } catch {
    /* storage can be unavailable */
  }
  if (saved === 'en') setLang('en');
  else document.documentElement.lang = 'az';

  document.querySelectorAll('[data-lang-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => setLang(current === 'az' ? 'en' : 'az')),
  );
}

export function setLang(next: Lang) {
  current = next;
  document.documentElement.lang = next;
  az.forEach((azHtml, el) => {
    const key = (el as HTMLElement).dataset.i18n!;
    el.innerHTML = next === 'az' ? azHtml : en[key] ?? azHtml;
  });
  azAttr.forEach((rec, el) => {
    for (const pair of (el as HTMLElement).dataset.i18nAttr!.split(';')) {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, next === 'az' ? rec[attr] : en[key] ?? rec[attr]);
    }
  });
  document.querySelectorAll('[data-lang-toggle]').forEach((b) => b.setAttribute('aria-label', t('lang.switch')));
  try {
    localStorage.setItem('cybcell-lang', next);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(next));
}

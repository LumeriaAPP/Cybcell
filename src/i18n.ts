/**
 * Azerbaijani lives in index.html (so it is what search engines and no-JS
 * visitors see). English is kept here and swapped in by key.
 */

export type Lang = 'az' | 'en';

const en: Record<string, string> = {
  skip: 'Skip to main content',
  'nav.home': 'CybCell, back to top',
  'nav.label': 'Main navigation',
  'nav.agency': 'Agency',
  'nav.services': 'Services',
  'nav.process': 'How we work',
  'nav.contact': 'Contact',
  'nav.menu': 'Open menu',
  'nav.faces': 'Faces we work with',
  'nav.homepage': 'CybCell, home page',

  'pt.eyebrow': 'Partners',
  'pt.title': 'Brands we work with.',

  'fc.eyebrow': 'Faces',
  'fc.title': 'Faces we work with.',
  'fc.intro': 'People who tell brands’ stories and share a genuine bond with their audience. Tap any of them to bring them forward.',
  'fc.hint': 'Tap a face to bring it forward',
  'fc.close': 'Close',
  'fc.cta.eyebrow': 'For brands',
  'fc.cta.title': 'Let’s choose the right face for your brand together.',
  'fc.cta.btn': 'Write to us',

  'hero.eyebrow': 'Digital agency · Baku',
  'hero.lede': 'A digital ecosystem for your business.',
  'hero.sub': 'Strategy, brand, websites, apps, AI and marketing. All in one team.',
  'hero.cta': 'Start a project',
  'hero.cta2': 'What we do',
  'hero.hint': 'Scroll to open the doors',
  'hero.alt.l': 'Left wing of the Bosch triptych: the left half of the world inside a transparent sphere.',
  'hero.alt.r': 'Right wing of the Bosch triptych: the right half of the sphere, clouds and land.',
  'hero.credit': 'Hieronymus Bosch, The Creation of the World, c. 1490–1500. Museo del Prado, Madrid.',
  'hero.translation': 'Every great business starts with a small idea.',
  'hero.interior': 'We turn that idea into a digital business that works, sells and grows.',

  'story.label': 'The CybCell agency',
  'ch1.label': 'Agency',
  'ch1.title': 'From websites to ads, we do it all.',
  'ch1.body':
    'CybCell is a full-service digital agency. Strategy, design, websites, mobile apps, AI, marketing and hardware in one team. You run your business; we do the digital work.',
  'ch2.label': 'Integration',
  'ch2.title': 'Website, social media and sales in one system.',
  'ch2.body':
    'Your website, Instagram, app, till and ads work together. Wherever an order comes from, you see it all in one dashboard.',
  'ch3.label': 'Development',
  'ch3.title': 'From idea to finished product.',
  'ch3.body':
    'A website, an online store, a mobile app, a platform, an interactive presentation. We plan, design, build and launch, and you see the results at every stage.',
  'ch4.label': 'Marketing',
  'ch4.title': 'From ads to real sales.',
  'ch4.body':
    'Social media, Google and Meta ads, video and content. We measure every campaign and put the money into the channel that brings sales.',
  'ch5.label': 'Support',
  'ch5.title': 'Everything under watch, 24/7.',
  'ch5.body':
    'Your website, app, tills and screens are monitored day and night. When something breaks, we fix it before your customers notice.',
  'ch6.title': 'One partner, every solution.',
  'ch6.body': 'No need to hunt for separate contractors. One contract, one team, one goal: the growth of your business.',

  'svc.eyebrow': 'Services',
  'svc.title': 'One agency, every digital service.',
  'svc.intro': 'Start with a single service or hand us the whole ecosystem. Every job is done to the same standard, by one team.',
  'svc.1.title': 'Strategy and branding',
  'svc.1.text': 'Your brand’s voice, look and place in the market. Naming, logo, corporate identity, brand book.',
  'svc.2.title': 'Websites and e-commerce',
  'svc.2.text': 'Corporate sites, online stores, landing pages and admin panels. Fast, mobile and easy to find.',
  'svc.3.title': 'Mobile apps',
  'svc.3.text': 'iOS and Android apps for ordering, booking, loyalty and delivery.',
  'svc.4.title': 'AI and automation',
  'svc.4.text': 'Assistants that answer customers day and night, automatic reports, sales forecasts.',
  'svc.5.title': 'Digital marketing',
  'svc.5.text': 'Social media, Google and Meta ads, SEO, analytics. Measured campaigns tied to results.',
  'svc.6.title': 'Content and production',
  'svc.6.text': 'Photo, video, motion design and everyday content for social media.',
  'svc.7.title': '3D, AR and interactive presentations',
  'svc.7.text': '3D models, virtual tours and augmented reality that show your product before anyone holds it.',
  'svc.8.title': 'Digital hardware',
  'svc.8.text': 'Smart screens, self-service kiosks, POS systems, cameras. We choose, install and connect them.',
  'svc.9.title': 'Support and security',
  'svc.9.text': 'Round-the-clock monitoring, updates, backups and protection.',

  'sec.eyebrow': 'Industries',
  'sec.title': 'We work with every industry.',
  'sec.intro':
    'Every industry has its own language and its own customers. We learn it and build the digital side to fit the rhythm of your business.',
  'sec.1': 'Restaurants and cafés',
  'sec.2': 'Real estate and construction',
  'sec.3': 'Retail and e-commerce',
  'sec.4': 'Beauty and wellness',
  'sec.5': 'Medicine and clinics',
  'sec.6': 'Education',
  'sec.7': 'Tourism and hotels',
  'sec.8': 'Automotive',
  'sec.9': 'Logistics',
  'sec.10': 'Corporate',

  'lc.eyebrow': 'How we work',
  'lc.title': 'Results in four steps.',
  'lc.1.title': 'Discovery',
  'lc.1.text': 'We study your business, your customers and your competitors, and find where you lose time and money.',
  'lc.2.title': 'Strategy',
  'lc.2.text': 'We choose the solutions you need and agree on budget, stages and the targets we will measure.',
  'lc.3.title': 'Delivery',
  'lc.3.text': 'We design, build, shoot and install. We launch in stages and show you every step.',
  'lc.4.title': 'Growth',
  'lc.4.text': 'Marketing, analytics and support grow the system, and we double down on what works.',

  'vit.label': 'Our standards',
  'vit.1.label': 'Support',
  'vit.1.text': 'Your systems are watched at night too.',
  'vit.2.label': 'Page load target',
  'vit.2.text': 'Customers do not wait, they buy.',
  'vit.3.label': 'Availability target',
  'vit.3.text': 'Site and app are always open.',
  'vit.4.label': 'Partner',
  'vit.4.text': 'Your entire digital side in one place.',
  'vit.sec': 's',

  'lead.eyebrow': 'Leadership',
  'lead.role': 'CEO of CybCell',
  'lead.text': 'At CybCell every project is run by one team to one standard, from the first meeting to launch and the support after it.',
  'lead.cta': 'Get in touch',
  'lead.alt': 'Kamal Huseynzade, CEO of CybCell',

  'ct.eyebrow': 'Contact',
  'ct.title': 'Let’s get acquainted.',
  'ct.intro': 'Write a few sentences about your business and your goal. We will get back to you and plan the first step together.',
  'ct.mail': 'Email',
  'ct.copy': 'Copy',
  'ct.f.name': 'Your name',
  'ct.f.email': 'Email',
  'ct.f.company': 'Company (optional)',
  'ct.f.msg': 'What do you need?',
  'ct.send': 'Send',

  'ft.tag': 'A digital ecosystem for your business.',
  'ft.company': 'Company',
  'ft.write': 'Write to us',
  'ft.rights': 'All rights reserved.',
  'ft.top': 'Back to top',
};

/** Strings used from script only, in both languages. */
const runtime: Record<Lang, Record<string, string>> = {
  az: {
    'ct.copied': 'Kopyalandı',
    'ct.copy': 'Kopyala',
    'ct.err': 'Adınızı, düzgün e-poçt ünvanınızı və nəyə ehtiyacınız olduğunu yazın.',
    'ct.ok': 'E-poçt proqramınız hazır mesajla açılır. Açılmasa, hello@cybcell.az ünvanına birbaşa yazın.',
    'ct.subject': 'Layihə',
    'ct.company': 'Şirkət',
    'nav.menu': 'Menyunu aç',
    'nav.close': 'Menyunu bağla',
    'fc.demo': 'Demo',
    'fc.error': 'Üzlər hazırda yüklənmədi. Bir az sonra yenidən yoxlayın.',
    'lang.switch': 'Switch to English',
  },
  en: {
    'ct.copied': 'Copied',
    'ct.copy': 'Copy',
    'ct.err': 'Please add your name, a valid email and what you need.',
    'ct.ok': 'Your email app is opening with the message ready. If it does not, write to hello@cybcell.az.',
    'ct.subject': 'Project',
    'ct.company': 'Company',
    'nav.menu': 'Open menu',
    'nav.close': 'Close menu',
    'fc.demo': 'Demo',
    'fc.error': 'The faces could not be loaded right now. Please try again shortly.',
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

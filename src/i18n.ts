/**
 * Azerbaijani lives in index.html (so it is what search engines and no-JS
 * visitors see). English is kept here and swapped in by key.
 */

export type Lang = 'az' | 'en';

const en: Record<string, string> = {
  skip: 'Skip to main content',
  'nav.label': 'Main navigation',
  'nav.concept': 'Concept',
  'nav.services': 'Solutions',
  'nav.dialogue': 'Dialogue',
  'nav.process': 'Process',
  'nav.contact': 'Contact',

  'hud.cells': 'Cells',
  'hud.links': 'Links',
  'hud.signals': 'Signals/s',

  'hero.eyebrow': 'Cybernetic cell systems',
  'hero.l1': 'A digital ecosystem for your business.',
  'hero.l1b': 'A digital ecosystem for your business.',
  'hero.l2': 'Websites, apps, 3D, marketing.',
  'hero.lede':
    'CybCell builds digital systems the way nature builds organisms. Every module makes its own decisions, talks to its neighbours and protects the whole.',
  'hero.cta': 'Start a project',
  'hero.cta2': 'How it works',
  'hero.hint': 'Tap the screen and the cells will answer',
  'hero.scroll': 'Scroll down',

  'name.eyebrow': 'What the name means',
  'name.pos': 'noun',
  'name.cyb.label': 'cybernetics',
  'name.cyb.text': 'The science of control and communication in living things and machines. Norbert Wiener, 1948. For us: technology.',
  'name.cell.label': 'cell',
  'name.cell.text': 'The smallest unit of life. It works on its own, and joins with others to form an organism.',
  'name.result.label': 'digital ecosystem',
  'name.result.text': 'A set of solutions that takes your business digital. Website, app, 3D, AR, marketing and hardware are separate cells, and together they are a living system.',
  'name.claim': 'One partner for every digital solution. From the website to the ad campaign, from the 3D presentation to the checkout hardware, everything talks to everything else.',

  'story.label': 'The CybCell story',
  'ch1.name': 'Cell',
  'ch1.title': 'Every solution is a cell.',
  'ch1.body': 'A website, a mobile app, a 3D presentation, an ad campaign, a smart screen. Each does its own job and is strong on its own. We choose and build the ones your business needs.',
  'ch1.tech': 'Website · Mobile app · 3D · AR · Marketing · Hardware',
  'ch2.name': 'Growth',
  'ch2.title': 'As your business grows, the system grows with it.',
  'ch2.body': 'From one branch to ten, from a hundred customers to a hundred thousand. What we build does not stall under load; it divides and multiplies. A new branch, language or channel connects in days.',
  'ch2.tech': 'Scalable architecture · Cloud · Multi-branch management',
  'ch3.name': 'Integration',
  'ch3.title': 'The cells talk.',
  'ch3.body': 'The website pulls prices from the e-menu, the app sends orders to the kitchen, ad results land in the sales dashboard. You enter data once and it updates everywhere.',
  'ch3.tech': 'APIs · CRM · POS and e-menu integration',
  'ch4.name': '3D and AR',
  'ch4.title': 'Sold before it is built.',
  'ch4.body': 'A 3D sales system for developers: buyers turn the building, pick a floor and an apartment, walk inside and see what time the sun comes in. An AR menu for restaurants: the dish on the table, true to size, through the phone.',
  'ch4.tech': '3D sales system · Virtual tour · Augmented reality',
  'ch5.name': 'Marketing',
  'ch5.title': 'We turn attention into sales.',
  'ch5.body': 'Brand strategy, social media, performance ads, video and motion design. Every campaign is measured, every manat is accounted for, and the budget flows to the channel that delivers.',
  'ch5.tech': 'SMM · Performance ads · Branding · Analytics',

  'svc.eyebrow': 'Solutions',
  'svc.title': 'The six cells of the ecosystem.',
  'svc.intro': 'Order any one of them on its own. Together they give your business a complete digital ecosystem.',
  'svc.1.cell': 'Stem cell',
  'svc.1.role': 'takes any shape',
  'svc.1.title': 'Websites and platforms',
  'svc.1.text': 'Corporate sites, online stores, e-menus and admin panels. Fast, mobile-friendly and easy to find in search.',
  'svc.2.cell': 'Neuron',
  'svc.2.role': 'passes the signal instantly',
  'svc.2.title': 'Mobile apps',
  'svc.2.text': 'iOS and Android apps for ordering, booking, loyalty and delivery. Your business in your customer’s pocket.',
  'svc.3.cell': 'Photoreceptor',
  'svc.3.role': 'the cell that sees',
  'svc.3.title': '3D and AR solutions',
  'svc.3.text': '3D sales systems and virtual tours for developers, AR menus for restaurants. Show your product before anyone holds it.',
  'svc.4.cell': 'Erythrocyte',
  'svc.4.role': 'carries the message everywhere',
  'svc.4.title': 'Marketing and branding',
  'svc.4.text': 'Brand strategy, SMM, performance ads, video and motion design. Every campaign is measured and optimised.',
  'svc.5.cell': 'Memory cell',
  'svc.5.role': 'records every transaction',
  'svc.5.title': 'Digital hardware',
  'svc.5.text': 'Digital signage, self-service kiosks, POS systems, cameras and sensors. We install them, connect them and keep them running.',
  'svc.6.cell': 'T-lymphocyte',
  'svc.6.role': 'guards the system',
  'svc.6.title': 'Support and security',
  'svc.6.text': '24/7 monitoring, updates, backups and protection. Your systems keep running and you stop worrying.',

  'vw.specimen': 'Specimen',
  'vw.type': 'Type',
  'vw.state': 'State',
  'vw.live': 'active',

  'dlg.eyebrow': 'Live dialogue',
  'dlg.title': 'Your business systems are talking right now.',
  'dlg.intro': 'Website, app, e-menu, CRM, ads and kiosks talk to each other: a price changes, an order arrives, a buyer shows interest, a fault is cleared. This stream is a simplified example of the dialogue inside the ecosystem.',
  'dlg.l.syn': 'joining',
  'dlg.l.div': 'division',
  'dlg.l.alert': 'alarm',
  'dlg.l.heal': 'recovery',
  'dlg.path': 'network',
  'dlg.live': 'live',

  'vit.eyebrow': 'Standards',
  'vit.title': 'The standards we aim for.',
  'vit.intro': 'Every solution we build is checked against these numbers.',
  'vit.1.label': 'Support',
  'vit.1.text': 'Your systems are watched at night too.',
  'vit.2.label': 'Page load target',
  'vit.2.text': 'Customers do not wait, they buy.',
  'vit.3.label': 'Availability target',
  'vit.3.text': 'Site and app are always open.',
  'vit.4.label': 'Partner',
  'vit.4.text': 'Website, app, marketing and hardware in one place.',

  'lc.eyebrow': 'Life cycle',
  'lc.title': 'How we work.',
  'lc.1.title': 'Diagnosis',
  'lc.1.text': 'We study your business, your customers and your competitors, and find where you lose time and money.',
  'lc.2.title': 'Ecosystem map',
  'lc.2.text': 'We choose the cells you need: website, app, 3D, marketing, hardware. Then we plan how they will talk to each other.',
  'lc.3.title': 'Build',
  'lc.3.text': 'We design, develop and install the hardware. We launch in stages and show you results at every step.',
  'lc.4.title': 'Growth',
  'lc.4.text': 'Marketing, analytics and support grow the system. We watch the numbers and double down on what works.',

  'ct.eyebrow': 'Contact',
  'ct.title': 'Let’s bring your business to life.',
  'ct.intro': 'Describe your business and what you need in a few sentences. We will work out together which cells you need.',
  'ct.direct': 'Write to us directly',
  'ct.copy': 'Copy',
  'ct.copied': 'Copied',
  'ct.f.name': 'Your name',
  'ct.f.email': 'Email',
  'ct.f.company': 'Company (optional)',
  'ct.f.msg': 'About the project',
  'ct.send': 'Send',
  'ct.err': 'Please fill in your name, a valid email and a few words about the project.',
  'ct.ok': 'Your email app is opening with the message ready. If it does not open, write to the address shown here.',

  'ft.tag': 'A digital ecosystem for your business.',
  'ft.nav': 'Footer navigation',
  'nav.work': 'Work',
  'ch6.name': 'Support',
  'ch6.title': 'We fix problems before your customers see them.',
  'ch6.body': 'Websites, apps, kiosks and tills are watched around the clock. A fault is detected the moment it appears, isolated and removed. You get on with your business.',
  'ch6.tech': '24/7 monitoring · Technical support · Security',
  'ch7.name': 'Ecosystem',
  'ch7.title': 'Together, they are alive.',
  'ch7.body': 'When website, app, 3D, marketing and hardware unite around one goal, your business becomes a digital organism: it learns, adapts and grows. We call it CybCell.',
  'ch7.tech': 'Digital transformation · Innovation',
  'work.eyebrow': 'Sample projects',
  'work.title': 'Our solutions at work.',
  'work.intro': 'Sample projects we have built. Each is ready to be adapted to your business with the same technology.',
  'work.1.kind': 'Construction · 3D sales system',
  'work.1.text': 'An interactive 3D site for a developer. Buyers turn the building, click a floor to pick an apartment, see status, area and price, walk through it on a virtual tour and furnish the rooms to taste. A sun simulation for Baku shows when light reaches each apartment.',
  'work.1.f1': '3D apartment picker',
  'work.1.f2': 'Virtual tour',
  'work.1.f3': 'Design studio',
  'work.1.f4': 'Photo render',
  'work.1.f5': 'Sun simulation',
  'work.2.kind': 'Restaurant · Augmented reality',
  'work.2.text': 'Guests scan the QR code on the table and see the dish true to size on the table through their phone camera. No app to install: WebXR on Android, Quick Look on iPhone, a rotating 3D model on desktop.',
  'work.2.f1': 'AR menu',
  'work.2.f2': 'QR table cards',
  'work.2.f3': '3D dish models',
  'work.3.kind': 'Coffee shop · Website',
  'work.3.text': 'A parallax website. Prices are never typed by hand: the site pulls them from the e-menu and updates as soon as they change at the till. Products can be shown, hidden and reordered from the admin panel.',
  'work.3.f1': 'Live e-menu integration',
  'work.3.f2': 'Admin panel',
  'work.3.f3': 'Parallax design',
  'ft.rights': 'All rights reserved.',
  'ft.company': 'Company',
  'ft.write': 'Write to us',
};

/** Strings used from script only, in both languages. */
const runtime: Record<Lang, Record<string, string>> = {
  az: {
    'ct.copied': 'Kopyalandı',
    'ct.copy': 'Kopyala',
    'ct.err': 'Adınızı, düzgün e-poçt ünvanınızı və layihə haqqında bir neçə söz yazın.',
    'ct.ok': 'E-poçt proqramınız hazır mesajla açılır. Açılmasa, göstərilən ünvana birbaşa yazın.',
    'lang.switch': 'Switch to English',
    fig: 'Şəkil',
  },
  en: {
    'lang.switch': 'Azərbaycan dilinə keç',
    fig: 'Figure',
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

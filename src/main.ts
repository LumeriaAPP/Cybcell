import './styles.css';
import { initI18n, t } from './i18n';
import { initPaintings } from './painting';
import { initScenes, initSmooth, onRefresh, scrollToTarget } from './scenes';
import { initMenu } from './menu';
import { initPartners } from './partners';
import { initColony } from './colony';
import { initDust } from './dust';
import { touch, weak } from './device';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

initI18n();

const year = $('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

const nav = $('[data-nav]');

if (!reduced) {
  document.documentElement.classList.add('motion');
  initPaintings();
  initSmooth();
  const canvas = $<HTMLCanvasElement>('#colony');
  const colony = canvas ? initColony(canvas, onRefresh) : undefined;
  initScenes((v) => colony?.setInk(v));
  // The gold dust is a desktop nicety; phones spend those frames on the cells.
  const dust = $<HTMLCanvasElement>('[data-dust]');
  if (dust && !touch && !weak) initDust(dust);
  else dust?.remove();
} else {
  // Without the dawn scene the page is simply dark above the fold and white below it.
  $('#colony')?.remove();
  const hero = $('.hero');
  const sync = () => nav?.setAttribute('data-theme', (hero?.getBoundingClientRect().bottom ?? 0) > 40 ? 'dark' : 'light');
  addEventListener('scroll', sync, { passive: true });
  sync();
}

const menu = initMenu();

const partners = $('[data-partners]');
if (partners) initPartners(partners, reduced);

/* ------------------------------------------------------------- about flag */

const aboutFlag = $<HTMLVideoElement>('[data-about-flag]');
if (aboutFlag) {
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let inView = false;
  const syncFlag = () => {
    if (inView && !document.hidden && !motionPreference.matches) {
      void aboutFlag.play().catch(() => { /* Keep the poster if autoplay is unavailable. */ });
    } else {
      aboutFlag.pause();
    }
  };
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    syncFlag();
  }, { threshold: 0.05 }).observe(aboutFlag);
  document.addEventListener('visibilitychange', syncFlag);
  motionPreference.addEventListener('change', syncFlag);
}

/* ------------------------------------------------------------- in-page links */

for (const a of $$<HTMLAnchorElement>('a[href^="#"]')) {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')!;
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    menu.close();
    scrollToTarget(target);
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });
}

/* ------------------------------------------------------------- contact */

const EMAIL = 'hello@cybcell.az';

const copyBtn = $<HTMLButtonElement>('[data-copy]');
copyBtn?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(EMAIL);
  } catch {
    const r = document.createRange();
    r.selectNodeContents($('[data-email]')!);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(r);
    return;
  }
  copyBtn.textContent = t('ct.copied');
  setTimeout(() => (copyBtn.textContent = t('ct.copy')), 1800);
});

const form = $<HTMLFormElement>('[data-form]');
const status = $('[data-status]');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = String(data.get('name') ?? '').trim();
  const email = String(data.get('email') ?? '').trim();
  const company = String(data.get('company') ?? '').trim();
  const message = String(data.get('message') ?? '').trim();
  const bad = {
    name: !name,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email),
    message: message.length < 3,
  };
  for (const [field, invalid] of Object.entries(bad)) {
    const input = form.elements.namedItem(field);
    if (input instanceof HTMLElement) input.setAttribute('aria-invalid', String(invalid));
  }
  if (!status) return;
  if (bad.name || bad.email || bad.message) {
    status.dataset.tone = 'err';
    status.textContent = t('ct.err');
    return;
  }
  status.dataset.tone = 'ok';
  status.textContent = t('ct.ok');
  const subject = `${t('ct.subject')}: ${name}${company ? ` (${company})` : ''}`;
  const body = `${message}\n\n${name}\n${email}${company ? `\n${t('ct.company')}: ${company}` : ''}`;
  location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

import './styles.css';
import { CellEngine, SCENES, type SceneId } from './engine/cells';
import { initI18n, onLang, t } from './i18n';
import { initDialogue } from './dialogue';
import { Specimen, type SpecimenKind } from './specimen';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

initI18n();

/* ------------------------------------------------------------- the colony */

const canvas = $<HTMLCanvasElement>('#colony')!;
let engine: CellEngine | null = null;
try {
  engine = new CellEngine(canvas);
  engine.start();
} catch {
  canvas.remove();
}

/* Scroll → scene position. Each [data-scene] element's centre is a keyframe. */
interface Anchor {
  el: HTMLElement;
  scene: number;
  center: number;
}
let anchors: Anchor[] = [];

function measure() {
  anchors = $$('[data-scene]')
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { el, scene: SCENES.indexOf(el.dataset.scene as SceneId), center: r.top + scrollY + r.height / 2 };
    })
    .filter((a) => a.scene >= 0)
    .sort((a, b) => a.center - b.center);
}

function scenePosition() {
  const y = scrollY + innerHeight / 2;
  if (!anchors.length) return 0;
  if (y <= anchors[0].center) return anchors[0].scene;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (y <= b.center) return a.scene + ((y - a.center) / (b.center - a.center)) * (b.scene - a.scene);
  }
  return anchors[anchors.length - 1].scene;
}

/* --------------------------------------------------------- chrome on scroll */

const root = document.documentElement;
const nav = $('[data-nav]')!;
const rail = $('.rail')!;
const railItems = $$('[data-rail]');
const navLinks = $$<HTMLAnchorElement>('.nav__links a');
const sections = navLinks.map((a) => $(a.hash)).filter(Boolean) as HTMLElement[];
const narrow = matchMedia('(max-width: 820px)');
const stacked = matchMedia('(max-width: 960px)');
const services = $('#cells');

// The colony is only visible until the services section covers it.
let covered = false;
const syncEngine = () => (document.hidden || covered ? engine?.stop() : engine?.start());

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const s = scenePosition();
    engine?.setScene(s);
    engine?.setHeroProgress(scrollY / (innerHeight * 0.9));

    nav.toggleAttribute('data-scrolled', scrollY > 24);
    const nowCovered = !!services && services.getBoundingClientRect().top <= 0;
    if (nowCovered !== covered) {
      covered = nowCovered;
      syncEngine();
    }

    // Story rail: chapters are scenes 2..6.
    const inStory = s > 1.55 && s < 6.5;
    rail.toggleAttribute('data-visible', inStory);
    const active = Math.round(s);
    railItems.forEach((li) => li.toggleAttribute('data-active', Number(li.dataset.rail) === active));

    // Scrims keep chapter text readable over the colony.
    const story = smoothstep(1.4, 2, s) * (1 - smoothstep(6.5, 7, s));
    const organism = smoothstep(5.5, 6, s) * (1 - smoothstep(6.5, 7, s));
    if (narrow.matches) {
      root.style.setProperty('--scrim-left', '0');
      root.style.setProperty('--scrim-bottom', String(story));
    } else {
      root.style.setProperty('--scrim-left', String(story * (1 - organism)));
      root.style.setProperty('--scrim-bottom', String(organism));
    }

    pickSpecimen();

    // Current section in the nav.
    const mid = innerHeight * 0.4;
    let current: HTMLElement | undefined;
    for (const sec of sections) if (sec.getBoundingClientRect().top < mid) current = sec;
    navLinks.forEach((a) => a.setAttribute('aria-current', String(current !== undefined && a.hash === '#' + current.id)));
  });
}

function smoothstep(e0: number, e1: number, x: number) {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
}

function relayout() {
  engine?.resize();
  measure();
  onScroll();
}

measure();
onScroll();
addEventListener('scroll', onScroll, { passive: true });
let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(relayout, 150);
});
addEventListener('load', () => {
  measure();
  onScroll();
});
document.fonts?.ready.then(() => {
  engine?.refreshWord();
  measure();
  onScroll();
});
document.addEventListener('visibilitychange', syncEngine);
new ResizeObserver(() => measure()).observe(document.body);

/* ---------------------------------------------------------- the microscope */

const viewer = $('.viewer');
const viewerCanvas = $<HTMLCanvasElement>('[data-viewer-canvas]');
const specimenRows = $$('.specimen');
let pickSpecimen = () => {};

if (viewer && viewerCanvas && specimenRows.length) {
  const specimen = new Specimen(viewerCanvas);
  let active = specimenRows.find((r) => r.hasAttribute('data-active')) ?? specimenRows[0];
  let hovering = false;
  let focusTimer = 0;

  const label = () => {
    const i = specimenRows.indexOf(active) + 1;
    $('[data-viewer-no]')!.textContent = `${t('fig')} ${i}`;
    const name = $('[data-cell-name]', active)?.textContent ?? '';
    const role = $('[data-cell-role]', active)?.textContent ?? '';
    $('[data-viewer-type]')!.textContent = `${name}, ${role}`;
  };

  const activate = (row: HTMLElement) => {
    if (row === active) return;
    active.removeAttribute('data-active');
    row.setAttribute('data-active', '');
    active = row;
    // A focus pull between specimens.
    viewer.setAttribute('data-focusing', '');
    clearTimeout(focusTimer);
    focusTimer = window.setTimeout(() => {
      specimen.set(row.dataset.kind as SpecimenKind);
      label();
      viewer.removeAttribute('data-focusing');
    }, reduced ? 0 : 320);
  };

  pickSpecimen = () => {
    if (hovering || stacked.matches) return;
    const line = innerHeight * 0.48;
    let best = active;
    let bd = Infinity;
    for (const row of specimenRows) {
      const r = row.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - line);
      if (d < bd) {
        bd = d;
        best = row;
      }
    }
    activate(best);
  };

  specimenRows.forEach((row) =>
    row.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovering = true;
      activate(row);
    }),
  );
  $('[data-specimens]')!.addEventListener('pointerleave', () => (hovering = false));
  onLang(label);
  label();
  let inView = false;
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView) specimen.start();
    else specimen.stop();
  }).observe(viewer);
  // Stacked layout: the figure sits above the list and cycles on its own.
  setInterval(() => {
    if (!stacked.matches || !inView || reduced) return;
    activate(specimenRows[(specimenRows.indexOf(active) + 1) % specimenRows.length]);
  }, 4800);
}

/* ------------------------------------------------------------- dialogue */

const log = $<HTMLOListElement>('[data-dialogue]');
if (log) initDialogue(log);

/* -------------------------------------------------------------- contact */

const email = $('[data-email]')!.textContent!.trim();
const copyBtn = $<HTMLButtonElement>('[data-copy]')!;
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(email);
    copyBtn.textContent = t('ct.copied');
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('[data-email]')!);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  setTimeout(() => (copyBtn.textContent = t('ct.copy')), 1800);
});

const form = $<HTMLFormElement>('[data-form]')!;
const status = $('[data-status]')!;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const get = (k: string) => String(data.get(k) ?? '').trim();
  const fields = {
    name: get('name'),
    email: get('email'),
    company: get('company'),
    message: get('message'),
  };
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email);
  (['name', 'email', 'message'] as const).forEach((k) => {
    const input = form.elements.namedItem(k) as HTMLInputElement;
    const bad = !fields[k] || (k === 'email' && !okEmail);
    input.setAttribute('aria-invalid', String(bad));
  });
  if (!fields.name || !okEmail || !fields.message) {
    status.textContent = t('ct.err');
    status.dataset.tone = 'error';
    return;
  }
  const subject = `CybCell · ${fields.name}${fields.company ? ` (${fields.company})` : ''}`;
  const body = `${fields.message}\n\n— ${fields.name}\n${fields.email}${fields.company ? `\n${fields.company}` : ''}`;
  status.textContent = t('ct.ok');
  status.dataset.tone = 'ok';
  const rect = form.getBoundingClientRect();
  engine?.pulse(rect.left + rect.width / 2, rect.top + rect.height / 2);
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

$$('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));

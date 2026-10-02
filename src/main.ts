import './styles.css';
import { CellEngine, ACTIVE_SCENES, SCENES, type SceneId } from './engine/cells';
import { initI18n, onLang, t } from './i18n';
import { initDialogue } from './dialogue';
import { Specimen, type SpecimenKind } from './specimen';
import { initContact } from './contact';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

initI18n();

/* ------------------------------------------------------------- the colony */

const canvas = $<HTMLCanvasElement>('#colony')!;
let engine: CellEngine | null = null;
try {
  engine = new CellEngine(canvas);
  engine.start();
} catch {
  canvas.remove();
  document.documentElement.setAttribute('data-colony-unavailable', '');
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
      return { el, scene: ACTIVE_SCENES.indexOf(el.dataset.scene as (typeof ACTIVE_SCENES)[number]), center: r.top + scrollY + r.height / 2 };
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

    nav.toggleAttribute('data-scrolled', scrollY > 24);
    const nowCovered = !!services && services.getBoundingClientRect().top <= 0;
    if (nowCovered !== covered) {
      covered = nowCovered;
      syncEngine();
    }

    // The three story sections share one calm scene transition path.
    const firstStory = ACTIVE_SCENES.indexOf('single');
    const lastStory = ACTIVE_SCENES.indexOf('organism');
    const inStory = s > firstStory - 0.5 && s < lastStory + 0.5;
    rail.toggleAttribute('data-visible', inStory);
    const activeScene: SceneId = ACTIVE_SCENES[Math.round(s)];
    railItems.forEach((li) => li.toggleAttribute('data-active', Number(li.dataset.rail) === SCENES.indexOf(activeScene)));

    // Keep story copy readable while letting the illustrations breathe.
    const story = smoothstep(firstStory - 0.6, firstStory, s) * (1 - smoothstep(lastStory + 0.4, lastStory + 1, s));
    root.style.setProperty('--scrim-left', narrow.matches ? '0' : String(story));
    root.style.setProperty('--scrim-bottom', narrow.matches ? String(story) : '0');

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
  try {
    const specimen = new Specimen(viewerCanvas);
    let active = specimenRows.find((r) => r.hasAttribute('data-active')) ?? specimenRows[0];
    specimen.set(active.dataset.kind as SpecimenKind);
    let hovering = false;

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
      specimen.set(row.dataset.kind as SpecimenKind);
      label();
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
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) specimen.start();
      else specimen.stop();
    }).observe(viewer);
  } catch {
    viewer.hidden = true;
  }
}

/* ------------------------------------------------------------- dialogue */

const log = $<HTMLOListElement>('[data-dialogue]');
if (log) initDialogue(log);

/* -------------------------------------------------------------- contact */

initContact();

$$('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));

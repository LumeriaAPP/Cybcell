/**
 * "İşlədiyimiz Üzlər": the faces come from public/data/faces.json (the future admin writes
 * that file), so adding or removing a person never touches this code.
 *
 * Desktop: the portraits ride a large wheel from the bottom of the screen to the top while the
 * section is held; each one stands upright as it crosses the middle and its name shows beside it.
 * Phones and tablets: the same portraits simply follow one another.
 */
import './styles.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initI18n, onLang, t } from './i18n';
import { initSmooth } from './scenes';
import { initMenu } from './menu';

interface Face {
  name: string;
  category?: string;
  handle?: string;
  instagram?: string;
  photo: string;
  demo?: boolean;
}

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Angle between neighbouring faces on the wheel, in radians. */
const STEP = 0.6;

initI18n();
initMenu();
const year = $('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());
if (!reduced) {
  document.documentElement.classList.add('motion');
  initSmooth();
}

const esc = (s = '') => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function meta(f: Face) {
  const parts = [f.category && esc(f.category)];
  if (f.handle) {
    parts.push(f.instagram ? `<a href="${esc(f.instagram)}" target="_blank" rel="noopener">${esc(f.handle)}</a>` : esc(f.handle));
  }
  return parts.filter(Boolean).join(' · ') + (f.demo ? `<span class="demo-tag">${t('fc.demo')}</span>` : '');
}

function renderList(faces: Face[]) {
  const list = $('[data-faces-list]');
  if (!list) return;
  list.innerHTML = faces
    .map(
      (f) => `<li class="face">
        <div class="face__photo"><img src="./${esc(f.photo)}" alt="${esc(f.name)}" width="400" height="500" loading="lazy" decoding="async" /></div>
        <p class="face__name">${esc(f.name)}</p>
        <p class="face__meta">${meta(f)}</p>
      </li>`,
    )
    .join('');
  if (reduced) return;
  const items = list.querySelectorAll('.face');
  gsap.set(items, { y: 50, autoAlpha: 0 });
  ScrollTrigger.batch(items, {
    start: 'top 85%',
    onEnter: (els) => gsap.to(els, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.12, ease: 'power3.out', overwrite: true }),
    onLeaveBack: (els) => gsap.to(els, { y: 50, autoAlpha: 0, duration: 0.4, overwrite: true }),
  });
}

function wheel(faces: Face[]) {
  const section = $('[data-wheel]');
  const holder = $('[data-wheel-cards]');
  const count = $('[data-wheel-count]');
  const name = $('[data-wheel-name]');
  const info = $('[data-wheel-meta]');
  if (!section || !holder || !count || !name || !info) return;

  holder.innerHTML = faces
    .map((f) => `<div class="wheel__card"><img src="./${esc(f.photo)}" alt="${esc(f.name)}" width="400" height="500" decoding="async" /></div>`)
    .join('');
  const cards = Array.from(holder.querySelectorAll<HTMLElement>('.wheel__card'));
  section.querySelector('.wheel__ring')?.remove();
  const ring = document.createElement('div');
  ring.className = 'wheel__ring';
  section.prepend(ring);

  let active = -1;
  const show = (k: number) => {
    active = k;
    const f = faces[k];
    count.textContent = `${String(k + 1).padStart(2, '0')} / ${String(faces.length).padStart(2, '0')}`;
    name.textContent = f.name;
    info.innerHTML = meta(f);
    gsap.fromTo([count, name, info], { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out', overwrite: true });
  };

  // a = which face sits in the middle (fractional while moving). Faces after it wait below.
  const place = (a: number) => {
    const R = innerHeight * 0.62;
    const cx = innerWidth * 0.4;
    const cy = innerHeight * 0.5;
    cards.forEach((c, i) => {
      const th = (i - a) * STEP;
      const off = Math.abs(th);
      gsap.set(c, {
        x: cx - R + R * Math.cos(th),
        y: cy + R * Math.sin(th),
        rotation: (th * 180) / Math.PI,
        scale: 1 - Math.min(off, 1.4) * 0.26,
        autoAlpha: Math.max(0, 1.15 - off * 0.75),
        zIndex: 100 - Math.round(off * 20),
      });
    });
    gsap.set(ring, { width: R * 2, height: R * 2, x: cx - 2 * R, y: cy - R });
    const k = Math.min(faces.length - 1, Math.max(0, Math.round(a)));
    if (k !== active) show(k);
  };

  const state = { a: 0 };
  place(0);
  if (reduced) return;
  gsap.to(state, {
    a: faces.length - 1,
    ease: 'none',
    onUpdate: () => place(state.a),
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => '+=' + (faces.length - 1) * innerHeight * 0.45,
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: () => place(state.a),
    },
  });
  onLang(() => show(active));
}

async function start() {
  const status = $('[data-faces-status]');
  try {
    const res = await fetch('./data/faces.json', { cache: 'no-cache' });
    const data = (await res.json()) as { faces: Face[] };
    const faces = data.faces.filter((f) => f.name && f.photo);
    if (!faces.length) throw new Error('empty');
    renderList(faces);
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1081px)', () => wheel(faces));
    onLang(() => renderList(faces));
    ScrollTrigger.refresh();
  } catch {
    $('[data-wheel]')?.remove();
    if (status) {
      status.hidden = false;
      status.textContent = t('fc.error');
    }
  }
}

start();

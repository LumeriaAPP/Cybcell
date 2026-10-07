/**
 * "İşlədiyimiz Üzlər": the faces come from public/data/faces.json (the future admin writes
 * that file), so adding or removing a person never touches this code.
 *
 * All faces are on screen at once, riding a tornado: a funnel-shaped spiral, wide at the top,
 * narrow at the bottom, turning slowly by itself and faster as the page is scrolled. A tap on
 * a face brings it out of the spin, large, with the name and handle beside it.
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

/* ------------------------------------------------------------- zoom */

function zoom(faces: Face[], onOpen: (open: boolean) => void) {
  const box = $('[data-zoom]');
  const photo = $<HTMLImageElement>('[data-zoom-photo]');
  const name = $('[data-zoom-name]');
  const info = $('[data-zoom-meta]');
  const close = $<HTMLButtonElement>('[data-zoom-close]');
  if (!box || !photo || !name || !info || !close) return { open: (_i: number, _c: HTMLElement) => {} };
  let from: HTMLElement | null = null;
  let current = -1;

  const fill = (i: number) => {
    const f = faces[i];
    photo.src = `./${f.photo}`;
    photo.alt = f.name;
    name.textContent = f.name;
    info.innerHTML = meta(f);
  };

  const hide = () => {
    if (box.hidden) return;
    gsap.to(box, {
      autoAlpha: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        box.hidden = true;
        onOpen(false);
        from?.focus();
      },
    });
  };

  const open = (i: number, card: HTMLElement) => {
    from = card;
    current = i;
    fill(i);
    box.hidden = false;
    onOpen(true);
    // grow out of the card that was tapped
    const r = card.getBoundingClientRect();
    const frame = $('.fzoom__photo', box)!;
    const target = frame.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (target.left + target.width / 2);
    const dy = r.top + r.height / 2 - (target.top + target.height / 2);
    gsap.set(box, { autoAlpha: 1 });
    gsap.fromTo('.fzoom__bg', { opacity: 0 }, { opacity: 1, duration: 0.4 });
    gsap.fromTo(frame, { x: dx, y: dy, scale: r.width / target.width }, { x: 0, y: 0, scale: 1, duration: 0.7, ease: 'expo.out' });
    gsap.fromTo('.fzoom__text > *', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.06, duration: 0.5, delay: 0.25, ease: 'power3.out' });
    close.focus();
  };

  close.addEventListener('click', hide);
  box.addEventListener('click', (e) => {
    if (e.target === box || (e.target as HTMLElement).classList.contains('fzoom__bg')) hide();
  });
  addEventListener('keydown', (e) => e.key === 'Escape' && hide());
  onLang(() => current >= 0 && !box.hidden && fill(current));
  return { open };
}

/* ------------------------------------------------------------- tornado */

function tornado(faces: Face[]) {
  const section = $('[data-tornado]');
  const stage = $('[data-tornado-stage]');
  if (!section || !stage) return;

  stage.innerHTML = faces
    .map(
      (f, i) => `<button class="tcard" type="button" data-i="${i}" aria-label="${esc(f.name)}">
        <img src="./${esc(f.photo)}" alt="" width="400" height="500" decoding="async" />
      </button>`,
    )
    .join('');
  const cards = Array.from(stage.querySelectorAll<HTMLElement>('.tcard'));
  const n = cards.length;
  let paused = false;
  const z = zoom(faces, (open) => (paused = open));
  cards.forEach((c, i) => c.addEventListener('click', () => z.open(i, c)));

  let spin = 0;
  let boost = 0; // extra turn from scrolling, decays
  let last = performance.now();
  let running = false;
  let visible = false;

  const layout = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const phone = w < 720;
    const rTop = Math.min(w * (phone ? 0.36 : 0.32), 470);
    const card = Math.min(w * (phone ? 0.27 : 0.13), 190);
    return { w, h, rTop, rBottom: rTop * 0.18, card, top: h * 0.1, span: h * 0.78 };
  };
  // Card size changes layout, so it is set only when the stage resizes, never per frame.
  const size = () => {
    L = layout();
    for (const c of cards) c.style.width = `${L.card}px`;
  };
  let L = layout();
  size();
  new ResizeObserver(size).observe(stage);

  const place = () => {
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) : 0.5;
      const th = spin + k * Math.PI * 2 * 2.2; // a clean helix: 2.2 turns from top to bottom
      const r = L.rTop + (L.rBottom - L.rTop) * k;
      const depth = Math.cos(th); // 1 = front, -1 = back
      const near = (depth + 1) / 2;
      const scale = (0.58 + 0.42 * near) * (1 - 0.32 * k);
      gsap.set(cards[i], {
        x: L.w / 2 + r * Math.sin(th) - L.card / 2,
        y: L.top + k * L.span - L.card * 0.625,
        scale,
        rotationY: -Math.sin(th) * 30,
        opacity: 0.35 + 0.65 * near,
        zIndex: 1000 + Math.round(depth * 100),
      });
    }
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      spin += dt * (0.32 + boost);
      boost *= Math.pow(0.04, dt); // a scroll kick fades within about a second
      place();
    }
    if (visible) requestAnimationFrame(frame);
    else running = false;
  };
  const wake = () => {
    if (running || reduced) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) wake();
  }).observe(section);

  place();
  if (reduced) return;

  // Scrolling through the section winds the tornado up.
  let lastY = scrollY;
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + innerHeight * 1.1,
    pin: true,
    anticipatePin: 1,
    onUpdate: () => {
      boost = Math.min(4, boost + Math.abs(scrollY - lastY) * 0.004);
      lastY = scrollY;
    },
  });
}

/* ------------------------------------------------------------- list (reduced motion) */

function renderList(faces: Face[]) {
  const list = $('[data-faces-list]');
  if (!list) return;
  list.hidden = false;
  list.innerHTML = faces
    .map(
      (f) => `<li class="face">
        <div class="face__photo"><img src="./${esc(f.photo)}" alt="${esc(f.name)}" width="400" height="500" loading="lazy" decoding="async" /></div>
        <p class="face__name">${esc(f.name)}</p>
        <p class="face__meta">${meta(f)}</p>
      </li>`,
    )
    .join('');
}

async function start() {
  const status = $('[data-faces-status]');
  try {
    const res = await fetch('./data/faces.json', { cache: 'no-cache' });
    const data = (await res.json()) as { faces: Face[] };
    const faces = data.faces.filter((f) => f.name && f.photo);
    if (!faces.length) throw new Error('empty');
    if (reduced) {
      $('[data-tornado]')?.remove();
      renderList(faces);
      onLang(() => renderList(faces));
    } else {
      tornado(faces);
    }
    ScrollTrigger.refresh();
  } catch {
    $('[data-tornado]')?.remove();
    if (status) {
      status.hidden = false;
      status.textContent = t('fc.error');
    }
  }
}

start();

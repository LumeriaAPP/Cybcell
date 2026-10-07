/**
 * Scroll scenes. Lenis smooths the mouse wheel (phones keep their native scrolling),
 * GSAP ScrollTrigger drives what moves: the prologue's altarpiece opening, the dawn that turns
 * the page white, drifting text, the CEO portrait's doors and the reveals of the agency sections.
 *
 * Everything scrubbed here is transform or opacity, or a colour on one small subtree, so
 * scrolling never forces the whole page to restyle.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { touch } from './device';
import { initFall } from './fall';

gsap.registerPlugin(ScrollTrigger);
// The address bar showing and hiding on phones must not re-measure every pinned scene.
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

export let lenis: Lenis | null = null;

export function initSmooth() {
  if (touch) return; // native finger scrolling is already smooth and cheaper
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis!.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  if (import.meta.env.DEV) Object.assign(window, { __lenis: lenis, __st: ScrollTrigger });
}

export function scrollToTarget(target: number | HTMLElement) {
  if (lenis) lenis.scrollTo(target, { duration: 1.4 });
  else if (typeof target === 'number') scrollTo({ top: target, behavior: 'smooth' });
  else target.scrollIntoView({ behavior: 'smooth' });
}

export function onRefresh(fn: () => void) {
  ScrollTrigger.addEventListener('refresh', fn);
}

/* The closed altarpiece opens; Bosch's glass world parts like a dividing cell and the
   living cell of the colony stands where it was. */
function prologue() {
  if (!$('[data-hero]')) return;
  const copy = $('[data-hero-copy]');
  if (copy) initFall(copy);
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=85%', pin: true, scrub: 0.5, anticipatePin: 1 },
  });
  // The words themselves fall apart (src/fall.ts); here only the hint fades.
  tl.to('[data-hero-hint]', { autoAlpha: 0, duration: 0.1 }, 0)
    .to('.triptych__credit', { autoAlpha: 0, duration: 0.15 }, 0)
    .to('[data-wing="l"]', { rotateY: -104, ease: 'power2.in', duration: 0.62 }, 0.12)
    .to('[data-wing="r"]', { rotateY: 104, ease: 'power2.in', duration: 0.62 }, 0.12)
    .to('.wing__shade', { opacity: 0.8, ease: 'power1.in', duration: 0.62 }, 0.12)
    .to('[data-triptych]', { scale: 1.32, duration: 0.74 }, 0.08)
    .to('[data-triptych]', { autoAlpha: 0, duration: 0.14 }, 0.66)
    .set('[data-hero-interior]', { autoAlpha: 1 }, 0.5)
    .fromTo('[data-hero-interior] > *', { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.05, ease: 'power2.out', duration: 0.3 }, 0.5)
    .to({}, { duration: 0.14 });
}

/* The page's light, in two scroll-driven moves:
   dawn — while the cell multiplies, night turns to white and the colony to ink;
   dusk — as CYBCELL forms, darkness grows from the middle of the screen (a circle that inverts
   what it covers) and from there on the site is black with white type.
   One controller owns the colours so the two moves can never fight over them. */
const INK = [10, 9, 7];
const WHITE = [246, 245, 241];
const PAPER = [244, 240, 231];
const BLACK = [14, 14, 12];
const mixRgb = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
const rgb = (c: number[]) => `rgb(${c.join(',')})`;

function light(onInk: (v: number) => void) {
  const nav = $('[data-nav]');
  const meta = $<HTMLMetaElement>('meta[name="theme-color"]');
  const story = $('.story');
  const circle = $('[data-dusk]');
  const state = { dawn: 0, dusk: 0 };

  const apply = () => {
    const dark = state.dusk >= 1;
    const bg = dark ? rgb(INK) : mixRgb(INK, WHITE, state.dawn);
    const fg = dark ? rgb(PAPER) : mixRgb(PAPER, BLACK, state.dawn);
    document.body.style.backgroundColor = bg;
    if (story) {
      story.style.color = fg;
      story.style.setProperty('--story-bg', bg);
    }
    onInk(dark ? 0 : state.dawn);
    if (circle) {
      const growing = state.dusk > 0 && !dark;
      circle.style.visibility = growing ? 'visible' : 'hidden';
      circle.style.transform = `scale(${growing ? state.dusk : 0})`;
    }
    const lightNav = state.dawn > 0.55 && state.dusk < 0.5;
    nav?.setAttribute('data-theme', lightNav ? 'light' : 'dark');
    meta?.setAttribute('content', lightNav ? '#f6f5f1' : '#0a0907');
  };

  // Dawn starts only once the partners have left the screen, so they always sit on black.
  ScrollTrigger.create({
    trigger: '#partners',
    start: 'bottom 12%',
    end: () => '+=' + innerHeight * 0.8,
    onUpdate: (st) => ((state.dawn = st.progress), apply()),
    onRefresh: (st) => ((state.dawn = st.progress), apply()),
  });
  ScrollTrigger.create({
    trigger: '.chapter--organism',
    start: 'top 75%',
    end: 'top 5%',
    onUpdate: (st) => ((state.dusk = st.progress), apply()),
    onRefresh: (st) => ((state.dusk = st.progress), apply()),
  });
  apply();
}

/* Free parallax: [data-speed] > 0 travels faster than the page, < 0 lags behind it. */
function drift() {
  for (const el of $$('[data-speed]')) {
    const s = Number(el.dataset.speed);
    gsap.fromTo(
      el,
      { y: () => s * innerHeight * 0.5 },
      {
        y: () => -s * innerHeight * 0.5,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      },
    );
  }
}

/* Process: the rule above each step is drawn as the steps arrive. */
function steps() {
  const list = $('[data-steps]');
  if (!list) return;
  gsap.fromTo(
    $$('.step', list),
    { '--drawn': 0 },
    { '--drawn': 1, duration: 1.2, stagger: 0.15, ease: 'power3.inOut', scrollTrigger: { trigger: list, start: 'top 80%' } },
  );
}

/* Leadership: two page-coloured doors slide apart over the portrait, like the prologue's
   altarpiece, while the photo settles from a close-up. No pin (a held section feels like a jolt
   when it lets go): the doors finish opening just as the portrait reaches the middle of the screen. */
function lead() {
  const photo = $('.lead__photo');
  if (!photo) return;
  gsap
    .timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: { trigger: photo, start: 'top 95%', end: 'center 52%', scrub: 0.4 } })
    .fromTo('.lead__door--l', { xPercent: 0 }, { xPercent: -101, duration: 1 }, 0)
    .fromTo('.lead__door--r', { xPercent: 0 }, { xPercent: 101, duration: 1 }, 0)
    .fromTo('.lead__photo img', { scale: 1.35 }, { scale: 1, ease: 'power2.out', duration: 1.2 }, 0)
    .fromTo('.lead__shade', { opacity: 0.55 }, { opacity: 0, ease: 'power2.out', duration: 1.2 }, 0);
}

/* Every block arrives on its own, when it is actually in view (three quarters down the
   screen), and goes back when scrolled past upwards, so it plays again on the way down. */
function reveal() {
  const items = $$(
    [
      '.section-head > *',
      '.offer__row',
      '.sectors__grid header > *',
      '.sectors__grid .intro',
      '.tags li',
      '.step',
      '.stat',
      '.lead__text > *',
      '.contact__head > *',
      '.form > *',
      '.footer__top > *',
    ].join(', '),
  );
  gsap.set(items, { y: 44, autoAlpha: 0 });
  ScrollTrigger.batch(items, {
    start: 'top 78%',
    onEnter: (els) => gsap.to(els, { y: 0, autoAlpha: 1, duration: 1.1, stagger: 0.1, ease: 'power3.out', overwrite: true }),
    onLeaveBack: (els) => gsap.to(els, { y: 44, autoAlpha: 0, duration: 0.5, stagger: 0.04, ease: 'power2.in', overwrite: true }),
  });
}

export function initScenes(onInk: (v: number) => void) {
  prologue();
  light(onInk);
  drift();
  steps();
  lead();
  reveal();
  // ScrollTrigger re-measures on load by itself; only a late web-font swap needs one more.
  if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => ScrollTrigger.refresh());
}

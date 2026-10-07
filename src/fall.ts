/**
 * The prologue's words come apart as the doors open: every letter drops on its own with
 * gravity, a little drift and spin, in random order. Scrubbed by scroll, so scrolling back
 * lifts them into place again. Buttons fall whole.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { onLang } from './i18n';

const TEXT = '.eyebrow, .wordmark, .hero__lede, .hero__sub';

/** Wrap each letter in a span, keeping words unbreakable and the text readable to screen readers. */
function split(el: HTMLElement) {
  const text = el.textContent ?? '';
  el.textContent = '';
  const said = document.createElement('span');
  said.className = 'visually-hidden';
  said.textContent = text;
  el.append(said);
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      el.append(' ');
      continue;
    }
    const word = document.createElement('span');
    word.className = 'fall-w';
    word.setAttribute('aria-hidden', 'true');
    for (const ch of part) {
      const c = document.createElement('span');
      c.className = 'fall-c';
      c.textContent = ch;
      word.append(c);
    }
    el.append(word);
  }
}

/** The gold leaf is one gradient across the word; give each letter its slice of it. */
function gild(wordmark: HTMLElement) {
  const w = wordmark.offsetWidth;
  for (const c of wordmark.querySelectorAll<HTMLElement>('.fall-c')) {
    c.style.backgroundSize = `${w}px 100%`;
    c.style.backgroundPosition = `${-(c.offsetLeft - wordmark.offsetLeft)}px 0`;
  }
}

export function initFall(copy: HTMLElement) {
  let tl: gsap.core.Timeline | null = null;
  const wordmark = copy.querySelector<HTMLElement>('.wordmark');

  const build = () => {
    tl?.scrollTrigger?.kill();
    tl?.kill();
    for (const el of copy.querySelectorAll<HTMLElement>(TEXT)) if (!el.querySelector('.fall-c')) split(el);
    if (wordmark) {
      wordmark.classList.add('is-split');
      gild(wordmark);
    }
    const pieces = [...copy.querySelectorAll<HTMLElement>('.fall-c'), ...copy.querySelectorAll<HTMLElement>('.btn')];
    tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '.hero', start: 'top top', end: () => '+=' + innerHeight * 0.5, scrub: 0.4, invalidateOnRefresh: true },
    });
    for (const p of pieces) {
      const at = Math.random() * 0.7; // random order
      const big = !p.classList.contains('fall-c');
      const fall = innerHeight * (0.75 + Math.random() * 0.55);
      tl.to(p, { y: fall, ease: 'power2.in', duration: 1 }, at) // gravity: slow start, then faster
        .to(p, { x: (Math.random() - 0.5) * (big ? 80 : 140), ease: 'power1.out', duration: 1 }, at)
        .to(p, { rotation: (Math.random() - 0.5) * (big ? 50 : 300), duration: 1 }, at)
        .to(p, { autoAlpha: 0, duration: 0.25 }, at + 0.75);
    }
  };

  build();
  document.fonts?.ready.then(() => wordmark && gild(wordmark));
  ScrollTrigger.addEventListener('refresh', () => wordmark && gild(wordmark));
  // A language switch rewrites these elements; split the new words and rebuild the fall.
  onLang(() => {
    const progress = tl?.scrollTrigger?.progress ?? 0;
    build();
    tl?.progress(progress);
  });
}

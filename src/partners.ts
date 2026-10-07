/**
 * Partners, right after the prologue: three cards. Every couple of seconds one card tips over
 * backwards and shows a partner that is not on screen yet; a tap opens that partner's site.
 * Runs only while the cards are visible.
 */
import { gsap } from 'gsap';
import { lang, onLang, type Lang } from './i18n';

interface Partner {
  name: string;
  url?: string;
  about: Record<Lang, string>;
}

const PARTNERS: Partner[] = [
  { name: 'Dream Moto', url: 'https://dreammoto.az', about: { az: 'Motosiklet marketplace-i', en: 'Motorcycle marketplace' } },
  { name: 'Nova Residence', url: 'https://nova-residence-peach.vercel.app', about: { az: 'Premium yaşayış kompleksi', en: 'Premium residential complex' } },
  { name: 'Clock & Coffee', url: 'https://clockcoffee.vercel.app', about: { az: 'Taymer konseptli kofe məkanı', en: 'Timer-concept coffee house' } },
  { name: 'ZİP Academy', url: 'https://zipacademy.co', about: { az: 'eBay dropshipping təlimi', en: 'eBay dropshipping training' } },
  { name: 'O Dönər', about: { az: 'Dönər məkanı, Ağ şəhər', en: 'Döner house, White City' } },
];

const HOLD = 2200;

function fill(face: HTMLElement, i: number) {
  const p = PARTNERS[i];
  const host = p.url ? new URL(p.url).host : '';
  const inner = `<span class="pcard__no">${String(i + 1).padStart(2, '0')}</span>
    <span class="pcard__name">${p.name}</span>
    <span class="pcard__about">${p.about[lang()]}</span>
    <span class="pcard__host">${host ? `${host} <span aria-hidden="true">↗</span>` : ''}</span>`;
  face.innerHTML = p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${inner}</a>` : `<span>${inner}</span>`;
}

interface Tile {
  card: HTMLElement;
  faces: HTMLElement[];
  shows: number;
  turns: number;
}

export function initPartners(root: HTMLElement, reduced: boolean) {
  const tiles: Tile[] = Array.from(root.querySelectorAll<HTMLElement>('.pcard')).map((t, k) => ({
    card: t.querySelector<HTMLElement>('.pcard__inner')!,
    faces: Array.from(t.querySelectorAll<HTMLElement>('.pcard__face')),
    shows: k,
    turns: 0,
  }));
  if (!tiles.length) return;

  // Only the cards that are actually displayed (phones hide the last one) take part.
  const shown = () => tiles.filter((t) => t.card.offsetParent !== null);
  tiles.forEach((t) => fill(t.faces[0], t.shows));

  let next = tiles.length % PARTNERS.length;
  let turn = 0;
  let timer = 0;
  let visible = false;

  const step = () => {
    const row = shown();
    if (!row.length) return;
    const t = row[turn % row.length];
    turn++;
    // skip partners already on another tile
    for (let guard = 0; guard < PARTNERS.length && row.some((o) => o.shows === next); guard++) next = (next + 1) % PARTNERS.length;
    t.shows = next;
    next = (next + 1) % PARTNERS.length;
    t.turns++;
    fill(t.faces[t.turns % 2], t.shows);
    t.faces[t.turns % 2].removeAttribute('aria-hidden');
    t.faces[(t.turns + 1) % 2].setAttribute('aria-hidden', 'true');
    gsap.to(t.card, { rotationX: -180 * t.turns, duration: 1.1, ease: 'power3.inOut' });
  };

  const schedule = () => {
    clearTimeout(timer);
    if (!visible || reduced) return;
    timer = window.setTimeout(() => {
      step();
      schedule();
    }, HOLD);
  };

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    schedule();
  }).observe(root);
  onLang(() => tiles.forEach((t) => fill(t.faces[t.turns % 2], t.shows)));
}

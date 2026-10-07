/** Monochrome partner wordmarks in quiet, continuously moving columns. */
import { lang, onLang, type Lang } from './i18n';

interface Partner {
  name: string;
  mark: string;
  style: string;
  url?: string;
  about: Record<Lang, string>;
}

const PARTNERS: Partner[] = [
  { name: 'Dream Moto', mark: 'Dream<span>MOTO</span>', style: 'dream', url: 'https://dreammoto.az', about: { az: 'Motosiklet marketplace-i', en: 'Motorcycle marketplace' } },
  { name: 'Nova Residence', mark: 'NOVA<span>RESIDENCE</span>', style: 'nova', url: 'https://nova-residence-peach.vercel.app', about: { az: 'Premium yaşayış kompleksi', en: 'Premium residential complex' } },
  { name: 'Clock & Coffee', mark: 'Clock <em>&</em> Coffee', style: 'clock', url: 'https://clockcoffee.vercel.app', about: { az: 'Taymer konseptli kofe məkanı', en: 'Timer-concept coffee house' } },
  { name: 'ZİP Academy', mark: 'ZİP<span>ACADEMY</span>', style: 'zip', url: 'https://zipacademy.co', about: { az: 'eBay dropshipping təlimi', en: 'eBay dropshipping training' } },
  { name: 'O Dönər', mark: 'O Dönər', style: 'doner', about: { az: 'Dönər məkanı, Ağ şəhər', en: 'Döner house, White City' } },
];

function card(partner: Partner, duplicate: boolean) {
  const item = document.createElement('div');
  item.className = 'pcard';
  if (duplicate) item.setAttribute('aria-hidden', 'true');
  const mark = document.createElement(partner.url ? 'a' : 'span');
  mark.className = `pcard__mark pcard__mark--${partner.style}`;
  mark.innerHTML = partner.mark;
  mark.setAttribute('aria-label', `${partner.name}, ${partner.about[lang()]}`);
  mark.title = partner.name;
  if (mark instanceof HTMLAnchorElement && partner.url) {
    mark.href = partner.url;
    mark.target = '_blank';
    mark.rel = 'noopener noreferrer';
    if (duplicate) mark.tabIndex = -1;
  }
  item.append(mark);
  return item;
}

export function initPartners(root: HTMLElement, reduced: boolean) {
  const grid = root.querySelector<HTMLElement>('[data-partner-columns]');
  if (!grid) return;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const build = () => {
    const columns = Array.from({ length: 4 }, (_, index) => {
      const column = document.createElement('div');
      column.className = 'pcolumn';
      const track = document.createElement('div');
      track.className = 'pcolumn__track';
      const order = PARTNERS.map((_, i) => PARTNERS[(i + index * 2) % PARTNERS.length]);
      for (let copy = 0; copy < 2; copy++) {
        const group = document.createElement('div');
        group.className = 'pcolumn__group';
        order.forEach(partner => group.append(card(partner, copy > 0 || index > 0)));
        track.append(group);
      }
      column.append(track);
      return column;
    });
    grid.replaceChildren(...columns);
  };
  let inView = false;
  const sync = () => {
    root.toggleAttribute('data-partners-moving', inView && !document.hidden && !motionPreference.matches);
  };
  root.toggleAttribute('data-partners-reduced', reduced);
  build();
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  }).observe(root);
  document.addEventListener('visibilitychange', sync);
  motionPreference.addEventListener('change', () => {
    root.toggleAttribute('data-partners-reduced', motionPreference.matches);
    sync();
  });
  onLang(build);
}

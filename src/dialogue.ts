import { lang, onLang, type Lang } from './i18n';

type Kind = 'SYNC' | 'ACK' | 'ORDER' | 'LEAD' | 'TASK' | 'ADS' | 'OPT' | 'ALERT' | 'FIX' | 'OK';

type Name = Record<Lang, string> | string;

interface Line {
  kind: Kind;
  from: Name;
  to: Name;
  text: Record<Lang, string>;
}

const N = {
  menu: { az: 'e-menyu', en: 'e-menu' },
  site: { az: 'sayt', en: 'website' },
  app: { az: 'tətbiq', en: 'app' },
  kitchen: { az: 'mətbəx', en: 'kitchen' },
  tour: { az: '3D tur', en: '3D tour' },
  crm: 'CRM',
  sales: { az: 'satış', en: 'sales' },
  ads: { az: 'reklam', en: 'ads' },
  stats: { az: 'analitika', en: 'analytics' },
  kiosk: 'kiosk-3',
  support: { az: 'dəstək', en: 'support' },
  monitor: { az: 'monitorinq', en: 'monitoring' },
  all: { az: 'hamı', en: 'all' },
};

/** A day in a business ecosystem, looped. */
const SCRIPT: Line[] = [
  { kind: 'SYNC', from: N.menu, to: N.site, text: { az: 'Latte qiyməti 5.20 ₼ oldu.', en: 'Latte is now 5.20 ₼.' } },
  { kind: 'ACK', from: N.site, to: N.menu, text: { az: 'Qəbul etdim. Menyu səhifəsi yeniləndi.', en: 'Got it. Menu page updated.' } },
  { kind: 'ORDER', from: N.app, to: N.kitchen, text: { az: 'Yeni sifariş #2048: 2 latte, 1 cheesecake.', en: 'New order #2048: 2 lattes, 1 cheesecake.' } },
  { kind: 'LEAD', from: N.tour, to: N.crm, text: { az: 'Müştəri 12-ci mərtəbədəki 3 otaqlı mənzilə 4 dəqiqə baxdı.', en: 'A buyer spent 4 minutes in the 3-room flat on floor 12.' } },
  { kind: 'TASK', from: N.crm, to: N.sales, text: { az: 'Zəng planlandı: sabah 11:00.', en: 'Call scheduled: tomorrow, 11:00.' } },
  { kind: 'ADS', from: N.ads, to: N.stats, text: { az: '"Payız endirimi" kampaniyası: 1 240 klik, 86 sifariş.', en: '"Autumn sale" campaign: 1,240 clicks, 86 orders.' } },
  { kind: 'OPT', from: N.stats, to: N.ads, text: { az: 'Axşam saatları daha yaxşı satır. Büdcəni ora keçirirəm.', en: 'Evenings convert better. Moving budget there.' } },
  { kind: 'ALERT', from: N.kiosk, to: N.support, text: { az: 'Çek kağızı bitmək üzrədir.', en: 'Receipt paper is running low.' } },
  { kind: 'FIX', from: N.support, to: N.kiosk, text: { az: 'Texnik yoldadır, 20 dəqiqəyə çatır.', en: 'Technician on the way, 20 minutes.' } },
  { kind: 'OK', from: N.monitor, to: N.all, text: { az: 'Bütün sistemlər normal işləyir.', en: 'All systems running normally.' } },
];

const TAG_CLASS: Record<Kind, string> = {
  SYNC: '',
  ACK: '',
  ORDER: '',
  LEAD: '',
  TASK: '',
  ADS: '',
  OPT: '',
  OK: '',
  ALERT: 'tag--alert',
  FIX: '',
};

const MAX_LINES = 9;
const PREFILL = 5;

export function initDialogue(root: HTMLOListElement) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let clock = Date.now();
  let visible = false;
  let running = false;
  let gen = 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const stamp = () => {
    clock += 400 + Math.random() * 2200;
    const d = new Date(clock);
    const pad = (n: number, l = 2) => String(n).padStart(l, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  };

  const render = (line: Line, animate: boolean, g: number) => {
    const L = lang();
    const li = document.createElement('li');
    li.className = 'msg';
    const name = (n: Name) => (typeof n === 'string' ? n : n[L]);
    const to = name(line.to);
    li.innerHTML = `
      <span class="msg__time">${stamp()}</span>
      <span class="tag ${TAG_CLASS[line.kind]}">${line.kind}</span>
      <span class="msg__route"><b>${name(line.from)}</b> → ${to}</span>
      <span class="msg__text"></span>`;
    const text = li.querySelector<HTMLElement>('.msg__text')!;
    root.appendChild(li);
    while (root.children.length > MAX_LINES) root.firstElementChild?.remove();

    const full = line.text[L];
    if (!animate || reduced) {
      text.textContent = full;
      return Promise.resolve();
    }
    li.classList.add('msg--typing');
    return new Promise<void>((done) => {
      let n = 0;
      const step = () => {
        if (g !== gen) return done();
        n += 1 + (Math.random() < 0.3 ? 1 : 0);
        text.textContent = full.slice(0, n);
        if (n < full.length) setTimeout(step, 18 + Math.random() * 30);
        else {
          li.classList.remove('msg--typing');
          done();
        }
      };
      step();
    });
  };

  const loop = async () => {
    if (running) return;
    running = true;
    const g = gen;
    await sleep(500);
    while (visible && g === gen) {
      await render(SCRIPT[index], true, g);
      if (g !== gen) break;
      index = (index + 1) % SCRIPT.length;
      await sleep(900 + Math.random() * 900);
    }
    running = false;
    if (visible && g !== gen) loop();
  };

  const prefill = () => {
    root.innerHTML = '';
    clock = Date.now() - 20_000;
    for (let i = 0; i < PREFILL; i++) render(SCRIPT[(index + i) % SCRIPT.length], false, gen);
    index = (index + PREFILL) % SCRIPT.length;
  };

  prefill();

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) loop();
    },
    { threshold: 0.2 },
  ).observe(root);

  onLang(() => {
    gen++;
    index = (index - PREFILL + SCRIPT.length) % SCRIPT.length;
    prefill();
    if (visible) loop();
  });
}

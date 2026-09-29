import { lang, onLang, type Lang } from './i18n';

type Kind = 'SYN' | 'ACK' | 'SYNC' | 'LOAD' | 'DIV' | 'ALERT' | 'SCAN' | 'QUAR' | 'HEAL' | 'LEARN';

interface Line {
  kind: Kind;
  from: string;
  to: Record<Lang, string> | string;
  text: Record<Lang, string>;
}

const all = { az: 'hamı', en: 'all' };
const neighbours = { az: 'qonşular', en: 'neighbours' };

/** Four short scenes from a cell network's day, looped. */
const SCRIPT: Line[] = [
  { kind: 'SYN', from: '0A1F', to: { az: 'şəbəkə', en: 'network' }, text: { az: 'Salam. Yeni hüceyrəyəm, qoşulmaq istəyirəm.', en: 'Hi. I’m a new cell and I’d like to join.' } },
  { kind: 'ACK', from: '7F3A', to: '0A1F', text: { az: 'Genom yoxlanıldı. Xoş gəldin.', en: 'Genome verified. Welcome aboard.' } },
  { kind: 'SYNC', from: '0A1F', to: '7F3A', text: { az: 'Vəziyyət sinxronlaşdı: 2 048 qeyd.', en: 'State synchronised: 2,048 records.' } },
  { kind: 'LOAD', from: '7F3A', to: all, text: { az: 'Yük 84%-ə çatdı. Kömək lazımdır.', en: 'Load at 84%. I need a hand.' } },
  { kind: 'DIV', from: '7F3A', to: '7F3B', text: { az: 'Bölünürəm. Trafikin yarısını sən götür.', en: 'Dividing. You take half the traffic.' } },
  { kind: 'ACK', from: '7F3B', to: '7F3A', text: { az: 'Götürdüm. Yük indi 42%.', en: 'Got it. Load is now 42%.' } },
  { kind: 'ALERT', from: '5B2E', to: neighbours, text: { az: 'Port 443-də anomaliya. İmza tanınmır.', en: 'Anomaly on port 443. Unknown signature.' } },
  { kind: 'SCAN', from: '91C4', to: '5B2E', text: { az: 'Təsdiqlənir: eyni IP-dən 3 şübhəli sorğu.', en: 'Confirmed: 3 suspicious requests from one IP.' } },
  { kind: 'QUAR', from: '5B2E', to: 'firewall', text: { az: 'Mənbə karantinə alındı.', en: 'Source quarantined.' } },
  { kind: 'HEAL', from: '91C4', to: all, text: { az: 'Təhlükə zərərsizləşdirildi. Normal rejim.', en: 'Threat neutralised. Back to normal.' } },
  { kind: 'LEARN', from: 'E00D', to: '5B2E', text: { az: 'Bu imzanı yadda saxladım.', en: 'I’ve memorised that signature.' } },
  { kind: 'SYNC', from: 'E00D', to: all, text: { az: 'Yeni qayda paylandı. Növbəti cəhd 12 ms-də bloklanacaq.', en: 'New rule shared. Next attempt gets blocked in 12 ms.' } },
];

const TAG_CLASS: Record<Kind, string> = {
  SYN: '',
  ACK: '',
  SYNC: '',
  HEAL: '',
  LEARN: '',
  LOAD: 'tag--div',
  DIV: 'tag--div',
  ALERT: 'tag--alert',
  SCAN: 'tag--alert',
  QUAR: 'tag--alert',
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
    const to = typeof line.to === 'string' ? (line.to === 'firewall' ? line.to : `C·${line.to}`) : line.to[L];
    li.innerHTML = `
      <span class="msg__time">${stamp()}</span>
      <span class="tag ${TAG_CLASS[line.kind]}">${line.kind}</span>
      <span class="msg__route"><b>C·${line.from}</b> → ${to}</span>
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

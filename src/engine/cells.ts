/**
 * CybCell — living cell engine.
 *
 * A fixed canvas renders a population of cells that morph between "scenes"
 * as the page scrolls. Cells divide (spawn from their parent), link to their
 * neighbours and pass signals along those links, forward them, react to an
 * intruder and finally assemble into the company name.
 */

export const SCENES = [
  'hero',
  'name',
  'single',
  'division',
  'signal',
  'building',
  'marketing',
  'immune',
  'organism',
  'ambient',
] as const;
export type SceneId = (typeof SCENES)[number];

type RGB = readonly [number, number, number];
// Cells in warm pearl, signals in leaf gold, red only for a threat. On the white page the
// engine blends to the ink palette itself (a CSS filter on a full-screen canvas is costly on phones).
const PEARL: RGB = [236, 230, 216];
const AMBER: RGB = [241, 216, 145];
const ALARM: RGB = [229, 72, 77];
const WHITE: RGB = [255, 255, 255];
const PEARL_INK: RGB = [30, 28, 24];
const AMBER_INK: RGB = [128, 96, 36];
const ALARM_INK: RGB = [196, 44, 52];
const WHITE_INK: RGB = [14, 14, 12];

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Cell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  heat: number;
  flash: number;
  seed: number;
  seed2: number;
  hx: number; // hero scatter, normalised 0..1
  hy: number;
  nx: number; // network layout, normalised -1..1
  ny: number;
  baseR: number;
  netR: number;
  tint: number; // 0 = pearl, 1 = amber
  nb: number[]; // neighbours this frame
  swarm: number; // rank in the immune swarm, -1 if not part of it
  word: number; // index into the organism word points, -1 if unused
}

interface Target {
  x: number;
  y: number;
  r: number;
  a: number;
  heat: number;
}

interface Signal {
  from: number;
  to: number; // -1 = the pointer
  t: number;
  dur: number;
  hops: number;
  kind: 0 | 1 | 2; // pearl / amber / alarm
}

interface Scene {
  fn: (c: Cell, i: number, q: number, out: Target) => void;
  link: (q: number) => number; // link distance in px
  linkAlpha: number;
  rate: (q: number) => number; // signals per second
}

export interface EngineStats {
  cells: number;
  links: number;
  sps: number;
}

export class CellEngine {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private unit = 0;
  private cx = 0;
  private cy = 0;
  private mobile = false;
  private cells: Cell[] = [];
  private signals: Signal[] = [];
  private waves: { x: number; y: number; t: number }[] = [];
  private pointer = { x: -9999, y: -9999, active: false, pulse: 0 };
  private sprites: Record<'p' | 's' | 'a', HTMLCanvasElement>;
  private scenes: Scene[];
  private phyllo: { x: number; y: number }[] = [];
  private phylloCentroid: { x: number; y: number }[] = [];
  private wordPts: { x: number; y: number }[] = [];
  private netSpacing = 40;
  private rx = 200;
  private ry = 200;
  private intruder = { x: 0, y: 0, scale: 0, alpha: 0, fx: 0, fy: 0 };
  private alarm = 0;
  private alarmWave = 0;
  private swarmPhase = 0;
  private sTarget = 0;
  private s = 0;
  private time = 0;
  private last = 0;
  private bootAt = 0;
  private raf = 0;
  private running = false;
  private spawnAcc = 0;
  private arrivals = 0;
  private statsClock = 0;
  private reduced: boolean;
  private tmpA: Target = { x: 0, y: 0, r: 0, a: 0, heat: 0 };
  private tmpB: Target = { x: 0, y: 0, r: 0, a: 0, heat: 0 };
  readonly stats: EngineStats = { cells: 0, links: 0, sps: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.spritesLight = { p: makeSprite(PEARL), s: makeSprite(AMBER), a: makeSprite(ALARM) };
    this.spritesInk = { p: makeSprite(PEARL_INK), s: makeSprite(AMBER_INK), a: makeSprite(ALARM_INK) };
    this.sprites = this.spritesLight;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 3;
    const touch = matchMedia('(pointer: coarse)').matches;
    this.q = weak ? 0.5 : touch ? 0.75 : 1;
    this.dprMax = weak ? 1 : touch ? 1.5 : 2;
    // Weak devices animate the colony at an even 30 fps rather than a ragged 40-60.
    this.halfRate = weak;
    this.scenes = this.buildScenes();
    this.resize();
    this.bindEvents();
  }

  /* ------------------------------------------------------------------ public */

  /** Continuous scene position: 0 = hero … SCENES.length - 1 = ambient. */
  setScene(s: number) {
    this.sTarget = clamp(s, 0, SCENES.length - 1);
  }

  /** 0 = light cells on the dark prologue, 1 = ink cells on the white page. */
  private ink = 0;
  private cPearl: RGB = PEARL;
  private cAmber: RGB = AMBER;
  private cAlarm: RGB = ALARM;
  private cHi: RGB = WHITE;
  private hi = '#fff';
  private add: GlobalCompositeOperation = 'lighter';
  private spritesLight!: Record<'p' | 's' | 'a', HTMLCanvasElement>;
  private spritesInk!: Record<'p' | 's' | 'a', HTMLCanvasElement>;

  setInk(v: number) {
    v = clamp(v);
    if (v === this.ink) return;
    this.ink = v;
    this.cPearl = mix(PEARL, PEARL_INK, v);
    this.cAmber = mix(AMBER, AMBER_INK, v);
    this.cAlarm = mix(ALARM, ALARM_INK, v);
    this.cHi = mix(WHITE, WHITE_INK, v);
    this.hi = rgba(this.cHi, 1);
    // Light adds up on black; ink simply lays over white.
    const dark = v >= 0.5;
    this.add = dark ? 'source-over' : 'lighter';
    this.sprites = dark ? this.spritesInk : this.spritesLight;
  }

  /* Rendering budget. q = 1 draws every particle; phones start lower, and if frames run slow
     the engine first drops to 1x pixels, then thins the particles further. */
  private q = 1;
  private dprMax = 2;
  private halfRate = false;
  private skipFrame = false;
  private frameMs = 16;
  private slowFrames = 0;

  private watch(ms: number) {
    if (ms > 250) return; // a tab switch or a hitch, not a trend
    this.frameMs += (ms - this.frameMs) * 0.05;
    if (this.frameMs < (this.halfRate ? 45 : 24)) {
      this.slowFrames = 0;
      return;
    }
    if (++this.slowFrames < 45) return;
    this.slowFrames = 0;
    this.frameMs = 16;
    if (this.dpr > 1) {
      // Only the backing store changes; geometry is in CSS pixels, so nothing is re-sampled.
      this.dprMax = this.dpr = 1;
      this.canvas.width = Math.round(this.w);
      this.canvas.height = Math.round(this.h);
    } else {
      this.q = Math.max(0.3, this.q * 0.7);
    }
  }

  /** Every n-th point of the big point clouds, from the budget. */
  private get stride() {
    return Math.max(1, Math.round(1 / this.q));
  }

  /** Go to a scene without the morph (first paint). */
  jump(s: number) {
    this.s = this.sTarget = clamp(s, 0, SCENES.length - 1);
  }

  /** Current weight (0..1) of a given scene in the blend. */
  private dust: { u: number; arm: number; j: number; rj: number; s: number; a: number }[] = [];

  private wordDust: { x: number; y: number; sx: number; sy: number; s: number; a: number; delay: number }[] = [];

  /** The organism word as fine particles that gather from the dark. */
  private drawWordDust(weight: number) {
    if (weight < 0.01 || !this.wordDust.length) return;
    const ctx = this.ctx;
    const tw = this.reduced ? 0 : this.time;
    ctx.fillStyle = this.hi;
    for (let k = 0; k < this.wordDust.length; k += this.stride) {
      const d = this.wordDust[k];
      const g = clamp((weight - d.delay) / (1 - d.delay));
      const e = 1 - Math.pow(1 - g, 3);
      const x = d.sx + (d.x - d.sx) * e;
      const y = d.sy + (d.y - d.sy) * e;
      ctx.globalAlpha = g * d.a * (0.8 + 0.2 * Math.sin(tw * 1.7 + k));
      ctx.fillRect(x - d.s / 2, y - d.s / 2, d.s, d.s);
    }
    ctx.globalAlpha = 1;
  }

  private heroWord: { x: number; y: number; vx: number; vy: number }[] = [];
  private heroMask: { data: Uint8Array; W: number; H: number; ox: number; oy: number } | null = null;
  private heroP = 0;
  private heroPTarget = 0;

  /** 0 = the name written in stardust, 1 = the stardust turned into a spiral galaxy. */
  setHeroProgress(p: number) {
    this.heroPTarget = clamp(p);
  }

  /** Points that fill the word "CybCell", centred on screen. */
  private sampleHeroWord() {
    const off = document.createElement('canvas');
    const g = off.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    const maxW = this.mobile ? this.w * 0.84 : Math.min(this.w * 0.62, 980);
    const font = (px: number) => `600 ${px}px "Cormorant Garamond", Georgia, serif`;
    g.font = font(100);
    const fs = (100 * maxW) / g.measureText('CybCell').width;
    const W = Math.ceil(maxW);
    const H = Math.ceil(fs * 1.25);
    off.width = W;
    off.height = H;
    g.font = font(fs);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText('CybCell', W / 2, H / 2);
    const data = g.getImageData(0, 0, W, H).data;
    const r = rng(0xc0de);
    const pts: { x: number; y: number; vx: number; vy: number }[] = [];
    const step = Math.max(1.3, Math.sqrt((W * H * 0.3) / 3600));
    for (let y = 0; y < H; y += step)
      for (let x = 0; x < W; x += step) {
        const jx = x + (r() - 0.5) * step;
        const jy = y + (r() - 0.5) * step;
        const xi = jx | 0;
        const yi = jy | 0;
        if (xi < 0 || yi < 0 || xi >= W || yi >= H || data[(yi * W + xi) * 4 + 3] < 128) continue;
        const va = r() * TAU;
        const sp = 4 + r() * 10;
        pts.push({ x: jx + this.w / 2 - W / 2, y: jy + this.h / 2 - H / 2, vx: Math.cos(va) * sp, vy: Math.sin(va) * sp });
      }
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    this.heroWord = pts;
    const alpha = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) alpha[i] = data[i * 4 + 3];
    this.heroMask = { data: alpha, W, H, ox: this.w / 2 - W / 2, oy: this.h / 2 - H / 2 };
  }

  /* ------------------------------------------- building & marketing scenes */

  /** Local progress (0..1) and blend weight of a scene. */
  private sceneState(id: SceneId) {
    const k = SCENES.indexOf(id);
    const { a, b, t, qa, qb } = this.blend();
    const w = (a === k ? 1 - t : 0) + (b === k ? t : 0);
    const q = a === k ? qa : b === k ? qb : a > k ? 1 : 0;
    return { w, q };
  }

  private tower: { x: number; y: number; z: number; f: number; s: number; sx: number; sy: number }[] = [];
  private towerNodes: number[] = [];
  private readonly FLOORS = 14;

  /** A residential tower as a point cloud: floor slabs and facade mullions. */
  private buildTower() {
    const r = rng(0x70e7);
    const W = 1;
    const D = 0.62;
    const hF = 0.1;
    const pts: typeof this.tower = [];
    const perim = (t: number): [number, number] => {
      const P = 2 * (W + D);
      let d = (t % 1) * P;
      if (d < W) return [-W / 2 + d, -D / 2];
      d -= W;
      if (d < D) return [W / 2, -D / 2 + d];
      d -= D;
      if (d < W) return [W / 2 - d, D / 2];
      d -= W;
      return [-W / 2, D / 2 - d];
    };
    const start = () => [(r() - 0.5) * 2.4, -0.6 - r() * 0.8] as const;
    for (let f = 0; f <= this.FLOORS; f++) {
      const y = f * hF;
      const n = 130;
      for (let i = 0; i < n; i++) {
        const [x, z] = perim(i / n + r() * 0.002);
        const [sx, sy] = start();
        pts.push({ x, y, z, f, s: 0.9 + r() * 0.6, sx, sy });
      }
      if (f === this.FLOORS) break;
      // Corner columns, drawn dense so the silhouette reads.
      for (const [cxp, czp] of [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]])
        for (let j = 1; j < 8; j++) {
          const [sx, sy] = start();
          pts.push({ x: cxp, y: y + (j / 8) * hF, z: czp, f, s: 1.3, sx, sy });
        }
      // Lit windows scattered over the facades.
      for (let i = 0; i < 9; i++) {
        const [x, z] = perim(r());
        const [sx, sy] = start();
        pts.push({ x, y: y + hF * (0.35 + r() * 0.3), z, f, s: 2, sx, sy });
      }
      // Mullions: short vertical runs between this slab and the next.
      const cols = 52;
      for (let i = 0; i < cols; i++) {
        const [x, z] = perim(i / cols);
        for (let j = 1; j <= 3; j++) {
          const [sx, sy] = start();
          pts.push({ x, y: y + (j / 4) * hF, z, f, s: 0.7 + r() * 0.4, sx, sy });
        }
      }
    }
    // Rooftop plant room.
    for (let i = 0; i < 90; i++) {
      const t = i / 90;
      const x = t < 0.25 ? -0.2 + t * 1.6 : t < 0.5 ? 0.2 : t < 0.75 ? 0.2 - (t - 0.5) * 1.6 : -0.2;
      const z = t < 0.25 ? -0.12 : t < 0.5 ? -0.12 + (t - 0.25) * 0.96 : t < 0.75 ? 0.12 : 0.12 - (t - 0.75) * 0.96;
      const [sx, sy] = start();
      pts.push({ x, y: this.FLOORS * hF + 0.08, z, f: this.FLOORS, s: 1, sx, sy });
    }
    this.tower = pts;
    // Cells sit on slab points as bright nodes.
    this.towerNodes = [];
    const n = this.cells.length;
    for (let i = 0; i < n; i++) this.towerNodes.push(Math.floor(((i * 0.61803398875) % 1) * pts.length));
  }

  private towerFrame() {
    const S = ((this.mobile ? 0.32 : 0.52) * this.h) / 1.4;
    const A = (this.reduced ? 0 : this.time * 0.18) + 0.65;
    return { S, cosA: Math.cos(A), sinA: Math.sin(A), baseY: this.cy + 0.72 * S, cx: this.cx };
  }

  private towerProject(i: number, fr: ReturnType<CellEngine['towerFrame']>) {
    const p = this.tower[i];
    const x1 = p.x * fr.cosA - p.z * fr.sinA;
    const z1 = p.x * fr.sinA + p.z * fr.cosA;
    return { x: fr.cx + x1 * fr.S, y: fr.baseY - p.y * fr.S + z1 * fr.S * 0.32, depth: clamp((z1 + 0.6) / 1.2) };
  }

  /** How far the tower has risen: floors appear one after another. */
  private towerBuilt(q: number) {
    return clamp(q * 1.8) * (this.FLOORS + 1.5);
  }

  private drawTower(weight: number, q: number) {
    if (weight < 0.01) return;
    if (!this.tower.length) this.buildTower();
    const ctx = this.ctx;
    const fr = this.towerFrame();
    const built = this.towerBuilt(q);
    ctx.fillStyle = this.hi;
    const st = this.stride;
    for (let i = 0; i < this.tower.length; i += st) {
      const p = this.tower[i];
      const g = clamp(built - p.f);
      if (g <= 0) continue;
      const e = 1 - Math.pow(1 - g, 3);
      const tp = this.towerProject(i, fr);
      const sx = fr.cx + p.sx * fr.S;
      const sy = fr.baseY + p.sy * fr.S * -0.2 + fr.S * 0.4;
      const x = sx + (tp.x - sx) * e;
      const y = sy + (tp.y - sy) * e;
      // The floor being laid glows brighter for a moment.
      const fresh = g < 1 ? 0.35 : 0;
      const lit = p.s >= 2 ? 0.5 + 0.5 * Math.sin((this.reduced ? 0 : this.time) * 0.8 + i) : 0;
      ctx.globalAlpha = clamp(weight * (0.3 + 0.7 * tp.depth + fresh + lit) * e);
      ctx.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  private chart: { x: number; y: number; bar: number; hr: number; s: number }[] = [];
  private chartLine: { x: number; y: number }[] = [];
  private readonly BARS = [0.2, 0.28, 0.26, 0.4, 0.52, 0.68, 0.9];

  /** A rising bar chart in stardust with a trend line through the bar tops. */
  private buildChart() {
    const r = rng(0xc4a7);
    const Wc = this.mobile ? this.w * 0.84 : Math.min(this.w * 0.44, 640);
    const Hc = this.mobile ? this.h * 0.3 : this.h * 0.5;
    const x0 = this.cx - Wc / 2;
    const y0 = this.cy + Hc / 2;
    const slot = Wc / this.BARS.length;
    const bw = slot * 0.5;
    const pts: typeof this.chart = [];
    const step = Math.max(3, Math.sqrt((Wc * Hc * 0.45) / 3000));
    this.BARS.forEach((h, k) => {
      const bx = x0 + slot * k + (slot - bw) / 2;
      const bh = h * Hc;
      for (let y = 0; y < bh; y += step)
        for (let x = 0; x < bw; x += step) {
          const edge = x < step || x > bw - step * 1.5 || y > bh - step * 1.5;
          if (!edge && r() < 0.35) continue;
          pts.push({ x: bx + x + (r() - 0.5) * step * 0.6, y: y0 - y - (r() - 0.5) * step * 0.6, bar: k, hr: y / bh, s: edge ? 1.3 : 0.8 + r() * 0.4 });
        }
    });
    // Baseline and faint guides.
    for (let x = 0; x < Wc; x += 3) pts.push({ x: x0 + x, y: y0 + 6, bar: -1, hr: 0, s: 1 });
    for (const gy of [0.33, 0.66, 1]) for (let x = 0; x < Wc; x += 9) pts.push({ x: x0 + x, y: y0 - gy * Hc, bar: -2, hr: 0, s: 0.8 });
    this.chart = pts;
    // Trend line above the bar tops, ending in an upward arrow.
    const line: { x: number; y: number }[] = [];
    const tops = this.BARS.map((h, k) => ({ x: x0 + slot * (k + 0.5), y: y0 - h * Hc - Hc * 0.08 }));
    const n = this.cells.length;
    for (let i = 0; i < n; i++) {
      const f = (i / (n - 1)) * (tops.length - 1);
      const k = Math.min(tops.length - 2, Math.floor(f));
      const u = f - k;
      line.push({ x: tops[k].x + (tops[k + 1].x - tops[k].x) * u, y: tops[k].y + (tops[k + 1].y - tops[k].y) * u });
    }
    this.chartLine = line;
  }

  private drawChart(weight: number, q: number) {
    if (weight < 0.01 || !this.chart.length) return;
    const ctx = this.ctx;
    const tw = this.reduced ? 0 : this.time;
    ctx.fillStyle = this.hi;
    const st = this.stride;
    for (let i = 0; i < this.chart.length; i += st) {
      const p = this.chart[i];
      let a: number;
      if (p.bar === -1) a = 0.5 * clamp(q * 4);
      else if (p.bar === -2) a = 0.12 * clamp(q * 4);
      else {
        const grow = clamp(q * 2.2 - p.bar * 0.1);
        const eg = 1 - Math.pow(1 - grow, 3);
        a = p.hr <= eg ? 0.45 + 0.55 * (1 - Math.abs(p.hr - eg) * 0.5) : 0;
        a *= 0.85 + 0.15 * Math.sin(tw * 1.5 + i);
      }
      if (a <= 0) continue;
      ctx.globalAlpha = clamp(weight * a);
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    // Arrow head at the end of the trend line.
    const L = this.chartLine;
    const lineOn = clamp(q * 2.2 - 0.6);
    if (L.length > 2 && lineOn > 0.95) {
      const a = L[L.length - 1];
      const b = L[L.length - 3];
      const ang = Math.atan2(a.y - b.y, a.x - b.x);
      for (const s of [-1, 1])
        for (let j = 1; j <= 7; j++) {
          const aa = ang + Math.PI + s * 0.5;
          ctx.globalAlpha = clamp(weight * 0.9);
          ctx.fillRect(a.x + Math.cos(aa) * j * 2.6 - 0.8, a.y + Math.sin(aa) * j * 2.6 - 0.8, 1.6, 1.6);
        }
    }
    ctx.globalAlpha = 1;
  }

  private spiralR() {
    return Math.min(this.w * (this.mobile ? 0.46 : 0.3), this.h * 0.46);
  }

  private spin() {
    return this.reduced ? 0 : this.time * 0.035;
  }

  /** Fine stardust along the spiral arms, drawn only in the hero. */
  private drawDust(weight: number) {
    if (weight < 0.01) return;
    if (!this.dust.length) {
      const r = rng(0x5eed);
      for (let k = 0; k < 3600; k++) {
        const bulge = k < 560;
        const u = bulge ? Math.abs(r() - r()) * 0.18 : Math.pow(r(), 0.8);
        this.dust.push({
          u,
          arm: k % 2,
          j: bulge ? r() * TAU : (r() + r() + r() - 1.5) * 0.32,
          rj: (r() + r() - 1) * 0.1,
          s: r() < 0.06 ? 1.8 : 0.6 + r() * 0.8,
          a: 0.25 + r() * 0.75,
        });
      }
    }
    const ctx = this.ctx;
    const R = this.spiralR();
    const cx = this.w / 2;
    const cy = this.h / 2;
    const sp = this.spin();
    const tw = this.reduced ? 0 : this.time;
    // Grains drift inside the letters like cells in a membrane.
    const M = this.heroMask;
    if (M && this.heroP < 0.98 && !this.reduced) {
      const dt = 1 / 60;
      for (const p of this.heroWord) {
        p.vx += (Math.random() - 0.5) * 6;
        p.vy += (Math.random() - 0.5) * 6;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 16) {
          p.vx *= 16 / sp;
          p.vy *= 16 / sp;
        }
        const nx = p.x + p.vx * dt;
        const ny = p.y + p.vy * dt;
        const xi = (nx - M.ox) | 0;
        const yi = (ny - M.oy) | 0;
        if (xi >= 0 && yi >= 0 && xi < M.W && yi < M.H && M.data[yi * M.W + xi] > 128) {
          p.x = nx;
          p.y = ny;
        } else {
          p.vx = -p.vx;
          p.vy = -p.vy;
        }
      }
    }
    ctx.fillStyle = this.hi;
    for (let k = 0; k < this.dust.length; k += this.stride) {
      const d = this.dust[k];
      const th = d.arm * Math.PI + d.u * Math.PI * 3.1 + sp + d.j;
      const rr = R * (0.02 + 0.98 * d.u) * (1 + d.rj);
      let x = cx + Math.cos(th) * rr;
      let y = cy + Math.sin(th) * rr * 0.92;
      const wp = this.heroWord.length ? this.heroWord[k % this.heroWord.length] : null;
      if (wp && this.heroP < 1) {
        // Each grain leaves the letters at its own moment and swirls outward.
        const g = clamp((this.heroP - (k % 97) / 97 * 0.35) / 0.65);
        const e = g * g * (3 - 2 * g);
        const sw = (1 - e) * 1.6;
        const wx = cx + (wp.x - cx) * Math.cos(sw * e) - (wp.y - cy) * Math.sin(sw * e);
        const wy = cy + (wp.x - cx) * Math.sin(sw * e) + (wp.y - cy) * Math.cos(sw * e);
        x = wx + (x - wx) * e;
        y = wy + (y - wy) * e;
      }
      ctx.globalAlpha = weight * (wp ? d.a + (1 - d.a) * (1 - clamp(this.heroP * 1.6)) : d.a) * (0.75 + 0.25 * Math.sin(tw * 1.3 + k));
      ctx.fillRect(x - d.s / 2, y - d.s / 2, d.s, d.s);
    }
    ctx.globalAlpha = 1;
  }

  weight(id: SceneId) {
    const { a, b, t } = this.blend();
    const k = SCENES.indexOf(id);
    return (a === k ? 1 - t : 0) + (b === k ? t : 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      if (this.halfRate && (this.skipFrame = !this.skipFrame)) {
        this.raf = requestAnimationFrame(loop);
        return;
      }
      this.watch(now - this.last);
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Re-sample the organism word once web fonts are ready. */
  refreshWord() {
    this.sampleHeroWord();
    this.sampleWord();
    this.assignWord();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.mobile = w <= 1080; // matches the stacked CSS layout
    this.dpr = Math.min(window.devicePixelRatio || 1, this.dprMax);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    const first = this.w === 0;
    this.w = w;
    this.h = h;
    this.unit = Math.min(w, h);
    this.cx = this.mobile ? w * 0.5 : w * 0.64;
    this.cy = this.mobile ? h * 0.36 : h * 0.5;

    const target = Math.round(clamp((w * h) / 6200, 90, 230));
    if (first || Math.abs(target - this.cells.length) > 24) this.populate(target);

    this.rx = this.mobile ? w * 0.42 : Math.min(w * 0.26, this.unit * 0.56);
    this.ry = this.mobile ? h * 0.24 : this.unit * 0.37;
    const n = this.cells.length;
    this.netSpacing = Math.sqrt((Math.PI * this.rx * this.ry) / n);

    this.buildPhyllotaxis();
    this.sampleWord();
    this.sampleHeroWord();
    this.tower = [];
    this.buildChart();
    this.assignWord();
    this.assignSwarm();
  }

  /* ---------------------------------------------------------------- set-up */

  private populate(n: number) {
    const rand = rng(0xc7bce11);
    const cells: Cell[] = [];
    // Even-ish hero scatter: jittered grid shuffled into index order.
    const cols = Math.ceil(Math.sqrt(n * (window.innerWidth / window.innerHeight)));
    const rows = Math.ceil(n / cols);
    const slots: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        slots.push({ x: (c + 0.15 + rand() * 0.7) / cols, y: (r + 0.15 + rand() * 0.7) / rows });
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    for (let i = 0; i < n; i++) {
      // Vogel spiral with jitter for the network layout.
      const rr = Math.sqrt((i + 0.5) / n);
      const th = i * GOLDEN;
      const seed = rand();
      const hub = seed > 0.94;
      const prev = this.cells[i];
      cells.push({
        x: prev ? prev.x : window.innerWidth * 0.5,
        y: prev ? prev.y : window.innerHeight * 0.45,
        vx: 0,
        vy: 0,
        r: 0,
        a: 0,
        heat: 0,
        flash: 0,
        seed,
        seed2: rand(),
        hx: slots[i].x,
        hy: slots[i].y,
        nx: Math.cos(th) * rr + (rand() - 0.5) * 0.06,
        ny: Math.sin(th) * rr + (rand() - 0.5) * 0.06,
        baseR: hub ? 6 + rand() * 3 : 1.8 + rand() * 3.2,
        netR: hub ? 8 + rand() * 3 : 3 + rand() * 4,
        tint: hub || rand() > 0.86 ? 1 : 0,
        nb: [],
        swarm: -1,
        word: -1,
      });
    }
    this.cells = cells;
    this.bootAt = this.time;
    if (this.reduced) this.bootAt = -100;
  }

  private buildPhyllotaxis() {
    const n = Math.min(64, this.cells.length);
    this.phyllo = [];
    for (let i = 0; i < n; i++) {
      const rr = Math.sqrt(i + 0.5);
      this.phyllo.push({ x: Math.cos(i * GOLDEN) * rr, y: Math.sin(i * GOLDEN) * rr });
    }
    this.phylloCentroid = [];
    for (let level = 0; level <= 6; level++) {
      const c = Math.min(2 ** level, n);
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < c; i++) {
        sx += this.phyllo[i].x;
        sy += this.phyllo[i].y;
      }
      this.phylloCentroid.push({ x: sx / c, y: sy / c });
    }
  }

  /** Sample the word "CYBCELL" into roughly one point per cell (two lines on phones). */
  private sampleWord() {
    const n = this.cells.length;
    const lines = this.mobile ? ['CYB', 'CELL'] : ['CYBCELL'];
    const maxW = this.mobile ? this.w * 0.78 : Math.min(this.w * 0.64, 940);
    const off = document.createElement('canvas');
    const g = off.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    const font = (px: number) => `600 ${px}px "Cormorant Garamond", Georgia, serif`;
    g.font = font(100);
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    const fs = (100 * maxW) / widest;
    const lh = fs * 1.08;
    const W = Math.ceil(maxW);
    const H = Math.ceil(lh * lines.length);
    off.width = W;
    off.height = H;
    g.font = font(fs);
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    // A light outline thickens the strokes so the word stays legible in cells.
    g.strokeStyle = '#fff';
    g.lineWidth = fs * 0.06;
    g.lineJoin = 'round';
    lines.forEach((l, k) => {
      g.fillText(l, W / 2, lh * (k + 0.5));
      g.strokeText(l, W / 2, lh * (k + 0.5));
    });
    const data = g.getImageData(0, 0, W, H).data;
    const inside = (x: number, y: number) => {
      const xi = x | 0;
      const yi = y | 0;
      return xi >= 0 && yi >= 0 && xi < W && yi < H && data[(yi * W + xi) * 4 + 3] > 128;
    };
    const collect = (step: number) => {
      const pts: { x: number; y: number }[] = [];
      for (let y = step / 2; y < H; y += step)
        for (let x = step / 2 + ((y / step) % 2) * step * 0.5; x < W; x += step)
          if (inside(x, y)) pts.push({ x, y });
      return pts;
    };
    // Binary-search the grid step so the point count lands just under n.
    let lo = 2;
    let hi = 60;
    let best = collect(hi);
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2;
      const pts = collect(mid);
      if (pts.length > n) lo = mid;
      else {
        hi = mid;
        best = pts;
      }
    }

    const ox = this.w / 2 - W / 2;
    const oy = (this.mobile ? this.h * 0.34 : this.h * 0.44) - H / 2;
    this.wordPts = best.map((p) => ({ x: p.x + ox, y: p.y + oy })).sort((a, b) => a.x - b.x);

    // Dense stardust that fills the letters, like the hero spiral.
    const rd = rng(0xd057);
    const fine = Math.max(2.1, Math.sqrt((W * H) / 26000));
    this.wordDust = [];
    for (let y = 0; y < H; y += fine)
      for (let x = 0; x < W; x += fine) {
        const jx = x + (rd() - 0.5) * fine;
        const jy = y + (rd() - 0.5) * fine;
        if (!inside(jx, jy) || rd() < 0.35) continue;
        const a = rd() * TAU;
        const d = Math.max(this.w, this.h) * (0.3 + rd() * 0.5);
        this.wordDust.push({
          x: jx + ox,
          y: jy + oy,
          sx: this.w / 2 + Math.cos(a) * d,
          sy: this.h / 2 + Math.sin(a) * d,
          s: rd() < 0.05 ? 1.7 : 0.7 + rd() * 0.6,
          a: 0.35 + rd() * 0.65,
          delay: rd() * 0.35,
        });
      }
  }

  private assignWord() {
    const order = this.cells.map((_, i) => i).sort((a, b) => this.cells[a].nx - this.cells[b].nx);
    this.cells.forEach((c) => (c.word = -1));
    const m = this.wordPts.length;
    const n = order.length;
    // Spread the points across the sorted cells so leftovers are scattered evenly.
    for (let k = 0; k < m; k++) this.cells[order[Math.floor((k * n) / m)]].word = k;
  }

  private assignSwarm() {
    this.intruder.fx = this.cx + this.unit * (this.mobile ? 0.12 : 0.16);
    this.intruder.fy = this.cy - this.unit * 0.05;
    const ranked = this.cells
      .map((c, i) => {
        const x = this.cx + c.nx * this.rx - this.intruder.fx;
        const y = this.cy + c.ny * this.ry - this.intruder.fy;
        return { i, d: x * x + y * y };
      })
      .sort((a, b) => a.d - b.d);
    this.cells.forEach((c) => (c.swarm = -1));
    ranked.slice(0, 16).forEach((r, k) => (this.cells[r.i].swarm = k));
  }

  private bindEvents() {
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
        this.pointer.active = true;
      },
      { passive: true },
    );
    document.addEventListener('pointerleave', () => (this.pointer.active = false));
    window.addEventListener(
      'pointerdown',
      (e) => {
        const el = e.target as HTMLElement | null;
        if (el?.closest('a, button, input, textarea, select, label, [data-no-pulse]')) return;
        this.pulse(e.clientX, e.clientY);
      },
      { passive: true },
    );
  }

  /** A shockwave: pushes cells away and makes the nearest ones start talking. */
  pulse(x: number, y: number) {
    this.waves.push({ x, y, t: 0 });
    const near: { i: number; d: number }[] = [];
    this.cells.forEach((c, i) => {
      if (c.a < 0.1) return;
      const dx = c.x - x;
      const dy = c.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 260 && !this.reduced) {
        const f = (1 - d / 260) * 420;
        c.vx += (dx / d) * f;
        c.vy += (dy / d) * f;
      }
      near.push({ i, d });
    });
    near.sort((a, b) => a.d - b.d);
    for (const { i } of near.slice(0, 5)) {
      const c = this.cells[i];
      c.flash = 1;
      for (const j of c.nb.slice(0, 3)) this.emit(i, j, 6, 1);
    }
  }

  /* ---------------------------------------------------------------- scenes */

  private drift(c: Cell, amp: number, out: { x: number; y: number }) {
    if (this.reduced) {
      out.x = 0;
      out.y = 0;
      return;
    }
    const t = this.time;
    out.x = (Math.sin(t * 0.21 + c.seed * 50) + 0.5 * Math.sin(t * 0.13 + c.seed2 * 17)) * amp;
    out.y = (Math.cos(t * 0.17 + c.seed2 * 40) + 0.5 * Math.sin(t * 0.11 + c.seed * 23)) * amp;
  }

  private buildScenes(): Scene[] {
    const d = { x: 0, y: 0 };
    const hidden = (out: Target, x: number, y: number) => {
      out.x = x;
      out.y = y;
      out.r = 0;
      out.a = 0;
      out.heat = 0;
    };
    const scatter = (c: Cell, out: Target, alpha: number, rs: number, pull: number) => {
      this.drift(c, 16, d);
      const hx = c.hx * this.w + d.x;
      const hy = c.hy * this.h + d.y;
      out.x = lerp(hx, this.cx, pull);
      out.y = lerp(hy, this.cy, pull);
      out.r = c.baseR * rs;
      out.a = alpha * (0.5 + 0.5 * c.seed2);
      out.heat = 0;
    };
    const network = (c: Cell, out: Target) => {
      this.drift(c, 7, d);
      out.x = this.cx + c.nx * this.rx + d.x;
      out.y = this.cy + c.ny * this.ry + d.y;
      out.r = c.netR;
      out.a = 0.95;
      out.heat = 0;
    };
    const divR = (count: number) => this.unit * 0.13 * Math.pow(count, -0.42);
    const divCount = (q: number) => Math.min(2 ** Math.min(Math.floor(q * 7), 6), this.cells.length);

    return [
      // hero — the colony as a slowly turning two-armed spiral, like a galaxy
      {
        fn: (c, i, _q, out) => {
          const n = this.cells.length;
          const u = Math.pow((i + 0.5) / n, 0.85);
          const arm = i % 2;
          const R = this.spiralR();
          const th = arm * Math.PI + u * Math.PI * 3.1 + this.spin() + (c.seed - 0.5) * 0.35;
          const rr = R * (0.06 + 0.94 * u) * (1 + (c.seed2 - 0.5) * 0.16);
          out.x = this.w / 2 + Math.cos(th) * rr;
          out.y = this.h / 2 + Math.sin(th) * rr * 0.92;
          out.r = c.baseR * (c.tint ? 0.75 : 0.55);
          out.a = (0.55 + 0.45 * c.seed2) * smooth(0.45, 0.95, this.heroP);
          out.heat = 0;
        },
        link: () => 0,
        linkAlpha: 0,
        rate: () => 0,
      },
      // name — colony dims and leans toward the centre
      {
        // Tissue under the microscope: every cell a particle sphere, sizes vary with depth.
        fn: (c, _i, _q, out) => {
          scatter(c, out, 0.32, 1, 0.05);
          out.r = c.seed2 < 0.12 ? 22 + c.seed * 16 : 6 + c.seed2 * 9;
          out.a *= c.seed2 < 0.12 ? 0.5 : 1;
        },
        link: () => 0,
        linkAlpha: 0,
        rate: () => 0,
      },
      // single — everything collapses into one cell
      {
        fn: (c, i, _q, out) => {
          if (i === 0) {
            out.x = this.cx;
            out.y = this.cy;
            out.r = divR(1);
            out.a = 1;
            out.heat = 0;
          } else hidden(out, this.cx + (c.hx - 0.5) * 30, this.cy + (c.hy - 0.5) * 30);
        },
        link: () => 0,
        linkAlpha: 0,
        rate: () => 0,
      },
      // division — 1 → 2 → 4 … 64 in a phyllotaxis cluster
      {
        fn: (c, i, q, out) => {
          const count = divCount(q);
          if (i >= count) return hidden(out, this.cx, this.cy);
          const level = Math.log2(count);
          const r = divR(count);
          const k = 1.26 * r;
          const p = this.phyllo[i];
          const cen = this.phylloCentroid[level];
          const spin = this.reduced ? 0 : this.time * 0.04;
          const px = p.x - cen.x;
          const py = p.y - cen.y;
          const cs = Math.cos(spin);
          const sn = Math.sin(spin);
          out.x = this.cx + (px * cs - py * sn) * k;
          out.y = this.cy + (px * sn + py * cs) * k;
          out.r = r;
          out.a = 1;
          out.heat = 0;
          void c;
        },
        link: (q) => divR(divCount(q)) * 3.1,
        linkAlpha: 0.55,
        rate: (q) => (divCount(q) > 4 ? 6 + q * 10 : 0),
      },
      // signal — a wide network, busy with messages
      {
        fn: (c, _i, _q, out) => network(c, out),
        link: () => this.netSpacing * 1.8,
        linkAlpha: 0.7,
        rate: (q) => 22 + q * 22,
      },
      // building — cells gather and lay a tower floor by floor
      {
        fn: (c, i, q, out) => {
          if (!this.tower.length) this.buildTower();
          const idx = this.towerNodes[i] ?? 0;
          const p = this.tower[idx];
          const tp = this.towerProject(idx, this.towerFrame());
          const g = clamp(this.towerBuilt(q) - p.f);
          out.x = tp.x;
          out.y = tp.y;
          out.r = 1.3 + tp.depth * 0.8;
          out.a = g * (0.35 + 0.65 * tp.depth);
          out.heat = 0;
          void c;
        },
        link: () => 0,
        linkAlpha: 0,
        rate: () => 0,
      },
      // marketing — a rising chart; cells ride the growth line and pass signals along it
      {
        fn: (c, i, q, out) => {
          if (!this.chartLine.length) this.buildChart();
          const p = this.chartLine[i] ?? this.chartLine[0];
          const n = this.chartLine.length;
          const on = clamp(q * 2.2 - 0.6);
          out.x = p.x;
          out.y = p.y;
          out.r = 1.6;
          out.a = i / n <= on ? 1 : 0;
          out.heat = 0;
          void c;
        },
        link: () => (this.mobile ? this.w * 0.84 : Math.min(this.w * 0.44, 640)) / this.cells.length * 2.6,
        linkAlpha: 0.9,
        rate: () => 24,
      },
      // immune — an intruder arrives, cells raise the alarm and surround it
      {
        fn: (c, _i, _q, out) => {
          network(c, out);
          const I = this.intruder;
          if (c.swarm >= 0 && this.swarmPhase > 0) {
            const ang = (c.swarm / 16) * TAU + (this.reduced ? 0 : this.time * 0.5);
            const rr = this.unit * (c.swarm % 2 ? 0.1 : 0.068) * (0.55 + 0.45 * I.scale);
            out.x = lerp(out.x, I.x + Math.cos(ang) * rr, this.swarmPhase);
            out.y = lerp(out.y, I.y + Math.sin(ang) * rr, this.swarmPhase);
            out.r = lerp(out.r, c.netR * 1.25, this.swarmPhase);
          }
          if (this.alarm > 0) {
            const dist = Math.hypot(out.x - I.x, out.y - I.y);
            const reach = this.unit * 0.05 + this.alarmWave;
            out.heat = clamp(1.15 - dist / reach) * this.alarm;
          }
        },
        link: () => this.netSpacing * 1.8,
        linkAlpha: 0.6,
        rate: () => 30,
      },
      // organism — the colony spells its own name
      {
        fn: (c, _i, _q, out) => {
          if (c.word < 0 || !this.wordPts[c.word]) {
            this.drift(c, 16, d);
            out.x = c.hx * this.w + d.x;
            out.y = c.hy * this.h + d.y;
            out.r = c.baseR * 0.6;
            out.a = 0;
            out.heat = 0;
            return;
          }
          const p = this.wordPts[c.word];
          const breathe = this.reduced ? 0 : Math.sin(this.time * 2.2 - p.x * 0.012);
          this.drift(c, 1.5, d);
          out.x = p.x + d.x;
          out.y = p.y + d.y;
          out.r = 1.4 + 0.5 * breathe;
          out.a = 1;
          out.heat = 0;
        },
        link: () => 0,
        linkAlpha: 0,
        rate: () => 26,
      },
      // ambient — a faint colony behind the rest of the page
      {
        // Out-of-focus tissue: larger, dimmer cells with visible membranes.
        fn: (c, _i, _q, out) => {
          scatter(c, out, 0.22, 1, 0);
          out.r = 6 + c.seed2 * 9;
        },
        link: () => 0,
        linkAlpha: 0,
        rate: () => 0,
      },
    ];
  }

  private blend() {
    const last = SCENES.length - 1;
    // Scene k is pure at s = k; the cross-fade to k + 1 is centred on k + 0.5.
    let a = Math.floor(this.s);
    let t = smooth(0.32, 0.68, this.s - a);
    if (a < 0) {
      a = 0;
      t = 0;
    }
    if (a >= last) {
      a = last;
      t = 0;
    }
    const nb = Math.min(a + 1, last);
    const qa = clamp(this.s - a + 0.5);
    const qb = clamp(this.s - nb + 0.5);
    return { a, b: nb, t, qa, qb };
  }

  /* ------------------------------------------------------------------ tick */

  private tick(dt: number) {
    this.time += dt;
    this.heroP += (this.heroPTarget - this.heroP) * (1 - Math.exp(-dt * (this.reduced ? 30 : 4)));
    this.s += (this.sTarget - this.s) * (1 - Math.exp(-dt * (this.reduced ? 20 : 5)));
    if (Math.abs(this.sTarget - this.s) < 1e-4) this.s = this.sTarget;

    const { a, b, t, qa, qb } = this.blend();
    const A = this.scenes[a];
    const B = this.scenes[b];
    this.updateIntruder(a, b, t, qa, qb);

    const cells = this.cells;
    const k = 1 - Math.exp(-dt * 7);
    const stiff = this.reduced ? 120 : 38;
    const damp = Math.exp(-dt * (this.reduced ? 18 : 7.5));
    const P = this.pointer;
    const bootT = this.time - this.bootAt;

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      A.fn(c, i, qa, this.tmpA);
      let tx = this.tmpA.x;
      let ty = this.tmpA.y;
      let tr = this.tmpA.r;
      let ta = this.tmpA.a;
      let th = this.tmpA.heat;
      if (t > 0) {
        B.fn(c, i, qb, this.tmpB);
        tx = lerp(tx, this.tmpB.x, t);
        ty = lerp(ty, this.tmpB.y, t);
        tr = lerp(tr, this.tmpB.r, t);
        ta = lerp(ta, this.tmpB.a, t);
        th = lerp(th, this.tmpB.heat, t);
      }
      // Boot: the colony grows from one cell by doubling.
      ta *= clamp((bootT - Math.log2(i + 1) * 0.15) * 5);

      // Mitosis: a cell that becomes visible is born from its parent.
      if (c.a < 0.02 && ta > 0.1 && i > 0) {
        const parent = cells[i - 2 ** Math.floor(Math.log2(i))];
        if (parent && parent.a > 0.2) {
          c.x = parent.x + (Math.random() - 0.5) * 2;
          c.y = parent.y + (Math.random() - 0.5) * 2;
          c.vx = c.vy = 0;
          c.r = Math.max(parent.r * 0.6, 1);
          c.flash = 1;
          parent.flash = 1;
        }
      }

      c.vx += (tx - c.x) * stiff * dt;
      c.vy += (ty - c.y) * stiff * dt;
      if (P.active && !this.reduced && c.a > 0.05) {
        const dx = c.x - P.x;
        const dy = c.y - P.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 110 * 110 && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / 110) * 900 * dt;
          c.vx += (dx / d) * f;
          c.vy += (dy / d) * f;
        }
      }
      c.vx *= damp;
      c.vy *= damp;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.r += (tr - c.r) * k;
      c.a += (ta - c.a) * k;
      c.heat += (th - c.heat) * (1 - Math.exp(-dt * 4));
      c.flash *= Math.exp(-dt * 3.2);
    }

    const linkDist = lerp(A.link(qa), B.link(qb), t);
    const linkAlpha = lerp(A.linkAlpha, B.linkAlpha, t);
    let rate = lerp(A.rate(qa), B.rate(qb), t);
    if (this.reduced) rate *= 0.3;

    this.draw(linkDist, linkAlpha);
    this.updateSignals(dt, rate);

    this.statsClock += dt;
    if (this.statsClock > 0.5) {
      this.stats.sps = Math.round(this.stats.sps * 0.4 + (this.arrivals / this.statsClock) * 0.6);
      this.arrivals = 0;
      this.statsClock = 0;
    }
  }

  private updateIntruder(a: number, b: number, t: number, qa: number, qb: number) {
    const k = SCENES.indexOf('immune');
    const w = (a === k ? 1 - t : 0) + (b === k ? t : 0);
    const q = a === k ? qa : b === k ? qb : a > k ? 1 : 0;
    const I = this.intruder;
    const enter = smooth(0.0, 0.38, q);
    const jitter = this.reduced ? 0 : Math.sin(this.time * 13) * 2 * (1 - enter);
    I.x = lerp(this.cx + this.unit * 0.95, I.fx, enter) + jitter;
    I.y = lerp(this.cy - this.unit * 0.42, I.fy, enter);
    I.scale = 1 - smooth(0.6, 0.8, q);
    I.alpha = w * smooth(0.02, 0.1, q) * I.scale;
    this.alarm = w * smooth(0.22, 0.36, q) * (1 - smooth(0.76, 0.9, q));
    this.alarmWave = smooth(0.22, 0.55, q) * this.unit * 0.2;
    this.swarmPhase = w * smooth(0.34, 0.56, q) * (1 - smooth(0.84, 1, q));
  }

  /* -------------------------------------------------------------- signals */

  private emit(from: number, to: number, hops: number, kind: 0 | 1 | 2) {
    if (this.signals.length > 420) return;
    const A = this.cells[from];
    const B = to >= 0 ? this.cells[to] : this.pointer;
    const dist = Math.hypot(B.x - A.x, B.y - A.y);
    const speed = (this.reduced ? 90 : 230) * (0.8 + Math.random() * 0.5);
    this.signals.push({ from, to, t: 0, dur: Math.max(0.12, dist / speed), hops, kind });
  }

  private updateSignals(dt: number, rate: number) {
    const cells = this.cells;
    this.spawnAcc += rate * dt;
    let guard = 0;
    while (this.spawnAcc >= 1 && guard++ < 12) {
      this.spawnAcc -= 1;
      let from = -1;
      let kind: 0 | 1 | 2 = Math.random() < 0.3 ? 0 : 1;
      if (this.alarm > 0.3 && Math.random() < 0.7) {
        // Alarm signals start at hot cells.
        for (let tries = 0; tries < 12 && from < 0; tries++) {
          const i = (Math.random() * cells.length) | 0;
          if (cells[i].heat > 0.35 && cells[i].nb.length) from = i;
        }
        kind = 2;
      }
      for (let tries = 0; tries < 10 && from < 0; tries++) {
        const i = (Math.random() * cells.length) | 0;
        if (cells[i].a > 0.35 && cells[i].nb.length) from = i;
      }
      if (from < 0) continue;
      const c = cells[from];
      this.emit(from, c.nb[(Math.random() * c.nb.length) | 0], 3 + ((Math.random() * 4) | 0), kind);
    }

    // Cells near the pointer occasionally "talk" to it.
    const P = this.pointer;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = this.add;
    ctx.lineCap = 'round';
    const next: Signal[] = [];
    for (const s of this.signals) {
      s.t += dt / s.dur;
      const A = cells[s.from];
      const B = s.to >= 0 ? cells[s.to] : P;
      if (!A || !B || (s.to >= 0 && (B as Cell).a < 0.05) || A.a < 0.05) continue;
      if (s.t >= 1) {
        this.arrivals++;
        if (s.to < 0) {
          P.pulse = 1;
          continue;
        }
        const tgt = cells[s.to];
        tgt.flash = Math.min(1, tgt.flash + 0.7);
        if (s.hops > 0 && tgt.nb.length && Math.random() < 0.78) {
          const opts = tgt.nb.filter((j) => j !== s.from);
          if (opts.length) {
            const j = opts[(Math.random() * opts.length) | 0];
            const dist = Math.hypot(cells[j].x - tgt.x, cells[j].y - tgt.y);
            const speed = this.reduced ? 90 : 240;
            next.push({ from: s.to, to: j, t: 0, dur: Math.max(0.12, dist / speed), hops: s.hops - 1, kind: s.kind });
          }
        }
        continue;
      }
      next.push(s);
      const e = s.t;
      const x = lerp(A.x, B.x, e);
      const y = lerp(A.y, B.y, e);
      const tb = Math.max(0, e - 0.22);
      const x0 = lerp(A.x, B.x, tb);
      const y0 = lerp(A.y, B.y, tb);
      const col = s.kind === 2 ? this.cAlarm : s.kind === 1 ? this.cAmber : this.cPearl;
      const alpha = Math.min(A.a, s.to >= 0 ? (B as Cell).a : 1);
      const grad = ctx.createLinearGradient(x0, y0, x, y);
      grad.addColorStop(0, rgba(col, 0));
      grad.addColorStop(1, rgba(col, 0.6 * alpha));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x, y);
      ctx.stroke();
      const spr = this.sprites[s.kind === 2 ? 'a' : s.kind === 1 ? 's' : 'p'];
      ctx.globalAlpha = alpha * 0.5;
      ctx.drawImage(spr, x - 6, y - 6, 12, 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgba(this.cHi, alpha);
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, TAU);
      ctx.fill();
    }
    this.signals = next;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ----------------------------------------------------------------- draw */

  private draw(linkDist: number, linkAlpha: number) {
    const ctx = this.ctx;
    const cells = this.cells;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.drawDust(this.weight('hero'));
    this.drawWordDust(this.weight('organism'));
    const tw = this.sceneState('building');
    this.drawTower(tw.w, tw.q);
    const mk = this.sceneState('marketing');
    this.drawChart(mk.w, mk.q);

    // Links, bucketed by alpha so each bucket is a single stroke.
    const BUCKETS = 8;
    const paths: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
    const hot: Path2D = new Path2D();
    let links = 0;
    let visible = 0;
    const L2 = linkDist * linkDist;
    for (const c of cells) c.nb.length = 0;
    if (linkDist > 1 && linkAlpha > 0.01) {
      for (let i = 0; i < cells.length; i++) {
        const a = cells[i];
        if (a.a < 0.05) continue;
        for (let j = i + 1; j < cells.length; j++) {
          const b = cells[j];
          if (b.a < 0.05) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > L2) continue;
          const f = 1 - Math.sqrt(d2) / linkDist;
          const al = f * f * Math.min(a.a, b.a) * linkAlpha;
          if (al < 0.02) continue;
          if (a.nb.length < 8) a.nb.push(j);
          if (b.nb.length < 8) b.nb.push(i);
          const target = a.heat + b.heat > 0.9 ? hot : paths[Math.min(BUCKETS - 1, (al * BUCKETS) | 0)];
          target.moveTo(a.x, a.y);
          target.lineTo(b.x, b.y);
          links++;
        }
      }
      ctx.globalCompositeOperation = this.add;
      ctx.lineWidth = 1;
      for (let k = 0; k < BUCKETS; k++) {
        ctx.strokeStyle = rgba(this.cPearl, ((k + 0.5) / BUCKETS) * 0.32);
        ctx.stroke(paths[k]);
      }
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = rgba(this.cAlarm, 0.22 * this.alarm);
      ctx.stroke(hot);
    }

    // Links from nearby cells to the pointer — the colony notices you.
    // Glow.
    for (const c of cells) {
      if (c.a < 0.01 || c.r < 0.2) continue;
      visible++;
      const g = c.r * 5.5 + 8 + c.flash * c.r * 3;
      const glow = 1 - 0.85 * this.ink;
      ctx.globalAlpha = clamp(c.a * (0.1 + c.flash * 0.3) * (c.r > 30 ? 0.5 : 1) * glow);
      ctx.drawImage(this.sprites[c.tint ? 's' : 'p'], c.x - g / 2, c.y - g / 2, g, g);
      if (c.heat > 0.02) {
        ctx.globalAlpha = clamp(c.a * c.heat * 0.3);
        ctx.drawImage(this.sprites.a, c.x - g / 2, c.y - g / 2, g, g);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Membranes, nuclei, cores.
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.a < 0.01 || c.r < 0.2) continue;
      const col = mix(c.tint ? this.cAmber : this.cPearl, this.cAlarm, c.heat);
      if (c.r >= 5.5) this.drawMembrane(c, col);
      if (c.r >= 5.5) continue; // particle cells carry their own nucleus
      const core = c.r >= 5.5 ? Math.max(1.2, c.r * 0.16) : Math.max(0.9, c.r * 0.5);
      ctx.fillStyle = rgba(mix(col, this.cHi, 0.5 + c.flash * 0.5), c.a);
      ctx.beginPath();
      ctx.arc(c.x, c.y, core, 0, TAU);
      ctx.fill();
    }

    this.drawIntruder();

    // Shockwave rings.
    const next = [];
    for (const wv of this.waves) {
      wv.t += 1 / 60;
      if (wv.t > 1) continue;
      next.push(wv);
      ctx.strokeStyle = rgba(this.cPearl, (1 - wv.t) * 0.3);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, 10 + wv.t * 240, 0, TAU);
      ctx.stroke();
    }
    this.waves = next;

    this.stats.cells = visible;
    this.stats.links = links;
  }

  private sphere: { x: number; y: number; z: number; s: number; n: boolean }[] = [];

  /** A large cell drawn as a slowly turning sphere of particles, like the hero spiral. */
  private drawParticleCell(c: Cell, col: RGB) {
    if (!this.sphere.length) {
      const r = rng(0xce11);
      const onSphere = (rad: number) => {
        const u = r() * 2 - 1;
        const a = r() * TAU;
        const k = Math.sqrt(1 - u * u);
        return [Math.cos(a) * k * rad, u * rad, Math.sin(a) * k * rad];
      };
      // Membrane: a thin shell, slightly thick so the rim reads as a ring.
      for (let i = 0; i < 900; i++) {
        const [x, y, z] = onSphere(1 - r() * 0.05);
        this.sphere.push({ x, y, z, s: r() < 0.05 ? 1.8 : 0.9 + r() * 0.5, n: false });
      }
      // Cytoplasm: sparse drifting specks.
      for (let i = 0; i < 160; i++) {
        const [x, y, z] = onSphere(0.35 + Math.cbrt(r()) * 0.55);
        this.sphere.push({ x, y, z, s: 0.8 + r() * 0.6, n: false });
      }
      // Nucleus: a dense bright cluster.
      for (let i = 0; i < 420; i++) {
        const [x, y, z] = onSphere(Math.cbrt(r()) * 0.3);
        this.sphere.push({ x: x + 0.04, y: y - 0.03, z, s: r() < 0.08 ? 1.7 : 0.8 + r() * 0.6, n: true });
      }
    }
    const ctx = this.ctx;
    const t = this.reduced ? 0 : this.time;
    const ay = t * 0.22 + c.seed * 10;
    const ax = 0.35 + Math.sin(t * 0.13 + c.seed2 * 5) * 0.15;
    const cy = Math.cos(ay);
    const sy = Math.sin(ay);
    const cx = Math.cos(ax);
    const sx = Math.sin(ax);
    const breathe = 1 + 0.02 * Math.sin(t * 1.1 + c.seed * 7) + c.flash * 0.05;
    const R = c.r * breathe;
    // Fewer points for smaller cells keeps density even and draws cheap.
    const step = Math.max(1, Math.floor(this.sphere.length / Math.max(60, c.r * 16) / this.q));
    const dot = c.r < 14 ? 0.8 : 1;
    ctx.fillStyle = rgba(col, 1);
    for (let i = 0; i < this.sphere.length; i += step) {
      const p = this.sphere[i];
      const x1 = p.x * cy - p.z * sy;
      const z1 = p.x * sy + p.z * cy;
      const y2 = p.y * cx - z1 * sx;
      const z2 = p.y * sx + z1 * cx;
      const depth = (z2 + 1) / 2;
      ctx.globalAlpha = clamp(c.a * (p.n ? 0.35 + 0.6 * depth : 0.12 + 0.75 * depth * depth));
      const sz = p.s * dot * (0.7 + 0.5 * depth);
      ctx.fillRect(c.x + x1 * R - sz / 2, c.y + y2 * R - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    // A soft light at the nucleus.
    ctx.globalCompositeOperation = this.add;
    ctx.globalAlpha = clamp(c.a * 0.35);
    const g = R * 0.9;
    ctx.drawImage(this.sprites[c.tint ? 's' : 'p'], c.x - g / 2, c.y - g / 2, g, g);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawMembrane(c: Cell, col: RGB) {
    return this.drawParticleCell(c, col);
  }

  private virus: { x: number; y: number; z: number; s: number; spike: number }[] = [];

  /** The intruder as a particle virion: a dusty capsid with spike proteins. */
  private drawIntruder() {
    const I = this.intruder;
    if (I.alpha < 0.01) return;
    if (!this.virus.length) {
      const r = rng(0xbad);
      const dir = () => {
        const u = r() * 2 - 1;
        const a = r() * TAU;
        const k = Math.sqrt(1 - u * u);
        return [Math.cos(a) * k, u, Math.sin(a) * k];
      };
      for (let i = 0; i < 520; i++) {
        const [x, y, z] = dir();
        const d = 0.92 + r() * 0.08;
        this.virus.push({ x: x * d, y: y * d, z: z * d, s: 0.8 + r() * 0.7, spike: 0 });
      }
      for (let i = 0; i < 180; i++) {
        const [x, y, z] = dir();
        const d = Math.cbrt(r()) * 0.8;
        this.virus.push({ x: x * d, y: y * d, z: z * d, s: 0.7 + r() * 0.5, spike: 0 });
      }
      for (let k = 0; k < 34; k++) {
        const [x, y, z] = dir();
        for (let j = 1; j <= 5; j++) {
          const d = 1 + j * 0.07;
          this.virus.push({ x: x * d, y: y * d, z: z * d, s: j === 5 ? 1.9 : 1, spike: j });
        }
      }
    }
    const ctx = this.ctx;
    const t = this.reduced ? 0 : this.time;
    const R = this.unit * 0.045 * (0.25 + 0.75 * I.scale);
    const ay = t * 0.4;
    const ax = 0.4 + Math.sin(t * 0.3) * 0.2;
    const cyy = Math.cos(ay);
    const syy = Math.sin(ay);
    const cxx = Math.cos(ax);
    const sxx = Math.sin(ax);
    const g = R * 5;
    ctx.globalCompositeOperation = this.add;
    ctx.globalAlpha = I.alpha * 0.25;
    ctx.drawImage(this.sprites.a, I.x - g / 2, I.y - g / 2, g, g);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(this.cAlarm, 1);
    const st = this.stride;
    for (let i = 0; i < this.virus.length; i += st) {
      const p = this.virus[i];
      const x1 = p.x * cyy - p.z * syy;
      const z1 = p.x * syy + p.z * cyy;
      const y2 = p.y * cxx - z1 * sxx;
      const z2 = p.y * sxx + z1 * cxx;
      const depth = (z2 + 1.4) / 2.8;
      // Spikes fade as the virus is broken down.
      const keep = p.spike ? clamp(I.scale * 1.4 - p.spike * 0.12) : 1;
      ctx.globalAlpha = clamp(I.alpha * keep * (0.15 + 0.85 * depth * depth));
      const sz = p.s * (0.7 + 0.5 * depth);
      ctx.fillRect(I.x + x1 * R - sz / 2, I.y + y2 * R - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

}

/* ------------------------------------------------------------------ helpers */

function rgba(c: RGB, a: number) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a < 0 ? 0 : a > 1 ? 1 : a.toFixed(3)})`;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function makeSprite(c: RGB) {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, rgba(c, 0.9));
  grad.addColorStop(0.18, rgba(c, 0.35));
  grad.addColorStop(0.45, rgba(c, 0.08));
  grad.addColorStop(1, rgba(c, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return cv;
}

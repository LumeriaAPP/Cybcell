/**
 * The figure next to the solutions list: one canvas that shows each service
 * at work, drawn from fine particles in the same stardust style as the hero.
 * Each service has a representative resting frame, rendered only on change
 * or resize. There is no idle animation loop, including on mobile devices.
 * All geometry is in unit coordinates (0..1) and scaled to the canvas.
 */

export type SpecimenKind = 'web' | 'app' | 'ai' | 'ar' | 'funnel' | 'kiosk' | 'shield';

type P = [number, number];

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const RED = '229,72,77';

export class Specimen {
  private ctx: CanvasRenderingContext2D;
  private S = 400;
  private kind: SpecimenKind = 'web';
  private running = false;
  private dirty = false;
  private glow: HTMLCanvasElement;

  private drops: { u: number; y: number; v: number; die: number; seed: number }[] = [];
  private spawnAcc = 0;
  private pile = 0;
  private threats: { a: number; d: number; burst: number }[] = [];
  private shieldFlash = 0;
  private pulses: { path: number[]; p: number }[] = [];
  private nodeFlash: number[][] = [];
  private tower: { x: number; y: number; z: number; f: number; s: number }[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.glow = document.createElement('canvas');
    this.glow.width = this.glow.height = 64;
    const g = this.glow.getContext('2d');
    if (!g) throw new Error('Canvas 2D is not available');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  set(kind: SpecimenKind) {
    if (kind === this.kind) return;
    this.kind = kind;
    this.drops = [];
    this.threats = [];
    this.pulses = [];
    this.pile = 0;
    this.dirty = true;
    if (this.running) this.frame(0);
  }

  start() {
    this.running = true;
    if (this.dirty) this.frame(0);
  }

  stop() {
    this.running = false;
  }

  private resize() {
    const box = this.canvas.getBoundingClientRect();
    const size = Math.max(1, Math.round(box.width));
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 820 ? 1.25 : 1.5);
    if (this.canvas.width === Math.round(size * dpr) && this.canvas.height === Math.round(size * dpr)) return;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.S = size;
    this.frame(0);
  }

  private frame(dt: number) {
    this.dirty = false;
    this.ctx.clearRect(0, 0, this.S, this.S);
    // Pick a fully formed, representative illustration for every service.
    const t = this.kind === 'web' ? 3.3 : this.kind === 'kiosk' ? 5.3 : 2.6;
    switch (this.kind) {
      case 'web':
        return this.drawWeb(t);
      case 'app':
        return this.drawApp(t);
      case 'ai':
        return this.drawAI(t, dt);
      case 'ar':
        return this.drawAR(t);
      case 'funnel':
        return this.drawFunnel(t, dt);
      case 'kiosk':
        return this.drawKiosk(t);
      case 'shield':
        return this.drawShield(t, dt);
    }
  }

  /* --------------------------------------------------------------- drawing */

  private dot(x: number, y: number, s: number, a: number, color?: string) {
    if (a <= 0.005) return;
    const { ctx, S } = this;
    ctx.globalAlpha = clamp(a);
    ctx.fillStyle = color ? `rgb(${color})` : '#fff';
    ctx.fillRect(x * S - s / 2, y * S - s / 2, s, s);
  }

  /** Dots along a polyline, spaced in pixels, with a little hand-made jitter. */
  private poly(pts: P[], closed: boolean, gap = 3.5, a = 0.7, s = 1.2, seed = 0, color?: string) {
    const S = this.S;
    const n = pts.length;
    const segs = closed ? n : n - 1;
    let k = 0;
    for (let i = 0; i < segs; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % n];
      const m = Math.max(1, Math.round((Math.hypot(x1 - x0, y1 - y0) * S) / gap));
      for (let j = 0; j < m; j++) {
        const f = j / m;
        const jx = ((hash(seed + k) - 0.5) * 0.9) / S;
        const jy = ((hash(seed + k + 91) - 0.5) * 0.9) / S;
        this.dot(x0 + (x1 - x0) * f + jx, y0 + (y1 - y0) * f + jy, s, a * (0.7 + 0.3 * hash(seed + k + 7)), color);
        k++;
      }
    }
    this.ctx.globalAlpha = 1;
  }

  private line(x0: number, y0: number, x1: number, y1: number, a = 0.6, gap = 3.5, s = 1.1, seed = 0) {
    this.poly([[x0, y0], [x1, y1]], false, gap, a, s, seed);
  }

  private rr(x: number, y: number, w: number, h: number, r: number): P[] {
    r = Math.min(r, w / 2, h / 2);
    const pts: P[] = [];
    const corners: [number, number, number][] = [
      [x + w - r, y + r, -Math.PI / 2],
      [x + w - r, y + h - r, 0],
      [x + r, y + h - r, Math.PI / 2],
      [x + r, y + r, Math.PI],
    ];
    for (const [cx, cy, a0] of corners)
      for (let s = 0; s <= 5; s++) {
        const a = a0 + (s / 5) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    return pts;
  }

  private box(x: number, y: number, w: number, h: number, r = 0.01, a = 0.7, gap = 3.5, s = 1.2, seed = 0) {
    if (w <= 0 || h <= 0) return;
    this.poly(this.rr(x, y, w, h, r), true, gap, a, s, seed);
  }

  private fill(x: number, y: number, w: number, h: number, a = 0.3, gap = 5, keep = 0.55, seed = 0) {
    const S = this.S;
    let k = seed;
    for (let py = y * S + gap / 2; py < (y + h) * S; py += gap)
      for (let px = x * S + gap / 2; px < (x + w) * S; px += gap) {
        k++;
        if (hash(k) > keep) continue;
        this.dot(px / S + (hash(k + 3) - 0.5) / S, py / S + (hash(k + 5) - 0.5) / S, 1, a * (0.6 + 0.4 * hash(k + 9)));
      }
    this.ctx.globalAlpha = 1;
  }

  private ring(cx: number, cy: number, r: number, a = 0.6, gap = 3, s = 1.1, ry = r, seed = 0) {
    const pts: P[] = [];
    const n = 40;
    for (let i = 0; i < n; i++) pts.push([cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * ry]);
    this.poly(pts, true, gap, a, s, seed);
  }

  private light(x: number, y: number, size: number, a: number) {
    const { ctx, S } = this;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(a);
    const px = size * S;
    ctx.drawImage(this.glow, x * S - px / 2, y * S - px / 2, px, px);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ----------------------------------------- websites: a page assembles */

  private drawWeb(t: number) {
    const p = (t % 11) / 11;
    const m = smooth(0.42, 0.52, p) * (1 - smooth(0.9, 0.98, p)); // desktop → phone width
    const out = 1 - smooth(0.965, 1, p);
    const F = {
      x: lerp(0.1, 0.33, m),
      y: lerp(0.2, 0.1, m),
      w: lerp(0.8, 0.34, m),
      h: lerp(0.6, 0.8, m),
    };
    this.box(F.x, F.y, F.w, F.h, 0.02, 0.85, 3, 1.3, 1);
    const bar = 0.05;
    this.line(F.x, F.y + bar, F.x + F.w, F.y + bar, 0.5, 3.5, 1, 2);
    for (let i = 0; i < 3; i++) this.ring(F.x + 0.025 + i * 0.02, F.y + bar / 2, 0.006, 0.8, 2, 1);
    if (m < 0.6) this.box(F.x + F.w * 0.3, F.y + 0.014, F.w * 0.4, 0.022, 0.011, 0.35 * (1 - m / 0.6), 4, 1, 3);

    const C = { x: F.x, y: F.y + bar, w: F.w, h: F.h - bar };
    type B = { type: 'nav' | 'text' | 'btn' | 'img' | 'card'; d: number[]; m: number[] };
    const blocks: B[] = [
      { type: 'nav', d: [0.04, 0.04, 0.92, 0.07], m: [0.06, 0.03, 0.88, 0.05] },
      { type: 'text', d: [0.04, 0.17, 0.5, 0.14], m: [0.06, 0.12, 0.88, 0.1] },
      { type: 'btn', d: [0.04, 0.36, 0.18, 0.07], m: [0.06, 0.25, 0.4, 0.05] },
      { type: 'img', d: [0.6, 0.17, 0.36, 0.3], m: [0.06, 0.34, 0.88, 0.22] },
      { type: 'card', d: [0.04, 0.56, 0.28, 0.38], m: [0.06, 0.6, 0.88, 0.16] },
      { type: 'card', d: [0.36, 0.56, 0.28, 0.38], m: [0.06, 0.8, 0.88, 0.16] },
      { type: 'card', d: [0.68, 0.56, 0.28, 0.38], m: [0.06, 1, 0.88, 0.16] },
    ];
    let btn: P = [0.5, 0.5];
    blocks.forEach((b, k) => {
      const ap = clamp((p - 0.02 - k * 0.035) / 0.06) * out;
      if (ap <= 0) return;
      const r = b.d.map((v, i) => lerp(v, b.m[i], m));
      const x = C.x + r[0] * C.w;
      const y = C.y + r[1] * C.h;
      const w = r[2] * C.w;
      const h = Math.min(r[3] * C.h, C.y + C.h - 0.01 - y);
      if (h <= 0.005) return;
      const seed = k * 1000;
      switch (b.type) {
        case 'nav':
          this.fill(x, y, w, h, 0.18 * ap, 6, 0.5, seed);
          this.ring(x + 0.015, y + h / 2, 0.008, 0.9 * ap, 2, 1.1, 0.008, seed);
          if (m < 0.5) for (let i = 0; i < 3; i++) this.line(x + w - 0.16 + i * 0.05, y + h / 2, x + w - 0.13 + i * 0.05, y + h / 2, 0.6 * ap, 3, 1, seed + i);
          else for (let i = 0; i < 3; i++) this.line(x + w - 0.04, y + h * (0.3 + i * 0.2), x + w - 0.015, y + h * (0.3 + i * 0.2), 0.7 * ap, 2.5, 1, seed + i);
          break;
        case 'text':
          [1, 0.8, 0.55].forEach((f, i) => this.line(x, y + h * (0.15 + i * 0.33), x + w * f, y + h * (0.15 + i * 0.33), (i ? 0.45 : 0.9) * ap, 2.6, i ? 1 : 1.6, seed + i * 50));
          break;
        case 'btn':
          btn = [x + w / 2, y + h / 2];
          this.fill(x, y, w, h, 0.7 * ap, 3, 0.8, seed);
          this.box(x, y, w, h, h / 2, 0.9 * ap, 2.5, 1.2, seed);
          break;
        case 'img':
          this.box(x, y, w, h, 0.01, 0.6 * ap, 3, 1.1, seed);
          this.poly([[x + w * 0.05, y + h * 0.85], [x + w * 0.35, y + h * 0.45], [x + w * 0.55, y + h * 0.7], [x + w * 0.72, y + h * 0.5], [x + w * 0.95, y + h * 0.85]], false, 3, 0.5 * ap, 1, seed);
          this.ring(x + w * 0.78, y + h * 0.25, Math.min(w, h) * 0.08, 0.6 * ap, 2.5, 1, Math.min(w, h) * 0.08, seed);
          break;
        case 'card':
          this.box(x, y, w, h, 0.01, 0.45 * ap, 3.5, 1, seed);
          this.line(x + w * 0.1, y + Math.min(h * 0.25, 0.04), x + w * 0.7, y + Math.min(h * 0.25, 0.04), 0.6 * ap, 3, 1, seed + 5);
          this.line(x + w * 0.1, y + Math.min(h * 0.42, 0.07), x + w * 0.5, y + Math.min(h * 0.42, 0.07), 0.35 * ap, 3, 1, seed + 6);
          break;
      }
    });
    // A cursor clicks the button on desktop; a finger taps it on the phone.
    const click = (at: number) => {
      const q = clamp((p - at) / 0.07);
      if (q > 0 && q < 1) {
        this.ring(btn[0], btn[1], 0.01 + q * 0.06, (1 - q) * 0.8, 2.5, 1.1);
        this.light(btn[0], btn[1], 0.12, (1 - q) * 0.5);
      }
    };
    if (m < 0.3 && p < 0.4) {
      const q = smooth(0.14, 0.28, p);
      const cx = lerp(0.82, btn[0] + 0.01, q);
      const cy = lerp(0.86, btn[1] + 0.01, q);
      const arrow: P[] = [[0, 0], [0, 0.036], [0.009, 0.027], [0.016, 0.042], [0.022, 0.039], [0.015, 0.025], [0.027, 0.025]];
      this.poly(arrow.map(([ax, ay]) => [cx + ax, cy + ay] as P), true, 2, 0.95, 1.2);
    }
    click(0.3);
    click(0.72);
  }

  /* -------------------------------------------- mobile apps: a live phone */

  private drawApp(t: number) {
    const P0 = { x: 0.33, y: 0.12, w: 0.34, h: 0.76 };
    for (let i = 0; i < 44; i++) {
      const a = t * 0.35 + (i / 44) * TAU;
      this.dot(0.5 + Math.cos(a) * 0.36, 0.5 + Math.sin(a) * 0.45, 1, 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(i * 1.7 + t * 2)));
    }
    this.light(0.5, 0.5, 0.9, 0.08);
    this.box(P0.x, P0.y, P0.w, P0.h, 0.05, 0.9, 2.6, 1.3, 1);
    this.box(P0.x + 0.012, P0.y + 0.012, P0.w - 0.024, P0.h - 0.024, 0.04, 0.2, 4, 1, 2);
    this.line(0.465, 0.143, 0.535, 0.143, 0.9, 2, 1.6);
    this.line(0.45, 0.856, 0.55, 0.856, 0.7, 2, 1.3);
    const sx = 0.35;
    const sw = 0.3;
    const top = 0.2;
    const bottom = 0.83;
    this.line(0.36, 0.175, 0.44, 0.175, 0.8, 2.5, 1.4);
    this.ring(0.625, 0.175, 0.011, 0.7, 2, 1);
    const cardH = 0.11;
    const gap = 0.02;
    const off = (t * 0.035) % (cardH + gap);
    for (let i = -1; i < 7; i++) {
      const y = top + i * (cardH + gap) - off;
      if (y < top - 0.001 || y + cardH > bottom) continue;
      const a = smooth(top, top + 0.04, y) * (1 - smooth(bottom - cardH - 0.04, bottom - cardH, y));
      const seed = (i + Math.floor((t * 0.035) / (cardH + gap))) * 400;
      this.box(sx, y, sw, cardH, 0.015, 0.5 * a, 3.2, 1, seed);
      this.ring(sx + 0.035, y + cardH / 2, 0.018, 0.7 * a, 2.2, 1, 0.018, seed);
      this.line(sx + 0.07, y + cardH * 0.38, sx + sw * 0.85, y + cardH * 0.38, 0.6 * a, 3, 1, seed + 1);
      this.line(sx + 0.07, y + cardH * 0.64, sx + sw * 0.6, y + cardH * 0.64, 0.35 * a, 3, 1, seed + 2);
    }
    const p = (t % 5) / 5;
    const show = smooth(0.1, 0.2, p) - smooth(0.62, 0.72, p);
    if (show > 0.01) {
      const ny = 0.13 + 0.07 * show;
      this.fill(sx - 0.005, ny, sw + 0.01, 0.065, 0.45 * show, 3, 0.75, 77);
      this.box(sx - 0.005, ny, sw + 0.01, 0.065, 0.015, show, 2.5, 1.2, 78);
      this.ring(sx + 0.025, ny + 0.0325, 0.012, show, 2, 1.2);
      this.line(sx + 0.05, ny + 0.025, sx + 0.22, ny + 0.025, show, 2.5, 1.3, 79);
      this.line(sx + 0.05, ny + 0.043, sx + 0.16, ny + 0.043, 0.6 * show, 2.5, 1, 80);
      this.light(0.5, ny + 0.03, 0.3, 0.25 * show);
    }
    const tq = clamp((p - 0.78) / 0.12);
    if (tq > 0 && tq < 1) {
      this.ring(0.5, 0.52, 0.008 + tq * 0.06, (1 - tq) * 0.9, 2.2, 1.2);
      this.light(0.5, 0.52, 0.12, (1 - tq) * 0.6);
    }
  }

  /* ------------------------------------------- AI: a network that answers */

  private readonly LAYERS = [3, 5, 5, 3];
  private readonly LX = [0.2, 0.4, 0.6, 0.8];

  private nodePos(l: number, j: number): P {
    const n = this.LAYERS[l];
    return [this.LX[l], 0.5 + (j - (n - 1) / 2) * 0.13];
  }

  private drawAI(t: number, dt: number) {
    if (!this.nodeFlash.length) this.nodeFlash = this.LAYERS.map((n) => new Array(n).fill(0));
    // Connections.
    for (let l = 0; l < this.LAYERS.length - 1; l++)
      for (let i = 0; i < this.LAYERS[l]; i++)
        for (let j = 0; j < this.LAYERS[l + 1]; j++) {
          const [x0, y0] = this.nodePos(l, i);
          const [x1, y1] = this.nodePos(l + 1, j);
          this.line(x0, y0, x1, y1, 0.13, 6, 1, l * 100 + i * 10 + j);
        }
    // Data streams in from the left and answers leave on the right.
    for (let i = 0; i < 26; i++) {
      const f = (t * 0.25 + i / 26) % 1;
      const lane = i % 3;
      const [nx, ny] = this.nodePos(0, lane);
      this.dot(0.04 + (nx - 0.06) * f, ny + Math.sin(f * 6 + i) * 0.01, 1, 0.45 * Math.sin(f * Math.PI));
      const [ox, oy] = this.nodePos(3, lane);
      const g = (t * 0.2 + i / 26 + 0.5) % 1;
      this.dot(ox + 0.03 + g * 0.14, oy, 1, 0.5 * Math.sin(g * Math.PI) * (0.3 + this.nodeFlash[3][lane]));
    }
    // Pulses travel input → output.
    if (dt > 0 && Math.random() < dt * 5) {
      this.pulses.push({ path: this.LAYERS.map((n) => (Math.random() * n) | 0), p: 0 });
    }
    const keep = [];
    for (const pu of this.pulses) {
      const before = Math.floor(pu.p);
      pu.p += dt * 1.6;
      const seg = Math.floor(pu.p);
      if (seg > before && seg < this.LAYERS.length) this.nodeFlash[seg][pu.path[seg]] = 1;
      if (pu.p >= this.LAYERS.length - 1) continue;
      keep.push(pu);
      const f = pu.p - seg;
      const [x0, y0] = this.nodePos(seg, pu.path[seg]);
      const [x1, y1] = this.nodePos(seg + 1, pu.path[seg + 1]);
      const x = lerp(x0, x1, f);
      const y = lerp(y0, y1, f);
      this.light(x, y, 0.06, 0.7);
      this.dot(x, y, 1.8, 1);
    }
    this.pulses = keep;
    // Nodes.
    this.LAYERS.forEach((n, l) => {
      for (let j = 0; j < n; j++) {
        const [x, y] = this.nodePos(l, j);
        const f = this.nodeFlash[l][j];
        this.ring(x, y, 0.028, 0.55 + 0.45 * f, 2.2, 1.1, 0.028, l * 50 + j);
        this.fill(x - 0.016, y - 0.016, 0.032, 0.032, 0.4 + 0.5 * f, 3, 0.6, l * 70 + j);
        if (f > 0.05) this.light(x, y, 0.12, f * 0.55);
        this.nodeFlash[l][j] = f * Math.exp(-dt * 2.5);
      }
    });
    // The answer: a chat bubble fills in with a typing indicator.
    const p = (t % 4) / 4;
    this.box(0.62, 0.14, 0.26, 0.09, 0.03, 0.55, 3, 1.1, 5);
    this.poly([[0.66, 0.23], [0.65, 0.26], [0.69, 0.23]], false, 2.5, 0.55, 1.1, 6);
    for (let i = 0; i < 3; i++) {
      const b = 0.5 + 0.5 * Math.sin(t * 6 - i * 0.9);
      this.ring(0.7 + i * 0.05, 0.185, 0.007, 0.35 + 0.6 * b * (p < 0.7 ? 1 : 0.3), 1.8, 1.2);
    }
  }

  /* ------------------------------ 3D and AR: pick a floor in a live model */

  private buildTower() {
    const W = 0.44;
    const D = 0.28;
    const F = 10;
    const hF = 0.042;
    const pts: typeof this.tower = [];
    const per = 2 * (W + D);
    const at = (d: number): P => {
      d = ((d % per) + per) % per;
      if (d < W) return [-W / 2 + d, -D / 2];
      d -= W;
      if (d < D) return [W / 2, -D / 2 + d];
      d -= D;
      if (d < W) return [W / 2 - d, D / 2];
      return [-W / 2, D / 2 - (d - W)];
    };
    for (let f = 0; f <= F; f++) {
      for (let i = 0; i < 120; i++) {
        const [x, z] = at((i / 120) * per);
        pts.push({ x, y: f * hF, z, f, s: 1.1 });
      }
      if (f === F) break;
      for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]])
        for (let j = 1; j < 6; j++) pts.push({ x, y: f * hF + (j / 6) * hF, z, f, s: 1.2 });
      for (let i = 0; i < 40; i++) {
        const [x, z] = at((i / 40) * per);
        pts.push({ x, y: f * hF + hF * 0.5, z, f, s: hash(f * 40 + i) < 0.18 ? 1.8 : 0.8 });
      }
    }
    this.tower = pts;
  }

  private drawAR(t: number) {
    if (!this.tower.length) this.buildTower();
    const A = t * 0.35 + 0.5;
    const cA = Math.cos(A);
    const sA = Math.sin(A);
    const proj = (x: number, y: number, z: number) => {
      const X = x * cA - z * sA;
      const Z = x * sA + z * cA;
      return { x: 0.5 + X, y: 0.74 - y + Z * 0.3, d: clamp((Z + 0.4) / 0.8) };
    };
    // AR tracking grid on the ground.
    for (let g = -5; g <= 5; g++)
      for (let k = -20; k <= 20; k++) {
        const a = proj(g * 0.07, 0, k * 0.0175);
        const b = proj(k * 0.0175, 0, g * 0.07);
        const fade = 1 - Math.abs(k) / 21;
        this.dot(a.x, a.y, 0.9, 0.12 * fade);
        this.dot(b.x, b.y, 0.9, 0.12 * fade);
      }
    const cycle = 4;
    const sel = 1 + (Math.floor(t / cycle) % 8);
    const sp = (t % cycle) / cycle;
    const lift = 0.1 * (smooth(0.1, 0.3, sp) - smooth(0.8, 0.95, sp));
    for (const p of this.tower) {
      const up = p.f > sel ? lift : 0;
      const q = proj(p.x, p.y + up, p.z);
      const hot = p.f === sel ? 0.45 * (lift / 0.1) : 0;
      this.dot(q.x, q.y, p.s, 0.2 + 0.7 * q.d + hot);
    }
    // The chosen apartment: its floor plan shows while the floors above rise.
    if (lift > 0.01) {
      const y = sel * 0.042;
      const k = lift / 0.1;
      for (let i = 0; i <= 30; i++) {
        const f = i / 30;
        const a = proj(-0.22 + f * 0.44, y, 0);
        const b = proj(-0.07, y, -0.14 + f * 0.28);
        const c = proj(0.08, y, -0.14 + f * 0.28);
        for (const r of [a, b, c]) this.dot(r.x, r.y, 1.2, 0.8 * k);
      }
      const c = proj(0, y, 0);
      this.light(c.x, c.y, 0.3, 0.35 * k);
    }
  }

  /* ---------------------------- marketing: an audience becomes customers */

  private funnelW(y: number) {
    if (y < 0.18) return 0.66;
    if (y < 0.6) return lerp(0.66, 0.12, (y - 0.18) / 0.42);
    return 0.12;
  }

  private drawFunnel(t: number, dt: number) {
    this.ring(0.5, 0.18, 0.33, 0.6, 3, 1.1, 0.045, 1);
    this.poly([[0.17, 0.18], [0.44, 0.6], [0.44, 0.7]], false, 3, 0.7, 1.2, 2);
    this.poly([[0.83, 0.18], [0.56, 0.6], [0.56, 0.7]], false, 3, 0.7, 1.2, 3);
    for (const y of [0.32, 0.46]) this.ring(0.5, y, this.funnelW(y) / 2, 0.22, 4, 1, 0.028, y * 1000);

    if (dt > 0) {
      this.spawnAcc += dt * 55;
      while (this.spawnAcc > 1) {
        this.spawnAcc--;
        const r = Math.random();
        this.drops.push({ u: Math.random() * 1.9 - 0.95, y: 0.08, v: 0.12 + Math.random() * 0.05, die: r < 0.35 ? 0.32 : r < 0.6 ? 0.46 : r < 0.72 ? 0.6 : 2, seed: Math.random() * 1000 });
      }
    } else if (!this.drops.length) {
      for (let i = 0; i < (window.innerWidth < 820 ? 80 : 160); i++) this.drops.push({ u: hash(i) * 1.9 - 0.95, y: 0.08 + hash(i + 5) * 0.7, v: 0.13, die: 2, seed: i });
    }
    const keep = [];
    for (const d of this.drops) {
      d.y += d.v * dt;
      let a = 0.3 + 0.6 * clamp((d.y - 0.08) / 0.6);
      if (d.y > d.die) {
        a *= 1 - (d.y - d.die) / 0.03;
        if (a <= 0) continue;
      }
      if (d.y > 0.8) {
        this.pile = Math.min(1.5, this.pile + 0.12);
        continue;
      }
      keep.push(d);
      const w = d.y < 0.7 ? this.funnelW(d.y) : 0.12 * (1 - (d.y - 0.7) / 0.1);
      const x = 0.5 + d.u * (w / 2) * 0.9 + Math.sin(t * 2 + d.seed) * 0.004;
      this.dot(x, d.y, d.y > 0.6 ? 1.8 : 1.1, a);
    }
    this.drops = keep;
    this.pile *= Math.exp(-dt * 1.2);
    this.light(0.5, 0.83, 0.18 + this.pile * 0.08, 0.35 + this.pile * 0.3);
    this.ring(0.5, 0.83, 0.03 + this.pile * 0.01, 0.8, 2, 1.3, 0.012, 9);
  }

  /* ------------------------------ hardware: order, pay, receipt at a kiosk */

  private drawKiosk(t: number) {
    const p = (t % 7) / 7;
    this.box(0.35, 0.1, 0.3, 0.66, 0.03, 0.85, 2.8, 1.3, 1);
    this.box(0.375, 0.135, 0.25, 0.33, 0.012, 0.55, 3, 1.1, 2);
    this.line(0.39, 0.16, 0.48, 0.16, 0.8, 2.5, 1.3, 3);
    const chosen = p < 0.4 ? Math.floor((p / 0.4) * 6) % 6 : 4;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 2; c++) {
        const i = r * 2 + c;
        const x = 0.39 + c * 0.117;
        const y = 0.18 + r * 0.075;
        const on = i === chosen;
        if (on) this.fill(x, y, 0.105, 0.065, 0.55, 3, 0.8, 10 + i);
        this.box(x, y, 0.105, 0.065, 0.008, on ? 1 : 0.4, 3, 1, 20 + i);
      }
    const pay = smooth(0.38, 0.42, p) * (1 - smooth(0.62, 0.66, p));
    this.box(0.39, 0.415, 0.22, 0.03, 0.015, 0.5 + 0.5 * pay, 2.5, 1.1, 30);
    if (pay > 0.01) this.fill(0.39, 0.415, 0.22, 0.03, 0.6 * pay, 3, 0.8, 31);
    // Card reader with contactless waves.
    this.box(0.455, 0.5, 0.09, 0.05, 0.008, 0.7, 2.5, 1.1, 40);
    const tap = smooth(0.45, 0.5, p) * (1 - smooth(0.6, 0.64, p));
    if (tap > 0.01)
      for (let k = 0; k < 3; k++) {
        const b = 0.5 + 0.5 * Math.sin(t * 8 - k);
        const r = 0.03 + k * 0.02;
        const pts: P[] = [];
        for (let i = 0; i <= 10; i++) {
          const a = -2.4 + (i / 10) * 1.6;
          pts.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]);
        }
        this.poly(pts, false, 2.5, tap * b, 1.2, 50 + k);
      }
    // A phone comes in to pay.
    const ph = smooth(0.4, 0.5, p) - smooth(0.62, 0.7, p);
    if (ph > 0.01) {
      const x = lerp(0.8, 0.53, ph);
      this.box(x, 0.4, 0.055, 0.1, 0.01, ph, 2.2, 1.2, 60);
      this.light(x + 0.027, 0.45, 0.1, 0.25 * tap);
    }
    // Receipt slot and paper.
    this.line(0.44, 0.6, 0.56, 0.6, 0.85, 2, 1.4, 70);
    const paper = smooth(0.62, 0.8, p) * (1 - smooth(0.92, 0.98, p));
    if (paper > 0.01) {
      const h = 0.1 * paper;
      this.box(0.455, 0.6, 0.09, h, 0.004, 0.8, 2.2, 1.1, 71);
      for (let i = 1; i <= 4; i++) if (i * 0.02 < h) this.line(0.465, 0.6 + i * 0.02, 0.535, 0.6 + i * 0.02, 0.4, 3, 1, 72 + i);
    }
    // Success tick on the screen.
    const ok = smooth(0.64, 0.7, p) * (1 - smooth(0.92, 0.98, p));
    if (ok > 0.01) {
      this.poly([[0.46, 0.3], [0.49, 0.335], [0.545, 0.27]], false, 2, ok, 1.8, 80);
      this.light(0.5, 0.3, 0.25, 0.35 * ok);
    }
    this.line(0.485, 0.76, 0.485, 0.85, 0.6, 3, 1.1, 90);
    this.line(0.515, 0.76, 0.515, 0.85, 0.6, 3, 1.1, 91);
    this.box(0.4, 0.85, 0.2, 0.02, 0.01, 0.6, 3, 1.1, 92);
  }

  /* ---------------------------- support: a shield that stops what comes in */

  private shieldPts(scale: number): P[] {
    const cx = 0.5;
    const cy = 0.52;
    const raw: P[] = [[-0.18, -0.24], [0.18, -0.24], [0.18, 0.02]];
    for (let i = 1; i <= 10; i++) {
      const u = i / 10;
      raw.push([(1 - u) * (1 - u) * 0.18 + 2 * (1 - u) * u * 0.16 + 0, (1 - u) * (1 - u) * 0.02 + 2 * (1 - u) * u * 0.18 + u * u * 0.26]);
    }
    for (let i = 1; i <= 10; i++) {
      const u = i / 10;
      raw.push([-((u * u) * 0.18 + 2 * (1 - u) * u * 0.16), (1 - u) * (1 - u) * 0.26 + 2 * (1 - u) * u * 0.18 + u * u * 0.02]);
    }
    return raw.map(([x, y]) => [cx + x * scale, cy + y * scale] as P);
  }

  private drawShield(t: number, dt: number) {
    const sweep = t * 1.2;
    for (let i = 0; i < 240; i++) {
      const a = (i / 240) * TAU;
      const d = Math.cos(a - sweep);
      const k = Math.pow(Math.max(0, d), 10);
      this.dot(0.5 + Math.cos(a) * 0.4, 0.52 + Math.sin(a) * 0.4, 1, 0.07 + 0.75 * k);
    }
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * TAU;
      this.dot(0.5 + Math.cos(a) * 0.46, 0.52 + Math.sin(a) * 0.46, 0.8, 0.12);
    }
    const flash = this.shieldFlash;
    this.poly(this.shieldPts(1), true, 2.6, 0.75 + 0.25 * flash, 1.3, 1);
    this.poly(this.shieldPts(0.85), true, 3.5, 0.25 + 0.3 * flash, 1, 2);
    if (flash > 0.02) this.light(0.5, 0.5, 0.7, flash * 0.3);
    this.shieldFlash = flash * Math.exp(-dt * 3);
    const p = (t % 5) / 5;
    const draw = smooth(0.05, 0.35, p) * (1 - smooth(0.9, 1, p));
    if (draw > 0) {
      const path: P[] = [[0.43, 0.5], [0.485, 0.565], [0.585, 0.43]];
      const L1 = Math.hypot(0.055, 0.065);
      const L2 = Math.hypot(0.1, 0.135);
      const total = (L1 + L2) * draw;
      const pts: P[] = [path[0]];
      if (total <= L1) pts.push([lerp(0.43, 0.485, total / L1), lerp(0.5, 0.565, total / L1)]);
      else pts.push(path[1], [lerp(0.485, 0.585, (total - L1) / L2), lerp(0.565, 0.43, (total - L1) / L2)]);
      this.poly(pts, false, 2, 1, 2, 3);
      this.light(0.5, 0.5, 0.3, 0.3 * draw);
    }
    if (dt > 0 && Math.random() < dt * 0.9) this.threats.push({ a: Math.random() * TAU, d: 0.55, burst: 0 });
    const keep = [];
    for (const th of this.threats) {
      if (th.burst > 0) {
        th.burst += dt;
        if (th.burst > 0.6) continue;
        const x = 0.5 + Math.cos(th.a) * th.d;
        const y = 0.52 + Math.sin(th.a) * th.d;
        const r = 0.01 + th.burst * 0.08;
        for (let i = 0; i < 16; i++) this.dot(x + Math.cos((i / 16) * TAU) * r, y + Math.sin((i / 16) * TAU) * r, 1.2, (1 - th.burst / 0.6) * 0.9, RED);
        keep.push(th);
        continue;
      }
      th.d -= dt * 0.13;
      if (th.d < 0.29) {
        th.burst = 0.001;
        this.shieldFlash = 1;
      }
      keep.push(th);
      const x = 0.5 + Math.cos(th.a) * th.d;
      const y = 0.52 + Math.sin(th.a) * th.d;
      for (let i = 0; i < 7; i++) this.dot(x + (hash(i) - 0.5) * 0.02, y + (hash(i + 9) - 0.5) * 0.02, 1.3, 0.9, RED);
      for (let i = 1; i < 6; i++) this.dot(x + Math.cos(th.a) * i * 0.008, y + Math.sin(th.a) * i * 0.008, 1, 0.5 - i * 0.08, RED);
    }
    this.threats = keep;
    this.ctx.globalAlpha = 1;
  }
}

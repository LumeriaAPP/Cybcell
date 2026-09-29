/**
 * The figure in the services section: one canvas that renders a live
 * specimen for each service's cell type. Everything is drawn from fine
 * particles with depth, in the same stardust language as the hero.
 */

export type SpecimenKind = 'tcell' | 'neuron' | 'stem' | 'rbc' | 'receptor' | 'memory';

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type V3 = [number, number, number];
interface Pt {
  p: V3;
  s: number;
  tag: number;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Uniform direction on the unit sphere. */
function dir(r: () => number): V3 {
  const u = r() * 2 - 1;
  const a = r() * TAU;
  const k = Math.sqrt(1 - u * u);
  return [Math.cos(a) * k, u, Math.sin(a) * k];
}

/** A cell as a point cloud: membrane shell, sparse cytoplasm, dense nucleus. */
function cellCloud(seed: number, shell: number, cyto: number, nucleus: number, nucR: number, nucOff: V3 = [0, 0, 0]): Pt[] {
  const r = rng(seed);
  const out: Pt[] = [];
  for (let i = 0; i < shell; i++) {
    const d = dir(r);
    const k = 1 - r() * 0.04;
    out.push({ p: [d[0] * k, d[1] * k, d[2] * k], s: r() < 0.05 ? 1.7 : 0.8 + r() * 0.5, tag: 0 });
  }
  for (let i = 0; i < cyto; i++) {
    const d = dir(r);
    const k = nucR + Math.cbrt(r()) * (0.9 - nucR);
    out.push({ p: [d[0] * k, d[1] * k, d[2] * k], s: 0.7 + r() * 0.5, tag: 1 });
  }
  for (let i = 0; i < nucleus; i++) {
    const d = dir(r);
    const k = Math.cbrt(r()) * nucR;
    out.push({ p: [d[0] * k + nucOff[0], d[1] * k + nucOff[1], d[2] * k + nucOff[2]], s: r() < 0.08 ? 1.6 : 0.7 + r() * 0.6, tag: 2 });
  }
  return out;
}

export class Specimen {
  private ctx: CanvasRenderingContext2D;
  private S = 400;
  private kind: SpecimenKind = 'tcell';
  private t = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private glow: HTMLCanvasElement;

  private tcell = cellCloud(3, 1300, 220, 700, 0.62, [0.05, -0.04, 0]);
  private spikes: V3[] = [];
  private antigen = cellCloud(8, 90, 0, 20, 0.4);
  private blob = cellCloud(5, 900, 160, 380, 0.34);
  private disc: Pt[] = [];
  private tree: { a: { x: number; y: number }; b: { x: number; y: number }; depth: number; parent: number }[] = [];
  private treeDust: { x: number; y: number; s: number; a: number }[] = [];
  private leaves: number[] = [];
  private axon: { x: number; y: number }[] = [];
  private pulses: { pts: { x: number; y: number }[]; p: number; speed: number }[] = [];
  private ligands: { x: number; y: number; vx: number; vy: number; target: number; bound: number }[] = [];
  private flash = [0, 0, 0, 0, 0];
  private ripples: { x: number; y: number; t: number }[] = [];
  private slots: number[][] = [];
  private incoming: { a: number; ring: number; slot: number; p: number }[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.glow = document.createElement('canvas');
    this.glow.width = this.glow.height = 64;
    const g = this.glow.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);

    const r = rng(21);
    for (let i = 0; i < 70; i++) this.spikes.push(dir(r));
    // Erythrocyte: a biconcave disc, dense at the rim, thin in the middle.
    for (let i = 0; i < 520; i++) {
      const a = r() * TAU;
      const rad = Math.sqrt(r());
      const thick = 0.12 + 0.28 * Math.pow(rad, 3);
      const side = r() < 0.5 ? -1 : 1;
      this.disc.push({ p: [Math.cos(a) * rad, side * thick * (0.6 + 0.4 * r()), Math.sin(a) * rad], s: 0.7 + r() * 0.6, tag: 0 });
    }

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  set(kind: SpecimenKind) {
    if (kind === this.kind) return;
    this.kind = kind;
    this.t = 0;
    this.pulses = [];
    this.ligands = [];
    this.ripples = [];
    this.incoming = [];
    this.slots = [];
    if (this.reduced) this.frame(0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      this.frame(this.reduced ? 0 : dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private resize() {
    const box = this.canvas.getBoundingClientRect();
    const size = Math.max(200, Math.round(box.width));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.S = size;
    this.buildNeuron();
    this.frame(0);
  }

  private frame(dt: number) {
    this.t += dt;
    const { ctx, S } = this;
    ctx.clearRect(0, 0, S, S);
    switch (this.kind) {
      case 'tcell':
        return this.drawTCell();
      case 'neuron':
        return this.drawNeuron(dt);
      case 'stem':
        return this.drawStem();
      case 'rbc':
        return this.drawRBC();
      case 'receptor':
        return this.drawReceptor(dt);
      case 'memory':
        return this.drawMemory(dt);
    }
  }

  /* --------------------------------------------------------------- helpers */

  /** Draw a rotated point cloud with depth-shaded particles. */
  private cloud(pts: Pt[], cx: number, cy: number, R: number, ay: number, ax: number, color = '255,255,255', alpha = 1, squash = 1) {
    const { ctx } = this;
    const cay = Math.cos(ay);
    const say = Math.sin(ay);
    const cax = Math.cos(ax);
    const sax = Math.sin(ax);
    ctx.fillStyle = `rgb(${color})`;
    for (const q of pts) {
      const [x, y, z] = q.p;
      const x1 = x * cay - z * say;
      const z1 = x * say + z * cay;
      const y2 = y * cax - z1 * sax;
      const z2 = y * sax + z1 * cax;
      const depth = clamp((z2 + 1.1) / 2.2);
      const base = q.tag === 2 ? 0.45 + 0.5 * depth : q.tag === 1 ? 0.12 + 0.35 * depth : 0.1 + 0.8 * depth * depth;
      ctx.globalAlpha = clamp(base * alpha);
      const sz = q.s * (0.7 + 0.5 * depth);
      ctx.fillRect(cx + x1 * R - sz / 2, cy + y2 * R * squash - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  private light(x: number, y: number, size: number, a: number) {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(a);
    ctx.drawImage(this.glow, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private dot(x: number, y: number, s: number, a: number, color = '255,255,255') {
    const { ctx } = this;
    ctx.globalAlpha = clamp(a);
    ctx.fillStyle = `rgb(${color})`;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------ T-lymphocyte: security */

  private drawTCell() {
    const { S, t } = this;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.23;
    const ay = t * 0.18;
    const ax = 0.3 + Math.sin(t * 0.2) * 0.1;
    this.light(cx, cy, R * 2.6, 0.18);
    this.cloud(this.tcell, cx, cy, R, ay, ax);

    // Microvilli: short particle filaments across the surface.
    const cay = Math.cos(ay);
    const say = Math.sin(ay);
    const cax = Math.cos(ax);
    const sax = Math.sin(ax);
    this.spikes.forEach((d, i) => {
      const len = 0.1 + 0.05 * Math.sin(i * 3.7 + t * 1.5);
      for (let j = 1; j <= 4; j++) {
        const k = 1 + (len * j) / 4;
        const x = d[0] * k;
        const y = d[1] * k;
        const z = d[2] * k;
        const x1 = x * cay - z * say;
        const z1 = x * say + z * cay;
        const y2 = y * cax - z1 * sax;
        const z2 = y * sax + z1 * cax;
        const depth = clamp((z2 + 1.2) / 2.4);
        this.dot(cx + x1 * R, cy + y2 * R, j === 4 ? 1.6 : 1, (0.15 + 0.7 * depth * depth) * (j === 4 ? 1 : 0.7));
      }
    });

    // Antigens drift in and dissolve at the surface.
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.09 + i / 4) % 1;
      const a = i * 1.7 + 0.5;
      const reach = R * 1.18;
      const d = S * 0.55 - (S * 0.55 - reach) * ease(clamp(p / 0.8));
      const x = cx + Math.cos(a + (1 - p) * 0.4) * d;
      const y = cy + Math.sin(a + (1 - p) * 0.4) * d;
      const fade = p < 0.8 ? clamp(p * 6) : 1 - (p - 0.8) / 0.2;
      this.cloud(this.antigen, x, y, S * 0.022 * (p < 0.8 ? 1 : 1 - (p - 0.8) * 3), t * 1.2 + i, 0.5, '229,72,77', fade);
      if (p > 0.8) this.light(x, y, S * 0.08, (1 - (p - 0.8) / 0.2) * 0.5);
    }
  }

  /* ------------------------------------------------------------ neuron: AI */

  private buildNeuron() {
    const S = this.S;
    const r = rng(11);
    const segs: typeof this.tree = [];
    const sx = S * 0.4;
    const sy = S * 0.52;
    const grow = (x: number, y: number, a: number, len: number, depth: number, parent: number) => {
      const b = { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len };
      segs.push({ a: { x, y }, b, depth, parent });
      const id = segs.length - 1;
      if (depth < 3) {
        const spread = 0.35 + r() * 0.35;
        grow(b.x, b.y, a - spread, len * (0.62 + r() * 0.12), depth + 1, id);
        grow(b.x, b.y, a + spread, len * (0.62 + r() * 0.12), depth + 1, id);
      }
    };
    for (let k = 0; k < 6; k++) {
      const a = Math.PI * 0.45 + (k / 5) * Math.PI * 1.1 + (r() - 0.5) * 0.2;
      grow(sx + Math.cos(a) * S * 0.05, sy + Math.sin(a) * S * 0.05, a, S * (0.1 + r() * 0.03), 0, -1);
    }
    this.tree = segs;
    this.leaves = segs.map((s, i) => (s.depth === 3 ? i : -1)).filter((i) => i >= 0);
    this.axon = [];
    for (let k = 0; k <= 40; k++) {
      this.axon.push({ x: sx + S * 0.06 + (k / 40) * S * 0.46, y: sy + Math.sin(k * 0.34) * S * 0.018 });
    }
    // Dendrites and axon as fine dust, thicker near the soma.
    this.treeDust = [];
    const along = (ax: number, ay: number, bx: number, by: number, width: number, density: number) => {
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.ceil(len * density);
      for (let i = 0; i < n; i++) {
        const f = r();
        const nx = -(by - ay) / len;
        const ny = (bx - ax) / len;
        const off = (r() + r() - 1) * width;
        this.treeDust.push({ x: ax + (bx - ax) * f + nx * off, y: ay + (by - ay) * f + ny * off, s: 0.7 + r() * 0.6, a: 0.3 + r() * 0.6 });
      }
    };
    for (const s of segs) along(s.a.x, s.a.y, s.b.x, s.b.y, (3 - s.depth) * 0.9 + 0.6, 0.9 - s.depth * 0.12);
    for (let k = 0; k < this.axon.length - 1; k++) {
      const p = this.axon[k];
      const q = this.axon[k + 1];
      const myelin = k % 8 > 1 && k < this.axon.length - 4;
      along(p.x, p.y, q.x, q.y, myelin ? 3.2 : 1, myelin ? 2.2 : 1);
    }
    const end = this.axon[this.axon.length - 1];
    for (let k = -2; k <= 2; k++) {
      const a = k * 0.42;
      along(end.x, end.y, end.x + Math.cos(a) * S * 0.05, end.y + Math.sin(a) * S * 0.05, 0.6, 1);
    }
  }

  private drawNeuron(dt: number) {
    const { S, t } = this;
    const sx = S * 0.4;
    const sy = S * 0.52;
    for (let i = 0; i < this.treeDust.length; i++) {
      const d = this.treeDust[i];
      this.dot(d.x, d.y, d.s, d.a * (0.8 + 0.2 * Math.sin(t * 1.5 + i)));
    }
    this.light(sx, sy, S * 0.22, 0.25);
    this.cloud(this.blob, sx, sy, S * 0.07, t * 0.3, 0.3);

    if (dt > 0 && Math.random() < dt * 2.2 && this.leaves.length) {
      let i = this.leaves[(Math.random() * this.leaves.length) | 0];
      const pts: { x: number; y: number }[] = [];
      while (i >= 0) {
        const s = this.tree[i];
        pts.push(s.b);
        if (s.parent < 0) pts.push(s.a);
        i = s.parent;
      }
      pts.push({ x: sx, y: sy }, ...this.axon);
      this.pulses.push({ pts, p: 0, speed: 0.4 + Math.random() * 0.2 });
    }
    const keep = [];
    for (const pu of this.pulses) {
      pu.p += dt * pu.speed;
      if (pu.p >= 1) continue;
      keep.push(pu);
      const f = pu.p * (pu.pts.length - 1);
      const i = Math.floor(f);
      const a = pu.pts[i];
      const b = pu.pts[Math.min(i + 1, pu.pts.length - 1)];
      const x = a.x + (b.x - a.x) * (f - i);
      const y = a.y + (b.y - a.y) * (f - i);
      this.light(x, y, 22, 0.8);
      this.dot(x, y, 2, 1);
    }
    this.pulses = keep;
  }

  /* ------------------------------------------------ stem cell: software */

  private drawStem() {
    const { S, t } = this;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.2;
    const p = (t / 8) % 1;
    const split = ease(clamp((p - 0.3) / 0.45));
    const fade = 1 - clamp((p - 0.88) / 0.12);
    const a = split * R * 0.95;
    const ay = t * 0.2;
    const cay = Math.cos(ay);
    const say = Math.sin(ay);
    const ax = 0.35;
    const cax = Math.cos(ax);
    const sax = Math.sin(ax);
    const { ctx } = this;
    ctx.fillStyle = '#fff';
    this.light(cx, cy, R * 3, 0.15 * fade);
    // Each particle belongs to the half it sits in; halves move apart and round up.
    for (const q of this.blob) {
      let [x, y, z] = q.p;
      const side = x < 0 ? -1 : 1;
      const round = 1 - split * 0.22;
      x = x * round;
      y *= round;
      z *= round;
      // Pinch the cleavage furrow as the halves separate.
      const pinch = 1 - 0.55 * split * Math.exp(-(x * x) / 0.05);
      y *= pinch;
      z *= pinch;
      const x1 = (x * cay - z * say) * R + side * a;
      const z1 = x * say + z * cay;
      const y2 = y * cax - z1 * sax;
      const z2 = y * sax + z1 * cax;
      const depth = clamp((z2 + 1.1) / 2.2);
      let alpha = q.tag === 2 ? 0.45 + 0.5 * depth : q.tag === 1 ? 0.12 + 0.35 * depth : 0.1 + 0.8 * depth * depth;
      if (q.tag === 2 && p > 0.3 && p < 0.72) alpha *= 0.25; // nucleus dissolves in mitosis
      ctx.globalAlpha = clamp(alpha * fade);
      const sz = q.s * (0.7 + 0.5 * depth);
      ctx.fillRect(cx + x1 - sz / 2, cy + y2 * R - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    // Chromosomes line up, then pull to the poles.
    if (p > 0.3 && p < 0.75) {
      const q = clamp((p - 0.3) / 0.45);
      const apart = ease(clamp((q - 0.3) / 0.7)) * a * 0.9;
      for (let k = 0; k < 10; k++) {
        const yy = cy + (k - 4.5) * R * 0.07;
        for (const s of [-1, 1]) {
          this.light(cx + s * (apart + 2), yy, 10, 0.5 * fade);
          this.dot(cx + s * (apart + 2), yy, 1.8, fade);
        }
      }
    }
    if (p > 0.88) {
      const q = (p - 0.88) / 0.12;
      this.cloud(this.blob, cx, cy, R * q, ay, ax, '255,255,255', q);
    }
  }

  /* ------------------------------------------- erythrocytes: cloud/devops */

  private drawRBC() {
    const { S, t } = this;
    // Vessel walls as faint dust.
    for (let i = 0; i < 900; i++) {
      const x = ((i * 0.61803) % 1) * S;
      const side = i % 2 ? -1 : 1;
      const layer = ((i * 0.7548) % 1) * 7;
      const y = S / 2 + side * (S * 0.34 + layer + Math.sin(x * 0.02 + side + t * 0.3) * 6);
      this.dot(x, y, 0.9, 0.35 - layer * 0.035);
    }
    // Plasma flow.
    for (let k = 0; k < 90; k++) {
      const x = ((k * 97.13 + t * (30 + (k % 5) * 10)) % (S + 20)) - 10;
      const y = S / 2 + (((k * 0.618) % 1) - 0.5) * S * 0.6;
      this.dot(x, y, 0.9, 0.2);
    }
    const n = 7;
    for (let i = 0; i < n; i++) {
      const lane = ((i * 0.618) % 1) - 0.5;
      const speed = 0.045 + (i % 3) * 0.01;
      const x = (((t * speed + i / n) % 1) * 1.5 - 0.25) * S;
      const y = S / 2 + lane * S * 0.44 + Math.sin(t * 0.7 + i) * 4;
      const R = S * (0.075 + (i % 2) * 0.012);
      this.light(x, y, R * 2.4, 0.08);
      this.cloud(this.disc, x, y, R, t * 0.3 + i, 0.9 + Math.sin(t * 0.4 + i) * 0.5);
    }
  }

  /* ------------------------------------------------ receptor: IoT/sensors */

  private drawReceptor(dt: number) {
    const { S, t } = this;
    const cx = S / 2;
    const cy = S * 1.05;
    const R = S * 0.64;
    // Lipid bilayer: two dense dust arcs with sparse tails between.
    for (let k = 0; k < 900; k++) {
      const a = -Math.PI / 2 - 1.2 + ((k * 0.61803) % 1) * 2.4;
      const layer = k % 3;
      const wob = Math.sin(a * 22 + t * 1.2) * 1.2;
      const rr = R + wob + (layer === 0 ? 8 : layer === 1 ? -8 : ((k * 7) % 13) - 6);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      this.dot(x, y, layer === 2 ? 0.8 : 1.3, layer === 2 ? 0.2 : 0.65);
    }
    // Interior haze.
    for (let k = 0; k < 220; k++) {
      const a = -Math.PI / 2 - 1.1 + ((k * 0.7548) % 1) * 2.2;
      const rr = R - 16 - ((k * 0.381) % 1) * S * 0.3;
      this.dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.8, 0.15);
    }
    const tips = [-0.5, -0.25, 0, 0.25, 0.5].map((o) => {
      const a = -Math.PI / 2 + o;
      return { a, bx: cx + Math.cos(a) * R, by: cy + Math.sin(a) * R, tx: cx + Math.cos(a) * (R + S * 0.1), ty: cy + Math.sin(a) * (R + S * 0.1) };
    });
    // Receptors as particle filaments: a stem and two arms.
    tips.forEach((r, i) => {
      const f = this.flash[i];
      const m = { x: cx + Math.cos(r.a) * (R + S * 0.06), y: cy + Math.sin(r.a) * (R + S * 0.06) };
      const line = (x0: number, y0: number, x1: number, y1: number, n: number) => {
        for (let j = 0; j <= n; j++) {
          const q = j / n;
          this.dot(x0 + (x1 - x0) * q, y0 + (y1 - y0) * q, 1.3, 0.55 + f * 0.45);
        }
      };
      line(cx + Math.cos(r.a) * (R - 14), cy + Math.sin(r.a) * (R - 14), m.x, m.y, 14);
      for (const s of [-1, 1]) {
        const aa = r.a + s * 0.5;
        line(m.x, m.y, m.x + Math.cos(aa) * S * 0.05, m.y + Math.sin(aa) * S * 0.05, 7);
      }
      if (f > 0.05) this.light(m.x, m.y, 30, f * 0.7);
      this.flash[i] = f * Math.exp(-dt * 2.5);
    });

    if (dt > 0 && Math.random() < dt * 1.2 && this.ligands.length < 7) {
      this.ligands.push({ x: Math.random() * S, y: -8, vx: 0, vy: 0, target: (Math.random() * 5) | 0, bound: 0 });
    }
    const alive = [];
    for (const l of this.ligands) {
      const tip = tips[l.target];
      if (l.bound > 0) {
        l.bound += dt;
        if (l.bound > 0.6) continue;
      } else {
        const dx = tip.tx - l.x;
        const dy = tip.ty - l.y;
        const d = Math.hypot(dx, dy) || 1;
        l.vx = (l.vx + (dx / d) * 30 * dt + Math.sin(t * 3 + l.x) * 10 * dt) * 0.98;
        l.vy = (l.vy + (dy / d) * 30 * dt) * 0.98;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        if (d < 8) {
          l.bound = 0.001;
          this.flash[l.target] = 1;
          this.ripples.push({ x: tip.bx, y: tip.by, t: 0 });
        }
      }
      alive.push(l);
      this.cloud(this.antigen, l.x, l.y, 5, t + l.target, 0.4, '255,255,255', l.bound ? 1 - l.bound / 0.6 : 1);
    }
    this.ligands = alive;
    // Signal spreading inside the cell as a ring of dust.
    const rip = [];
    for (const r of this.ripples) {
      r.t += dt;
      if (r.t > 1.4) continue;
      rip.push(r);
      const rad = 6 + r.t * S * 0.32;
      for (let k = 0; k < 60; k++) {
        const a = Math.PI * 0.1 + (k / 60) * Math.PI * 0.8;
        this.dot(r.x + Math.cos(a) * rad, r.y + Math.sin(a) * rad, 1.1, 0.6 * (1 - r.t / 1.4));
      }
    }
    this.ripples = rip;
  }

  /* ------------------------------------------------ memory B-cell: data */

  private drawMemory(dt: number) {
    const { S, t } = this;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.3;
    const rings = [
      { r: 0.34, n: 10, speed: 0.3 },
      { r: 0.58, n: 16, speed: -0.2 },
      { r: 0.8, n: 24, speed: 0.13 },
    ];
    if (!this.slots.length) this.slots = rings.map((g) => Array.from({ length: g.n }, (_, k) => (k % 3 === 0 ? 1 : 0)));
    this.light(cx, cy, R * 2.4, 0.15);
    this.cloud(this.blob.filter((q) => q.tag === 0), cx, cy, R, t * 0.12, 0.35);
    const tiltY = 0.55;
    rings.forEach((g, ri) => {
      for (let k = 0; k < 90; k++) {
        const a = (k / 90) * TAU + t * g.speed * 0.5;
        this.dot(cx + Math.cos(a) * R * g.r, cy + Math.sin(a) * R * g.r * tiltY, 0.8, 0.18);
      }
      for (let k = 0; k < g.n; k++) {
        const a = (k / g.n) * TAU + t * g.speed;
        const x = cx + Math.cos(a) * R * g.r;
        const y = cy + Math.sin(a) * R * g.r * tiltY;
        const depth = (Math.sin(a) + 1) / 2;
        if (this.slots[ri][k]) {
          this.light(x, y, 14, 0.4 + 0.4 * depth);
          this.dot(x, y, 1.8, 0.7 + 0.3 * depth);
        } else this.dot(x, y, 1.2, 0.25 + 0.3 * depth);
      }
    });
    this.light(cx, cy, 30, 0.6);

    if (dt > 0 && Math.random() < dt * 1.1 && this.incoming.length < 3) {
      const ri = (Math.random() * 3) | 0;
      const empty = this.slots[ri].map((v, k) => (v ? -1 : k)).filter((k) => k >= 0);
      if (!empty.length) this.slots[ri] = this.slots[ri].map((_, k) => (k % 3 === 0 ? 1 : 0));
      else this.incoming.push({ a: Math.random() * TAU, ring: ri, slot: empty[(Math.random() * empty.length) | 0], p: 0 });
    }
    const keep = [];
    for (const m of this.incoming) {
      m.p += dt * 0.7;
      const g = rings[m.ring];
      const ta = (m.slot / g.n) * TAU + t * g.speed;
      const tx = cx + Math.cos(ta) * R * g.r;
      const ty = cy + Math.sin(ta) * R * g.r * tiltY;
      const sx = cx + Math.cos(m.a) * S * 0.62;
      const sy = cy + Math.sin(m.a) * S * 0.62;
      const e = ease(clamp(m.p));
      if (m.p >= 1) {
        this.slots[m.ring][m.slot] = 1;
        continue;
      }
      keep.push(m);
      for (let j = 0; j < 6; j++) {
        const q = Math.max(0, e - j * 0.02);
        this.dot(sx + (tx - sx) * q, sy + (ty - sy) * q, 1.4 - j * 0.15, 1 - j * 0.15);
      }
      this.light(sx + (tx - sx) * e, sy + (ty - sy) * e, 16, 0.6);
    }
    this.incoming = keep;
  }
}

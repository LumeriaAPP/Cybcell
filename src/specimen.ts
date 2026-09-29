/**
 * The microscope viewer in the services section: one canvas that renders a
 * live specimen for each service's cell type.
 */

export type SpecimenKind = 'tcell' | 'neuron' | 'stem' | 'rbc' | 'receptor' | 'memory';

const TAU = Math.PI * 2;
// Monochrome figure: grey structure, white highlights, red only for antigens.
const PEARL = '210, 210, 210';
const AMBER = '255, 255, 255';
const RED = '229, 72, 77';
const col = (c: string, a: number) => `rgba(${c}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

interface Seg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  depth: number;
  parent: number;
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

  // neuron
  private tree: Seg[] = [];
  private leaves: number[] = [];
  private axon: { x: number; y: number }[] = [];
  private pulses: { pts: { x: number; y: number }[]; p: number; speed: number }[] = [];
  // receptor
  private ligands: { x: number; y: number; vx: number; vy: number; target: number; bound: number }[] = [];
  private receptorFlash = [0, 0, 0, 0, 0];
  private ripples: { x: number; y: number; t: number }[] = [];
  // memory
  private slots: number[][] = [];
  private incoming: { a: number; ring: number; slot: number; p: number }[] = [];
  private chromatin: { x: number; y: number; r: number }[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    const r = rng(7);
    for (let i = 0; i < 34; i++) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * 0.55;
      this.chromatin.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.6 + r() * 1.4 });
    }
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
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (this.kind) {
      case 'tcell':
        this.drawTCell();
        break;
      case 'neuron':
        this.drawNeuron(dt);
        break;
      case 'stem':
        this.drawStem();
        break;
      case 'rbc':
        this.drawRBC();
        break;
      case 'receptor':
        this.drawReceptor(dt);
        break;
      case 'memory':
        this.drawMemory(dt);
        break;
    }
  }

  /* --------------------------------------------------------------- helpers */

  private blob(cx: number, cy: number, r: number, wob: number, seed: number, n = 90) {
    const { ctx, t } = this;
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * TAU;
      const rr = r * (1 + wob * Math.sin(a * 3 + t * 0.9 + seed) + wob * 0.6 * Math.sin(a * 5 - t * 0.7 + seed * 2));
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  private glow(x: number, y: number, r: number, c: string, a: number, blur = 14) {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = col(c, a);
    ctx.shadowBlur = blur;
    ctx.fillStyle = col(c, a);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private membrane(fill: number, stroke: number, width = 1.4) {
    const { ctx } = this;
    ctx.fillStyle = col(PEARL, fill);
    ctx.fill();
    ctx.strokeStyle = col(PEARL, stroke);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  private drawChromatin(cx: number, cy: number, r: number, a: number) {
    for (const c of this.chromatin) {
      this.ctx.fillStyle = col(PEARL, 0.35 * a);
      this.ctx.beginPath();
      this.ctx.arc(cx + c.x * r, cy + c.y * r, c.r, 0, TAU);
      this.ctx.fill();
    }
  }

  /* ------------------------------------------------ T-lymphocyte: security */

  private drawTCell() {
    const { ctx, S, t } = this;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.21;

    // Microvilli with amber receptor tips.
    const n = 46;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + Math.sin(t * 0.25) * 0.04;
      const len = R * (0.13 + 0.07 * Math.sin(k * 3.7 + t * 1.8));
      const x0 = cx + Math.cos(a) * R * 0.98;
      const y0 = cy + Math.sin(a) * R * 0.98;
      const x1 = cx + Math.cos(a) * (R + len);
      const y1 = cy + Math.sin(a) * (R + len);
      ctx.strokeStyle = col(PEARL, 0.45);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.fillStyle = col(AMBER, 0.75);
      ctx.beginPath();
      ctx.arc(x1, y1, 1.6, 0, TAU);
      ctx.fill();
    }

    this.blob(cx, cy, R, 0.025, 1);
    this.membrane(0.06, 0.85, 1.6);
    this.blob(cx + R * 0.06, cy - R * 0.04, R * 0.66, 0.03, 4);
    this.membrane(0.08, 0.45, 1);
    this.drawChromatin(cx + R * 0.06, cy - R * 0.04, R * 0.62, 1);

    // Antigens drift in and are caught at the surface.
    for (let i = 0; i < 5; i++) {
      const p = (t * 0.11 + i / 5) % 1;
      const a = i * 1.37 + 0.4;
      const d = S * 0.5 - (S * 0.5 - R * 1.22) * ease(clamp(p / 0.85));
      const x = cx + Math.cos(a + (1 - p) * 0.5) * d;
      const y = cy + Math.sin(a + (1 - p) * 0.5) * d;
      if (p < 0.85) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 2 + i);
        ctx.strokeStyle = col(RED, 0.9);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const aa = (k / 12) * TAU;
          const rr = k % 2 ? 3 : 6.5;
          if (k) ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
          else ctx.moveTo(rr, 0);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        const q = (p - 0.85) / 0.15;
        ctx.strokeStyle = col(AMBER, 0.9 * (1 - q));
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, 4 + q * 26, 0, TAU);
        ctx.stroke();
        this.glow(x, y, 3 * (1 - q), AMBER, 1 - q);
      }
    }
  }

  /* ------------------------------------------------------------ neuron: AI */

  private buildNeuron() {
    const S = this.S;
    const r = rng(11);
    const segs: Seg[] = [];
    const sx = S * 0.4;
    const sy = S * 0.52;
    const grow = (x: number, y: number, a: number, len: number, depth: number, parent: number) => {
      const x1 = x + Math.cos(a) * len;
      const y1 = y + Math.sin(a) * len;
      segs.push({ x0: x, y0: y, x1, y1, depth, parent });
      const id = segs.length - 1;
      if (depth < 3) {
        const spread = 0.35 + r() * 0.35;
        grow(x1, y1, a - spread, len * (0.62 + r() * 0.12), depth + 1, id);
        grow(x1, y1, a + spread, len * (0.62 + r() * 0.12), depth + 1, id);
      }
    };
    const roots = 6;
    for (let k = 0; k < roots; k++) {
      const a = Math.PI * 0.45 + (k / (roots - 1)) * Math.PI * 1.1 + (r() - 0.5) * 0.2;
      const R0 = S * 0.055;
      grow(sx + Math.cos(a) * R0, sy + Math.sin(a) * R0, a, S * (0.1 + r() * 0.03), 0, -1);
    }
    this.tree = segs;
    this.leaves = segs.map((s, i) => (s.depth === 3 ? i : -1)).filter((i) => i >= 0);
    this.axon = [];
    for (let k = 0; k <= 30; k++) {
      const x = sx + S * 0.06 + (k / 30) * S * 0.46;
      this.axon.push({ x, y: sy + Math.sin(k * 0.45) * S * 0.018 });
    }
  }

  private drawNeuron(dt: number) {
    const { ctx, S, t } = this;
    const sx = S * 0.4;
    const sy = S * 0.52;

    for (const s of this.tree) {
      ctx.strokeStyle = col(PEARL, 0.62 - s.depth * 0.1);
      ctx.lineWidth = 2.6 - s.depth * 0.55;
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      ctx.lineTo(s.x1, s.y1);
      ctx.stroke();
    }
    // Axon with myelin sheaths and terminal buttons.
    ctx.strokeStyle = col(PEARL, 0.5);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    this.axon.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    for (let k = 3; k < this.axon.length - 3; k += 5) {
      const p = this.axon[k];
      const q = this.axon[k + 3];
      ctx.strokeStyle = col(PEARL, 0.28);
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    const end = this.axon[this.axon.length - 1];
    for (let k = -2; k <= 2; k++) {
      const a = k * 0.42;
      const x = end.x + Math.cos(a) * S * 0.05;
      const y = end.y + Math.sin(a) * S * 0.05;
      ctx.strokeStyle = col(PEARL, 0.45);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = col(AMBER, 0.55 + 0.45 * Math.sin(t * 3 + k));
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, TAU);
      ctx.fill();
    }

    this.blob(sx, sy, S * 0.07, 0.05, 2, 60);
    this.membrane(0.1, 0.9, 1.6);
    this.glow(sx, sy, S * 0.018, PEARL, 0.8, 10);

    // Spawn pulses from leaves, through the soma, down the axon.
    if (dt > 0 && Math.random() < dt * 2.4 && this.leaves.length) {
      let i = this.leaves[(Math.random() * this.leaves.length) | 0];
      const pts: { x: number; y: number }[] = [];
      while (i >= 0) {
        const s = this.tree[i];
        pts.push({ x: s.x1, y: s.y1 });
        if (s.parent < 0) pts.push({ x: s.x0, y: s.y0 });
        i = s.parent;
      }
      pts.push({ x: sx, y: sy }, ...this.axon);
      this.pulses.push({ pts, p: 0, speed: 0.45 + Math.random() * 0.2 });
    }
    const next = [];
    for (const pu of this.pulses) {
      pu.p += dt * pu.speed;
      if (pu.p >= 1) continue;
      next.push(pu);
      const f = pu.p * (pu.pts.length - 1);
      const i = Math.floor(f);
      const a = pu.pts[i];
      const b = pu.pts[Math.min(i + 1, pu.pts.length - 1)];
      const x = a.x + (b.x - a.x) * (f - i);
      const y = a.y + (b.y - a.y) * (f - i);
      this.glow(x, y, 2.6, AMBER, 0.95, 16);
    }
    this.pulses = next;
  }

  /* ------------------------------------------------ stem cell: software */

  private cassini(cx: number, cy: number, a: number, b: number, alpha: number) {
    const { ctx } = this;
    const scale = 1;
    const pts = (from: number, to: number, sign: 1 | -1, steps: number) => {
      const out: [number, number][] = [];
      for (let k = 0; k <= steps; k++) {
        const th = from + ((to - from) * k) / steps;
        const A = a * a * Math.cos(2 * th);
        const D = b ** 4 - a ** 4 * Math.sin(2 * th) ** 2;
        if (D < 0) continue;
        const r2 = A + sign * Math.sqrt(D);
        if (r2 < 0) continue;
        const r = Math.sqrt(r2) * (1 + 0.02 * Math.sin(th * 5 + this.t));
        out.push([cx + Math.cos(th) * r * scale, cy + Math.sin(th) * r * scale]);
      }
      return out;
    };
    const path = (list: [number, number][]) => {
      ctx.beginPath();
      list.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = col(PEARL, 0.07 * alpha);
      ctx.fill();
      ctx.strokeStyle = col(PEARL, 0.85 * alpha);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    };
    if (a < b * 0.999) path(pts(0, TAU, 1, 160));
    else {
      const tm = 0.5 * Math.asin(Math.min(1, (b * b) / (a * a))) - 1e-4;
      for (const base of [0, Math.PI]) {
        const outer = pts(base - tm, base + tm, 1, 80);
        const inner = pts(base + tm, base - tm, -1, 80);
        path([...outer, ...inner]);
      }
    }
  }

  private drawStem() {
    const { S, t } = this;
    const cx = S / 2;
    const cy = S / 2;
    const b = S * 0.2;
    const P = 7;
    const p = (t / P) % 1;
    const split = ease(clamp((p - 0.3) / 0.45));
    const a = b * (0.12 + 1.2 * split);
    const fade = 1 - clamp((p - 0.9) / 0.1);
    this.cassini(cx, cy, a, b, fade);

    // Nucleus → chromosomes → two nuclei.
    if (p < 0.3) {
      this.blob(cx, cy, b * 0.42, 0.04, 3, 60);
      this.membrane(0.08, 0.5, 1);
      this.drawChromatin(cx, cy, b * 0.4, 1);
    } else if (p < 0.72) {
      const q = clamp((p - 0.3) / 0.42);
      const apart = ease(clamp((q - 0.35) / 0.65)) * a * 0.85;
      for (let k = 0; k < 8; k++) {
        const y = cy + (k - 3.5) * b * 0.09;
        for (const s of [-1, 1]) {
          const x = cx + s * (apart + 3);
          this.ctx.strokeStyle = col(AMBER, 0.9 * fade);
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(x - 4 * s, y - 3);
          this.ctx.lineTo(x + 4 * s, y + 3);
          this.ctx.stroke();
        }
      }
      // Spindle fibres.
      if (q > 0.1) {
        this.ctx.strokeStyle = col(PEARL, 0.18 * fade);
        this.ctx.lineWidth = 0.8;
        for (let k = 0; k < 9; k++) {
          const y = cy + (k - 4) * b * 0.08;
          this.ctx.beginPath();
          this.ctx.moveTo(cx - a * 1.1 - b * 0.3, cy);
          this.ctx.quadraticCurveTo(cx, y * 1 + (y - cy) * 0.8, cx + a * 1.1 + b * 0.3, cy);
          this.ctx.stroke();
        }
      }
    } else {
      for (const s of [-1, 1]) {
        const x = cx + s * a * 0.95;
        this.blob(x, cy, b * 0.3, 0.05, 5 + s, 50);
        this.membrane(0.08 * fade, 0.5 * fade, 1);
        this.glow(x, cy, 2.5, AMBER, 0.8 * fade, 12);
      }
    }
    // A new mother cell fades in as the daughters leave.
    if (p > 0.9) {
      const q = (p - 0.9) / 0.1;
      this.blob(cx, cy, b * q, 0.02, 1, 90);
      this.membrane(0.05 * q, 0.6 * q, 1.4);
    }
    void t;
  }

  /* ------------------------------------------- erythrocytes: cloud/devops */

  private drawRBC() {
    const { ctx, S, t } = this;
    // Vessel walls.
    for (const side of [-1, 1]) {
      ctx.strokeStyle = col(PEARL, 0.22);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 6) {
        const y = S / 2 + side * (S * 0.3 + Math.sin(x * 0.02 + side + t * 0.4) * 6);
        if (x) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // Plasma flow.
    for (let k = 0; k < 40; k++) {
      const x = ((k * 97.13 + t * (40 + (k % 5) * 12)) % (S + 40)) - 20;
      const y = S / 2 + (((k * 53.7) % 1) - 0.5) * S * 0.5 + Math.sin(k) * S * 0.2;
      ctx.fillStyle = col(PEARL, 0.18);
      ctx.fillRect(x, y, 6, 1);
    }
    const n = 9;
    for (let i = 0; i < n; i++) {
      const lane = ((i * 0.618) % 1) - 0.5;
      const speed = 0.05 + (i % 3) * 0.012;
      const x = (((t * speed + i / n) % 1) * 1.4 - 0.2) * S;
      const y = S / 2 + lane * S * 0.42 + Math.sin(t * 0.8 + i) * 4;
      const r = S * (0.065 + (i % 2) * 0.012);
      const phi = t * (0.5 + (i % 4) * 0.15) + i;
      const squash = 0.3 + 0.7 * Math.abs(Math.cos(phi));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.4 * Math.sin(i + t * 0.3));
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * squash, 0, 0, TAU);
      ctx.fillStyle = col(PEARL, 0.06);
      ctx.fill();
      ctx.strokeStyle = col(PEARL, 0.8);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.48, r * 0.48 * squash, 0, 0, TAU);
      ctx.strokeStyle = col(PEARL, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
      // Cargo.
      for (let k = 0; k < 4; k++) {
        const a = k * 1.57 + phi * 0.3;
        ctx.fillStyle = col(AMBER, 0.9);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72 * squash, 1.8, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------ receptor: IoT/sensors */

  private receptorTips() {
    const S = this.S;
    const cx = S / 2;
    const cy = S * 1.02;
    const R = S * 0.62;
    return [-0.5, -0.25, 0, 0.25, 0.5].map((o) => {
      const a = -Math.PI / 2 + o;
      return {
        a,
        bx: cx + Math.cos(a) * R,
        by: cy + Math.sin(a) * R,
        tx: cx + Math.cos(a) * (R + S * 0.1),
        ty: cy + Math.sin(a) * (R + S * 0.1),
      };
    });
  }

  private drawReceptor(dt: number) {
    const { ctx, S, t } = this;
    const cx = S / 2;
    const cy = S * 1.02;
    const R = S * 0.62;
    const tips = this.receptorTips();

    // Lipid bilayer: heads on two arcs, tails between.
    const span = 2.3;
    const count = 104;
    for (let k = 0; k <= count; k++) {
      const a = -Math.PI / 2 - span / 2 + (k / count) * span;
      const wob = Math.sin(a * 20 + t * 1.5) * 1.2;
      const ro = R + 7 + wob;
      const ri = R - 7 + wob;
      ctx.strokeStyle = col(PEARL, 0.25);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (ro - 2.5), cy + Math.sin(a) * (ro - 2.5));
      ctx.lineTo(cx + Math.cos(a) * (ri + 2.5), cy + Math.sin(a) * (ri + 2.5));
      ctx.stroke();
      for (const rr of [ro, ri]) {
        ctx.fillStyle = col(PEARL, 0.7);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2.1, 0, TAU);
        ctx.fill();
      }
    }

    // Receptors: a stem through the membrane and a Y on top.
    tips.forEach((r, i) => {
      const f = this.receptorFlash[i];
      const c = f > 0.05 ? AMBER : PEARL;
      ctx.strokeStyle = col(c, 0.85);
      ctx.lineWidth = 2.2;
      const ix = cx + Math.cos(r.a) * (R - 14);
      const iy = cy + Math.sin(r.a) * (R - 14);
      const mx = cx + Math.cos(r.a) * (R + S * 0.06);
      const my = cy + Math.sin(r.a) * (R + S * 0.06);
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(mx, my);
      for (const s of [-1, 1]) {
        const aa = r.a + s * 0.5;
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(aa) * S * 0.05, my + Math.sin(aa) * S * 0.05);
      }
      ctx.stroke();
      if (f > 0.05) this.glow(mx, my, 3 + f * 3, AMBER, f, 20);
      this.receptorFlash[i] = f * Math.exp(-dt * 2.5);
    });

    // Ligands from the environment.
    if (dt > 0 && Math.random() < dt * 1.3 && this.ligands.length < 8) {
      this.ligands.push({ x: Math.random() * S, y: -10, vx: 0, vy: 0, target: (Math.random() * 5) | 0, bound: 0 });
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
        const d = Math.hypot(dx, dy);
        l.vx += (dx / d) * 30 * dt + Math.sin(t * 3 + l.x) * 10 * dt;
        l.vy += (dy / d) * 30 * dt;
        l.vx *= 0.98;
        l.vy *= 0.98;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        if (d < 8) {
          l.bound = 0.001;
          this.receptorFlash[l.target] = 1;
          this.ripples.push({ x: tip.bx, y: tip.by, t: 0 });
        }
      }
      alive.push(l);
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(t + l.target);
      ctx.fillStyle = col(AMBER, l.bound ? 1 - l.bound / 0.6 : 0.95);
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
    }
    this.ligands = alive;

    // Signal ripples spreading inside the cell.
    const rip = [];
    for (const r of this.ripples) {
      r.t += dt;
      if (r.t > 1.4) continue;
      rip.push(r);
      ctx.strokeStyle = col(AMBER, 0.6 * (1 - r.t / 1.4));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + r.t * S * 0.35, 0, TAU);
      ctx.stroke();
    }
    this.ripples = rip;
  }

  /* ------------------------------------------------ memory B-cell: data */

  private drawMemory(dt: number) {
    const { ctx, S, t } = this;
    const cx = S / 2;
    const cy = S / 2;
    const R = S * 0.3;
    const rings = [
      { r: 0.36, n: 8, speed: 0.35 },
      { r: 0.6, n: 14, speed: -0.22 },
      { r: 0.84, n: 22, speed: 0.14 },
    ];
    if (!this.slots.length) this.slots = rings.map((g) => Array.from({ length: g.n }, (_, k) => (k % 3 === 0 ? 1 : 0)));

    this.blob(cx, cy, R, 0.02, 6);
    this.membrane(0.05, 0.8, 1.6);

    rings.forEach((g, ri) => {
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = col(PEARL, 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R * g.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let k = 0; k < g.n; k++) {
        const a = (k / g.n) * TAU + t * g.speed;
        const x = cx + Math.cos(a) * R * g.r;
        const y = cy + Math.sin(a) * R * g.r;
        const on = this.slots[ri][k];
        if (on > 0) this.glow(x, y, 2.4, AMBER, 0.95, 12);
        else {
          ctx.fillStyle = col(PEARL, 0.4);
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, TAU);
          ctx.fill();
        }
      }
    });
    this.glow(cx, cy, 5, PEARL, 0.9, 16);

    // New memories fly in and take an empty slot.
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
      const ty = cy + Math.sin(ta) * R * g.r;
      const sx = cx + Math.cos(m.a) * S * 0.62;
      const sy = cy + Math.sin(m.a) * S * 0.62;
      const e = ease(clamp(m.p));
      const x = sx + (tx - sx) * e;
      const y = sy + (ty - sy) * e;
      if (m.p >= 1) {
        this.slots[m.ring][m.slot] = 1;
        ctx.strokeStyle = col(AMBER, 0.8);
        ctx.beginPath();
        ctx.arc(tx, ty, 9, 0, TAU);
        ctx.stroke();
        continue;
      }
      keep.push(m);
      ctx.strokeStyle = col(AMBER, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + (tx - sx) * Math.max(0, e - 0.15), sy + (ty - sy) * Math.max(0, e - 0.15));
      ctx.lineTo(x, y);
      ctx.stroke();
      this.glow(x, y, 2.6, AMBER, 1, 14);
    }
    this.incoming = keep;
  }
}

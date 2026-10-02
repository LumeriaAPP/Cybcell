/**
 * A one-time cell-to-logo introduction and three quiet story illustrations.
 * Static scene layers are cached; the canvas has no animation loop at rest.
 */
export const SCENES = [
  'hero', 'name', 'single', 'division', 'signal', 'building',
  'marketing', 'immune', 'organism', 'ambient',
] as const;
export type SceneId = (typeof SCENES)[number];
export const ACTIVE_SCENES = ['hero', 'name', 'single', 'signal', 'organism', 'ambient'] as const;
type ActiveScene = (typeof ACTIVE_SCENES)[number];
type Point = { x: number; y: number };
type WordPoint = Point & { sx: number; sy: number; size: number; delay: number };

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export interface EngineStats { cells: number; links: number; sps: number }

export class CellEngine {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private mobile = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private enabled = false;
  private raf = 0;
  private last = 0;
  private scene = 0;
  private target = 0;
  private intro = 0;
  private word: WordPoint[] = [];
  // At most two viewport layers stay in memory, including on phones.
  private layers = new Map<ActiveScene, HTMLCanvasElement>();
  readonly stats: EngineStats = { cells: 0, links: 0, sps: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.resize();
    this.reduced.addEventListener('change', () => {
      if (this.reduced.matches) {
        this.intro = 1;
        this.scene = this.target;
        this.cancelFrame();
        this.draw();
      } else this.wake();
    });
  }

  /** Position along ACTIVE_SCENES, rather than the old seven-stage story. */
  setScene(position: number) {
    const target = clamp(position, 0, ACTIVE_SCENES.length - 1);
    if (Math.abs(this.target - target) < 0.0001) return;
    this.target = target;
    // Scrolling never replays the logo introduction.
    if (target > 0.08) this.intro = 1;
    if (this.reduced.matches) {
      this.scene = target;
      if (this.enabled) this.draw();
    } else this.wake();
  }

  weight(id: SceneId) {
    const index = ACTIVE_SCENES.indexOf(id as ActiveScene);
    const a = Math.floor(this.scene);
    const b = Math.min(a + 1, ACTIVE_SCENES.length - 1);
    const t = ease(this.scene - a);
    return (index === a ? 1 - t : 0) + (index === b ? t : 0);
  }

  start() {
    if (this.enabled) return;
    this.enabled = true;
    if (this.reduced.matches) {
      this.intro = 1;
      this.scene = this.target;
      this.draw();
      return;
    }
    this.draw();
    this.wake();
  }

  stop() {
    this.enabled = false;
    this.cancelFrame();
  }

  refreshWord() {
    this.sampleWord();
    this.layers.delete('hero');
    this.draw();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const mobile = w < 820;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.mobile = mobile;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layers.clear();
    this.sampleWord();
    this.draw();
  }

  private cancelFrame() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private wake() {
    if (!this.enabled || this.raf || this.reduced.matches) return;
    if (this.intro >= 1 && Math.abs(this.scene - this.target) < 0.002) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (!this.enabled) return;
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.intro = clamp(this.intro + dt / (this.mobile ? 0.9 : 1.45));
    this.scene = mix(this.scene, this.target, 1 - Math.exp(-dt * 22));
    if (Math.abs(this.scene - this.target) < 0.002) this.scene = this.target;
    this.draw();
    if (this.intro < 1 || this.scene !== this.target) {
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  private draw() {
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.w, this.h);
    const a = Math.floor(this.scene);
    const b = Math.min(a + 1, ACTIVE_SCENES.length - 1);
    const t = ease(this.scene - a);
    const drawLayer = (id: ActiveScene, opacity: number) => {
      if (opacity < 0.001 || id === 'ambient') return;
      if (id === 'hero' && this.intro < 1 && !this.reduced.matches) {
        this.drawWord(ctx, this.intro, opacity);
      } else {
        ctx.globalAlpha = opacity;
        ctx.drawImage(this.layer(id), 0, 0, this.w, this.h);
      }
    };
    drawLayer(ACTIVE_SCENES[a], 1 - t);
    if (b !== a) drawLayer(ACTIVE_SCENES[b], t);
    ctx.globalAlpha = 1;
  }

  private layer(id: ActiveScene) {
    const cached = this.layers.get(id);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#fff';
    switch (id) {
      case 'hero': this.drawWord(ctx, 1, 1); break;
      case 'name': this.drawStars(ctx); break;
      case 'single': this.drawSingle(ctx); break;
      case 'signal': this.drawSignal(ctx); break;
      case 'organism': this.drawOrganism(ctx); break;
      case 'ambient': break;
    }
    if (this.layers.size >= 2) this.layers.delete(this.layers.keys().next().value!);
    this.layers.set(id, canvas);
    return canvas;
  }

  private sampleWord() {
    const mask = document.createElement('canvas');
    const ctx = mask.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const maxWidth = Math.min(this.w * (this.mobile ? 0.86 : 0.72), 1080);
    const font = (size: number) => `600 ${size}px Geist, "Helvetica Neue", Arial, sans-serif`;
    ctx.font = font(100);
    const size = maxWidth / ctx.measureText('CybCell').width * 100;
    mask.width = Math.ceil(maxWidth + 12);
    mask.height = Math.ceil(size * 1.3);
    ctx.font = font(size);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.fillText('CybCell', 4, 0);
    const pixels = ctx.getImageData(0, 0, mask.width, mask.height).data;
    const points: Point[] = [];
    const spacing = this.mobile ? 2.7 : 4;
    for (let y = 0; y < mask.height; y += spacing) {
      for (let x = 0; x < mask.width; x += spacing) {
        if (pixels[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3] > 90) {
          points.push({ x, y });
        }
      }
    }
    const cap = this.mobile ? 750 : 2400;
    const stride = Math.max(1, Math.ceil(points.length / cap));
    const ox = (this.w - mask.width) / 2;
    const oy = this.h * (this.mobile ? 0.32 : 0.36) - size * 0.44;
    this.word = points.filter((_, i) => i % stride === 0).map((point, i) => ({
      x: ox + point.x,
      y: oy + point.y,
      sx: this.w * (0.05 + hash(i + 3) * 0.9),
      sy: this.h * (0.1 + hash(i + 90) * 0.65),
      size: this.mobile ? 1.3 : 1.6,
      delay: hash(i + 26) * 0.18,
    }));
  }

  private drawWord(ctx: CanvasRenderingContext2D, progress: number, opacity: number) {
    ctx.fillStyle = '#f1f3f5';
    for (const point of this.word) {
      const t = clamp((progress - point.delay) / (1 - point.delay));
      const gather = 1 - Math.pow(1 - t, 3);
      const size = point.size * (1 + (1 - gather) * 1.5);
      ctx.globalAlpha = opacity * (0.2 + t * 0.7);
      ctx.fillRect(mix(point.sx, point.x, gather), mix(point.sy, point.y, gather), size, size);
    }
    ctx.globalAlpha = 1;
  }

  /** The concept section uses tiny, sparse stars; no large cells or glow. */
  private drawStars(ctx: CanvasRenderingContext2D) {
    const count = this.mobile ? 36 : 84;
    for (let i = 0; i < count; i++) {
      const x = hash(i + 211) * this.w;
      const y = hash(i + 722) * this.h;
      const size = 0.55 + hash(i + 90) * 0.65;
      ctx.globalAlpha = 0.11 + hash(i + 315) * 0.17;
      ctx.fillRect(x, y, size, size);
      if (i % 19 === 0) {
        ctx.globalAlpha = 0.09;
        ctx.fillRect(x - 1, y + size / 2, size + 2, 0.45);
        ctx.fillRect(x + size / 2, y - 1, 0.45, size + 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  private center(): Point {
    return { x: this.w * (this.mobile ? 0.5 : 0.72), y: this.h * (this.mobile ? 0.24 : 0.5) };
  }

  private unit() {
    return this.mobile ? Math.min(this.w * 0.32, this.h * 0.18) : Math.min(this.w * 0.18, this.h * 0.3);
  }

  /** Fine membrane dots and a small visible nucleus form each cell. */
  private cell(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, alpha = 1) {
    const count = Math.round(clamp(r * 4, 44, this.mobile ? 250 : 420));
    ctx.fillStyle = '#e6ebf0';
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < count; i++) {
        const angle = i / count * TAU;
        const radius = r * (0.95 + hash(seed + i + ring * 600) * 0.06 - ring * 0.08);
        ctx.globalAlpha = alpha * (0.24 + hash(i + seed + 710) * 0.45) * (ring ? 0.45 : 1);
        ctx.fillRect(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 1.05, 1.05);
      }
    }
    const nucleus = r * 0.15;
    ctx.globalAlpha = alpha * 0.55;
    ctx.beginPath();
    ctx.arc(x + r * 0.04, y - r * 0.035, nucleus, 0, TAU);
    ctx.strokeStyle = '#e6ebf0';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    for (let i = 0; i < 20; i++) {
      const angle = hash(seed + i + 900) * TAU;
      const radius = Math.sqrt(hash(seed + i + 300)) * nucleus * 0.8;
      ctx.globalAlpha = alpha * (0.15 + hash(i + seed) * 0.3);
      ctx.fillRect(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  private drawSingle(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.center();
    this.cell(ctx, x, y, this.unit() * 0.7, 27);
    this.stats.cells = 1;
    this.stats.links = 0;
  }

  private drawSignal(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.center();
    const unit = this.unit();
    const nodes: Point[] = [{ x, y }];
    const count = this.mobile ? 6 : 8;
    for (let i = 0; i < count; i++) {
      const angle = i / count * TAU + 0.2;
      nodes.push({ x: x + Math.cos(angle) * unit, y: y + Math.sin(angle) * unit * 0.72 });
    }
    ctx.strokeStyle = 'rgba(228,235,244,0.14)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i < nodes.length; i++) {
      const node = nodes[i];
      const next = nodes[i === nodes.length - 1 ? 1 : i + 1];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(node.x, node.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      // One quiet light marks a signal, without a perpetual loop.
      ctx.globalAlpha = 0.7;
      ctx.fillRect(mix(x, node.x, 0.56), mix(y, node.y, 0.56), 1.8, 1.8);
    }
    nodes.forEach((node, i) => this.cell(ctx, node.x, node.y, unit * (i ? 0.14 : 0.22), i * 47));
    this.stats.cells = nodes.length;
    this.stats.links = count * 2;
  }

  private drawOrganism(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.center();
    const unit = this.unit();
    const count = this.mobile ? 15 : 25;
    const radius = unit * (this.mobile ? 0.23 : 0.2);
    for (let i = 0; i < count; i++) {
      const spread = Math.sqrt(i / count) * unit * 0.88;
      this.cell(ctx, x + Math.cos(i * GOLDEN) * spread, y + Math.sin(i * GOLDEN) * spread * 0.78, radius, i * 71, 0.78);
    }
    this.stats.cells = count;
    this.stats.links = 0;
  }
}

/**
 * Living paintings: every [data-painting] element gets its own small WebGL canvas that shows the
 * painting displaced by its depth map, so near figures slide past far ones as the page scrolls.
 *
 * Markup: <div data-painting="key" data-strength=".03" data-focus=".5" data-pos="50 40">
 *           <img src="./art/key.webp" alt="…">
 *         </div>
 * The <img> stays as the fallback (no WebGL, reduced motion) and sits under the canvas.
 * Canvases are created near the viewport and released far from it, so only a handful of WebGL
 * contexts exist at once. On phones the paintings only redraw while the page is scrolling, and
 * weak devices keep the still image.
 */
import { touch, weak } from './device';

const VERT = `
attribute vec2 p;
varying vec2 v;
void main() {
  v = vec2(p.x * .5 + .5, .5 - p.y * .5);
  gl_Position = vec4(p, 0., 1.);
}`;

const FRAG = `
precision mediump float;
varying vec2 v;
uniform sampler2D uC;
uniform sampler2D uD;
uniform vec2 uRes;
uniform vec2 uImg;
uniform vec2 uOff;
uniform vec2 uPos;
uniform float uFocus;
uniform float uZoom;
uniform float uMargin;
uniform float uShade;

void main() {
  float ra = uRes.x / uRes.y;
  float ia = uImg.x / uImg.y;
  vec2 s = ra > ia ? vec2(1., ia / ra) : vec2(ra / ia, 1.);
  s /= uZoom;
  vec2 m = s * uMargin;
  vec2 o = mix(m, 1. - s - m, uPos);
  // Solve q + off * (depth(q) - focus) = v: the pixel that lands here after displacement.
  vec2 q = v;
  for (int i = 0; i < 5; i++) {
    float d = texture2D(uD, o + q * s).r;
    q = v - uOff * (d - uFocus);
  }
  vec3 c = texture2D(uC, clamp(o + q * s, 0., 1.)).rgb;
  vec2 e = v - .5;
  c *= 1. - uShade * dot(e, e) * 1.8;
  gl_FragColor = vec4(c, 1.);
}`;

export interface Drive {
  /** extra offset in frame units, added by scroll scenes */
  x: number;
  y: number;
  /** extra zoom multiplier */
  zoom: number;
}

interface Item {
  el: HTMLElement;
  img: HTMLImageElement;
  key: string;
  strength: number;
  focus: number;
  pos: [number, number];
  zoom: number;
  shade: number;
  lateral: number;
  phase: number;
  drive: Drive;
  near: boolean;
  visible: boolean;
  canvas?: HTMLCanvasElement;
  gl?: WebGLRenderingContext;
  u?: Record<string, WebGLUniformLocation | null>;
  imgSize?: [number, number];
  ready?: boolean;
  w: number;
  h: number;
}

const items: Item[] = [];
const byEl = new Map<Element, Item>();
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
let running = false;
let maxDpr = 1.6;
/** On touch devices nothing moves the paintings except scrolling: draw only until this time. */
let wakeUntil = 0;
const idle = touch ? 0 : 1;
const cache = new Map<string, Promise<HTMLImageElement>>();

function load(src: string) {
  let p = cache.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

function compile(gl: WebGLRenderingContext) {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['uC', 'uD', 'uRes', 'uImg', 'uOff', 'uPos', 'uFocus', 'uZoom', 'uMargin', 'uShade']) {
    u[n] = gl.getUniformLocation(prog, n);
  }
  gl.uniform1i(u.uC, 0);
  gl.uniform1i(u.uD, 1);
  return u;
}

function texture(gl: WebGLRenderingContext, unit: number, im: TexImageSource) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
}

/** Shrink an image that is larger than the GPU allows. */
function fit(gl: WebGLRenderingContext, im: HTMLImageElement): TexImageSource {
  const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  if (im.naturalWidth <= max && im.naturalHeight <= max) return im;
  const s = max / Math.max(im.naturalWidth, im.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.floor(im.naturalWidth * s);
  c.height = Math.floor(im.naturalHeight * s);
  c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
  return c;
}

async function activate(it: Item) {
  if (it.canvas) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'painting__gl';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) return;
  it.canvas = canvas;
  it.gl = gl;
  try {
    it.u = compile(gl);
  } catch {
    it.canvas = undefined;
    return;
  }
  const base = it.img.currentSrc || it.img.src;
  const depthSrc = base.replace(/\.webp(\?.*)?$/, '.d.jpg');
  try {
    const [c, d] = await Promise.all([load(base), load(depthSrc)]);
    if (it.canvas !== canvas || gl.isContextLost()) return;
    texture(gl, 0, fit(gl, c));
    texture(gl, 1, d);
    it.imgSize = [c.naturalWidth, c.naturalHeight];
    it.ready = true;
    size(it);
    it.el.appendChild(canvas);
    requestAnimationFrame(() => canvas.classList.add('is-on'));
    kick();
  } catch {
    release(it);
  }
}

function release(it: Item) {
  if (!it.canvas) return;
  it.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  it.canvas.remove();
  it.canvas = undefined;
  it.gl = undefined;
  it.ready = false;
}

function size(it: Item) {
  if (!it.canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(it.el.clientWidth * dpr));
  const h = Math.max(1, Math.round(it.el.clientHeight * dpr));
  if (it.canvas.width !== w || it.canvas.height !== h) {
    it.canvas.width = w;
    it.canvas.height = h;
  }
  it.w = w;
  it.h = h;
}

function draw(it: Item, t: number, vw: number, vh: number) {
  const gl = it.gl!;
  const u = it.u!;
  const r = it.el.getBoundingClientRect();
  const ny = Math.max(-1.2, Math.min(1.2, (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2)));
  const nx = Math.max(-1.2, Math.min(1.2, (r.left + r.width / 2 - vw / 2) / (vw / 2 + r.width / 2)));
  const s = it.strength;
  const ox = nx * s * it.lateral - pointer.x * s * 0.45 + idle * Math.sin(t * 0.00031 + it.phase) * s * 0.12 + it.drive.x;
  const oy = ny * s - pointer.y * s * 0.3 + idle * Math.cos(t * 0.00023 + it.phase) * s * 0.1 + it.drive.y;
  const margin = s * 0.75;
  gl.viewport(0, 0, it.w, it.h);
  gl.uniform2f(u.uRes, it.w, it.h);
  gl.uniform2f(u.uImg, it.imgSize![0], it.imgSize![1]);
  gl.uniform2f(u.uOff, ox, oy);
  gl.uniform2f(u.uPos, it.pos[0], it.pos[1]);
  gl.uniform1f(u.uFocus, it.focus);
  gl.uniform1f(u.uZoom, Math.max(it.zoom * it.drive.zoom, 1 + 2 * margin));
  gl.uniform1f(u.uMargin, margin);
  gl.uniform1f(u.uShade, it.shade);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function frame(t: number) {
  pointer.x += (pointer.tx - pointer.x) * 0.05;
  pointer.y += (pointer.ty - pointer.y) * 0.05;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let any = false;
  for (const it of items) {
    if (!it.visible || !it.ready || !it.gl) continue;
    any = true;
    draw(it, t, vw, vh);
  }
  running = any && (!touch || t < wakeUntil);
  if (running) requestAnimationFrame(frame);
}

function kick() {
  wakeUntil = performance.now() + 900;
  if (running) return;
  running = true;
  requestAnimationFrame(frame);
}

export function drive(el: Element): Drive | undefined {
  return byEl.get(el)?.drive;
}

export function initPaintings(root: ParentNode = document) {
  if (weak) return false;
  const probe = document.createElement('canvas').getContext('webgl');
  if (!probe) return false;
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  if (matchMedia('(pointer: coarse)').matches) maxDpr = 1.3;

  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-painting]'));
  els.forEach((el, i) => {
    const img = el.querySelector('img');
    if (!img) return;
    const [px, py] = (el.dataset.pos ?? '50 50').split(/\s+/).map((n) => Number(n) / 100);
    const it: Item = {
      el,
      img,
      key: el.dataset.painting!,
      strength: Number(el.dataset.strength ?? 0.03),
      focus: Number(el.dataset.focus ?? 0.5),
      pos: [px, py ?? px],
      zoom: Number(el.dataset.zoom ?? 1),
      shade: Number(el.dataset.shade ?? 0.35),
      lateral: Number(el.dataset.lateral ?? 0.4),
      phase: i * 1.7,
      drive: { x: 0, y: 0, zoom: 1 },
      near: false,
      visible: false,
      w: 1,
      h: 1,
    };
    items.push(it);
    byEl.set(el, it);
  });

  const nearIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const it = byEl.get(e.target)!;
        it.near = e.isIntersecting;
        if (it.near) activate(it);
        else release(it);
      }
    },
    { rootMargin: '120% 120% 120% 120%' },
  );
  const seenIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const it = byEl.get(e.target)!;
        it.visible = e.isIntersecting;
      }
      kick();
    },
    { rootMargin: '10% 10% 10% 10%' },
  );
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const it = byEl.get(e.target);
      if (it) size(it);
    }
  });
  for (const it of items) {
    nearIO.observe(it.el);
    seenIO.observe(it.el);
    ro.observe(it.el);
  }

  if (touch) addEventListener('scroll', kick, { passive: true });
  if (matchMedia('(hover: hover)').matches) {
    window.addEventListener(
      'pointermove',
      (e) => {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true },
    );
  }
  document.documentElement.classList.add('gl');
  return true;
}

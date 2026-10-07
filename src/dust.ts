/**
 * Gold dust hanging in the candlelight in front of the altarpiece. Motes nearer the viewer are
 * larger, faster and shift more with the pointer. Runs only while the hero is on screen.
 */
interface Mote {
  x: number;
  y: number;
  z: number;
  r: number;
  vx: number;
  vy: number;
  tw: number;
}

export function initDust(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const motes: Mote[] = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let visible = true;
  let raf = 0;
  const px = { x: 0, y: 0, tx: 0, ty: 0 };

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const count = Math.round(Math.min(110, (w * h) / 14000));
    motes.length = 0;
    for (let i = 0; i < count; i++) {
      const z = Math.random() ** 1.6;
      motes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z,
        r: 0.4 + z * 1.6,
        vx: (Math.random() - 0.5) * 0.06,
        vy: -(0.04 + z * 0.16),
        tw: Math.random() * Math.PI * 2,
      });
    }
  };

  const frame = (t: number) => {
    raf = 0;
    if (!visible) return;
    px.x += (px.tx - px.x) * 0.04;
    px.y += (px.ty - px.y) * 0.04;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.x += m.vx + Math.sin(t * 0.0004 + m.tw) * 0.05;
      m.y += m.vy;
      if (m.y < -10) {
        m.y = h + 10;
        m.x = Math.random() * w;
      }
      if (m.x < -10) m.x = w + 10;
      if (m.x > w + 10) m.x = -10;
      const a = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.0012 + m.tw))) * (0.25 + m.z * 0.6);
      const x = m.x - px.x * m.z * 26;
      const y = m.y - px.y * m.z * 16;
      ctx.fillStyle = `rgba(243, 219, 147, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, Math.PI * 2);
      ctx.fill();
      if (m.z > 0.7) {
        ctx.fillStyle = `rgba(243, 219, 147, ${(a * 0.12).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, m.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    raf = requestAnimationFrame(frame);
  };

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }).observe(canvas);
  if (matchMedia('(hover: hover)').matches) {
    addEventListener(
      'pointermove',
      (e) => {
        px.tx = (e.clientX / innerWidth) * 2 - 1;
        px.ty = (e.clientY / innerHeight) * 2 - 1;
      },
      { passive: true },
    );
  }
  resize();
  raf = requestAnimationFrame(frame);
}

/**
 * One gesture = one stage. Inside the story zone a wheel notch, swipe or
 * arrow key glides the page to the next (or previous) stop; the scene
 * animations play during the glide. Below the zone the page scrolls normally.
 */

export function initStepper(getStops: () => number[], zoneEnd: () => number) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let animating = false;
  let lastWheel = 0;
  let wheelAcc = 0;
  let touchY: number | null = null;

  const inZone = (dirn: number) => {
    const end = zoneEnd();
    return scrollY < end - 2 || (dirn < 0 && scrollY <= end + 2);
  };

  const glide = (to: number) => {
    const from = scrollY;
    const dist = Math.abs(to - from);
    if (dist < 2) return;
    const dur = reduced ? 1 : Math.min(1700, 750 + dist * 0.35);
    const start = performance.now();
    animating = true;
    document.documentElement.style.scrollBehavior = 'auto';
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      scrollTo(0, from + (to - from) * ease(k));
      if (k < 1) requestAnimationFrame(step);
      else {
        animating = false;
        document.documentElement.style.scrollBehavior = '';
      }
    };
    requestAnimationFrame(step);
  };

  const go = (dirn: number) => {
    const stops = getStops();
    const y = scrollY;
    const target = dirn > 0 ? stops.find((s) => s > y + 4) : [...stops].reverse().find((s) => s < y - 4);
    if (target !== undefined) glide(target);
  };

  addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) return;
      const dirn = Math.sign(e.deltaY);
      if (!dirn || !inZone(dirn)) return;
      e.preventDefault();
      const now = performance.now();
      // A trackpad fires a long tail of events; only a fresh gesture counts.
      const fresh = now - lastWheel > 220;
      lastWheel = now;
      if (animating) return;
      if (fresh) wheelAcc = 0;
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) > 20) {
        wheelAcc = 0;
        go(dirn);
        lastWheel = now + 400;
      }
    },
    { passive: false },
  );

  addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY), { passive: true });
  addEventListener(
    'touchmove',
    (e) => {
      if (touchY === null) return;
      const dirn = Math.sign(touchY - e.touches[0].clientY);
      if (dirn && inZone(dirn)) e.preventDefault();
    },
    { passive: false },
  );
  addEventListener('touchend', (e) => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    const dirn = Math.sign(dy);
    if (Math.abs(dy) < 30 || !inZone(dirn) || animating) return;
    go(dirn);
  });

  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]')) return;
    const down = ['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey;
    const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    const dirn = down ? 1 : up ? -1 : 0;
    if (!dirn || !inZone(dirn)) return;
    e.preventDefault();
    if (!animating) go(dirn);
  });
}

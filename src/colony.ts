/**
 * Drives the living colony from the page: every [data-scene] element is a keyframe at its
 * centre, and the scroll position between two keyframes blends their scenes. The hero's
 * keyframe sits at the end of its pin, so the single cell holds while the altarpiece opens.
 * After the story the colony thins out behind the agency sections; on phones it sleeps there.
 *
 * Nothing here reads layout on scroll: anchors are measured on refresh, the rest is arithmetic.
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CellEngine, SCENES, type SceneId } from './engine/cells';

interface Anchor {
  scene: number;
  center: number;
}

export interface Colony {
  setInk: (v: number) => void;
}

export function initColony(canvas: HTMLCanvasElement, onRefresh: (fn: () => void) => void): Colony | undefined {
  let engine: CellEngine;
  try {
    engine = new CellEngine(canvas);
  } catch {
    canvas.remove();
    return;
  }
  engine.jump(SCENES.indexOf('single'));
  if (import.meta.env.DEV) Object.assign(window, { __engine: engine });

  let anchors: Anchor[] = [];
  const phone = matchMedia('(max-width: 1080px)');

  const measure = () => {
    anchors = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-scene]')) {
      const scene = SCENES.indexOf(el.dataset.scene as SceneId);
      if (scene < 0) continue;
      let center: number;
      if (el.classList.contains('hero')) {
        const box = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el;
        center = box.getBoundingClientRect().bottom + scrollY - innerHeight / 2;
      } else {
        const r = el.getBoundingClientRect();
        center = r.top + scrollY + r.height / 2;
      }
      anchors.push({ scene, center });
    }
    anchors.sort((a, b) => a.center - b.center);
  };

  const position = () => {
    const y = scrollY + innerHeight / 2;
    if (!anchors.length) return SCENES.indexOf('single');
    if (y <= anchors[0].center) return anchors[0].scene;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      if (y <= b.center) return a.scene + ((y - a.center) / (b.center - a.center)) * (b.scene - a.scene);
    }
    return anchors[anchors.length - 1].scene;
  };

  // Past the story the colony is only a texture: fainter on desktop, asleep on phones.
  let past = false;
  const sync = () => {
    const sleep = past && phone.matches;
    canvas.classList.toggle('is-ambient', past);
    canvas.style.visibility = sleep ? 'hidden' : '';
    if (sleep || document.hidden) engine.stop();
    else engine.start();
  };
  ScrollTrigger.create({
    trigger: '#services',
    start: 'top 50%',
    end: 'max',
    onToggle: (st) => {
      past = st.isActive;
      sync();
    },
  });

  const update = () => engine.setScene(position());

  // Refreshes also happen on load, font swaps and tab switches; rebuilding the canvas then
  // would blank it for a frame, so only resize when the window really changed size.
  let size = `${innerWidth}x${innerHeight}`;
  onRefresh(() => {
    const now = `${innerWidth}x${innerHeight}`;
    if (now !== size) {
      size = now;
      engine.resize();
    }
    measure();
    update();
  });
  addEventListener('scroll', update, { passive: true });
  document.addEventListener('visibilitychange', sync);
  document.fonts?.ready.then(() => {
    engine.refreshWord();
    measure();
    update();
  });

  measure();
  update();
  sync();
  return { setInk: (v) => engine.setInk(v) };
}

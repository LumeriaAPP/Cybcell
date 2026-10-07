/** Mobile menu sheet and the burger that opens it; shared by every page. */
import { onLang, t } from './i18n';
import { lenis } from './scenes';

export function initMenu() {
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const burger = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (!menu || !burger) return { close: () => {} };

  const set = (open: boolean) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', t(open ? 'nav.close' : 'nav.menu'));
    document.body.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      lenis?.stop();
    } else {
      menu.classList.remove('is-open');
      lenis?.start();
      setTimeout(() => {
        if (burger.getAttribute('aria-expanded') === 'false') menu.hidden = true;
      }, 350);
    }
  };

  burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      set(false);
      burger.focus();
    }
  });
  matchMedia('(min-width: 861px)').addEventListener('change', (e) => e.matches && set(false));
  onLang(() => burger.setAttribute('aria-label', t(burger.getAttribute('aria-expanded') === 'true' ? 'nav.close' : 'nav.menu')));
  // Links to another page close the sheet on their way out.
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => set(false)));
  return { close: () => set(false) };
}

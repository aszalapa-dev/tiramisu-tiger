(() => {
  'use strict';

  const menu = document.createElement('dialog');
  menu.className = 'mobile-menu';
  menu.id = 'mobile-menu';
  menu.setAttribute('aria-label', 'Navigation');
  menu.innerHTML = `
    <div class="menu-heading"><a href="#accueil" aria-label="Tiratiti, accueil"><img src="assets/logo-tiratiti-ink.svg" alt="Tiratiti" width="157" height="48"></a><button type="button" data-close-dialog aria-label="Fermer le menu" autofocus>×</button></div>
    <nav aria-label="Navigation mobile"><a href="#histoire">L’HISTOIRE <span>↗</span></a><a href="#parfums">LES GOÛTS <span>↗</span></a><a href="revendeurs.html#adresses">OÙ NOUS TROUVER <span>↗</span></a></nav>
    <div class="menu-secondary"><a href="revendeurs.html#contact">Devenir revendeur ↗</a><a href="#evenements">Pour vos événements ↗</a></div>`;

  document.body.append(menu);
  const dialogs = [menu];
  const returnFocus = new WeakMap();
  let scrollLock = null;

  function openDialog(dialog, trigger) {
    if (dialog.open) return;
    const existing = document.querySelector('dialog[open]');
    const restoreTarget = trigger;
    if (existing) existing.close();
    returnFocus.set(dialog, restoreTarget);
    if (scrollLock === null) {
      scrollLock = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
    }
    dialog.showModal();
    dialog.querySelector('[autofocus]')?.focus({ preventScroll: true });
    if (dialog === menu) document.querySelectorAll('[data-menu-toggle]').forEach(button => button.setAttribute('aria-expanded', 'true'));
  }

  for (const dialog of dialogs) {
    dialog.addEventListener('click', event => {
      if (event.target.closest('[data-close-dialog]')) dialog.close();
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (dialog === menu) document.querySelectorAll('[data-menu-toggle]').forEach(button => button.setAttribute('aria-expanded', 'false'));

      if (dialogs.some(item => item.open)) return;
      if (scrollLock !== null) {
        document.documentElement.style.overflow = scrollLock;
        scrollLock = null;
      }
      const trigger = returnFocus.get(dialog);
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
    });
  }

  for (const dialog of dialogs) dialog.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => {
    const destination = document.getElementById(link.hash.slice(1));
    const focusTarget = destination?.querySelector('h1, h2') || destination;
    if (focusTarget) {
      // Continue keyboard navigation at the chosen section after leaving the menu.
      if (!focusTarget.hasAttribute('tabindex')) {
        focusTarget.setAttribute('tabindex', '-1');
        focusTarget.addEventListener('blur', () => focusTarget.removeAttribute('tabindex'), { once: true });
      }
      returnFocus.set(dialog, focusTarget);
    }
    dialog.close();
  }));
  document.querySelectorAll('[data-menu-toggle]').forEach(button => {
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'mobile-menu');
    button.setAttribute('aria-haspopup', 'dialog');
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-menu-toggle]');
    if (!button) return;
    event.preventDefault();
    openDialog(menu, button);
  });
})();

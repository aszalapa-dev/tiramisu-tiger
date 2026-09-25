(() => {
  'use strict';

  const products = {
    classique: { name: 'Le Classique', image: 'assets/classique.png?v=photo-25', note: 'Boudoirs, café, mascarpone et cacao.' },
    speculoos: { name: 'Le Spéculos', image: 'assets/speculoos.png', note: 'Spéculos et crème au mascarpone.' },
    special: { name: 'Le Spécial', image: 'assets/special.webp', note: 'Pane di Stelle au cacao et mascarpone.' }
  };
  const cartKey = 'tiratiti-cart-v1';

  let cart = {};

  try {
    const saved = JSON.parse(localStorage.getItem(cartKey) || '{}');
    for (const id of Object.keys(products)) {
      if (Number.isInteger(saved?.[id]) && saved[id] > 0) cart[id] = Math.min(saved[id], 99);
    }

  } catch { /* The experience also works when local storage is unavailable. */ }

  const drawer = document.createElement('dialog');
  drawer.className = 'shop-drawer';
  drawer.id = 'shop-drawer';
  drawer.setAttribute('aria-labelledby', 'shop-title');
  drawer.innerHTML = `
    <div class="shop-heading"><h2 id="shop-title">TA<br>SÉLECTION.</h2><button class="shop-close" type="button" data-close-dialog aria-label="Fermer ma sélection" autofocus>×</button></div>
    <p class="shop-intro">Garde tes goûts préférés sous la main.</p>
    <div class="shop-content"></div>
    <div class="shop-footer"><p class="shop-total"></p><a class="shop-checkout" href="#ou-nous-trouver">OÙ NOUS TROUVER ↗</a><p class="shop-note">Cette sélection reste sur ton appareil. Pour les disponibilités et les commandes, écris à <a href="mailto:contact@tiratiti.be">contact@tiratiti.be</a>.</p></div>
    <p class="shop-announcement" role="status" aria-live="polite"></p>`;

  const menu = document.createElement('dialog');
  menu.className = 'mobile-menu';
  menu.id = 'mobile-menu';
  menu.setAttribute('aria-label', 'Navigation');
  menu.innerHTML = `
    <div class="menu-heading"><a href="#accueil" aria-label="Tiratiti, accueil"><img src="assets/logo-tiratiti-ink.svg" alt="Tiratiti" width="157" height="48"></a><button type="button" data-close-dialog aria-label="Fermer le menu" autofocus>×</button></div>
    <nav aria-label="Navigation mobile"><a href="#histoire">L’HISTOIRE <span>↗</span></a><a href="#parfums">LES GOÛTS <span>↗</span></a><a href="#ou-nous-trouver">OÙ NOUS TROUVER <span>↗</span></a></nav>
    <div class="menu-secondary"><a href="#revendeurs">Devenir revendeur ↗</a><a href="#evenements">Pour vos événements ↗</a></div>`;

  document.body.append(drawer, menu);
  const dialogs = [drawer, menu];
  const returnFocus = new WeakMap();
  let scrollLock = null;

  function openDialog(dialog, trigger) {
    if (dialog.open) return;
    const existing = document.querySelector('dialog[open]');
    const fallbackTrigger = returnFocus.get(existing);
    const triggerDialog = trigger?.closest('dialog');
    const productId = trigger?.dataset.addProduct;
    const restoreTarget = triggerDialog
      ? returnFocus.get(triggerDialog) || fallbackTrigger
        || (products[productId] && document.querySelector(`[data-flavor="${productId}"]`))
        || document.querySelector('[data-open-cart]')
      : trigger;
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

  function saveCart() {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch { /* No storage is required to select a pot. */ }
  }

  function productVisual(product) {
    return product.image
      ? `<img src="${product.image}" alt="" width="160" height="180">`
      : '<span class="shop-special" aria-hidden="true"><span>✦ ✧ ✦</span><strong>LE<br>SPÉCIAL.</strong><small>PANE DI STELLE</small></span>';
  }

  function renderCart(focusAction) {
    const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
    document.querySelectorAll('[data-cart-count]').forEach(element => {
      element.textContent = String(count);
      element.hidden = count === 0;
    });
    document.querySelectorAll('[data-open-cart]').forEach(button => {
      button.setAttribute('aria-label', `Ouvrir ma sélection, ${count} ${count === 1 ? 'canette' : 'canettes'}`);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'shop-drawer');
    });
    drawer.querySelector('.shop-total').textContent = count ? `${count} ${count === 1 ? 'canette sélectionnée' : 'canettes sélectionnées'}` : 'LEQUEL TE FAIT CRAQUER ?';
    drawer.querySelector('.shop-content').innerHTML = count ? `<ul class="shop-lines">${Object.entries(cart).map(([id, quantity]) => `
      <li class="shop-line"><div class="shop-picture">${productVisual(products[id])}</div><div class="shop-line-copy"><h3>${products[id].name}</h3><p>${products[id].note}</p><div class="shop-quantity"><button type="button" data-cart-action="decrease" data-product="${id}" aria-label="Retirer une canette ${products[id].name}">−</button><span aria-label="Quantité : ${quantity}">${quantity}</span><button type="button" data-cart-action="increase" data-product="${id}" aria-label="Ajouter une canette ${products[id].name}" ${quantity >= 99 ? 'disabled' : ''}>+</button></div><button class="shop-remove" type="button" data-cart-action="remove" data-product="${id}">Retirer <span class="shop-sr-only">${products[id].name}</span></button></div></li>`).join('')}</ul><button class="shop-continue" type="button" data-close-dialog>CONTINUER LA DÉCOUVERTE ↗</button>` : `
      <p class="shop-empty">TROUVE TON<br>PETIT FAIBLE.</p><div class="shop-suggestions">${Object.entries(products).map(([id, product]) => `<button type="button" class="shop-suggestion" data-add-product="${id}">${productVisual(product)}<span>${product.name}</span><span class="shop-add-label">CHOISIR +</span></button>`).join('')}</div>`;
    if (focusAction) {
      const next = drawer.querySelector(`[data-cart-action="${focusAction.action}"][data-product="${focusAction.id}"]:not(:disabled)`)
        || drawer.querySelector('[data-cart-action]:not(:disabled), [data-add-product]')
        || drawer.querySelector('.shop-close');
      next.focus({ preventScroll: true });
    }
  }

  function addProduct(id, trigger) {
    if (!products[id]) return;
    cart[id] = Math.min(99, (cart[id] || 0) + 1);
    saveCart();
    renderCart();
    openDialog(drawer, trigger);
    if (!drawer.contains(document.activeElement)) drawer.querySelector('.shop-close').focus({ preventScroll: true });
    drawer.querySelector('.shop-announcement').textContent = `${products[id].name} ajouté à ta sélection.`;
  }

  drawer.addEventListener('click', event => {
    const button = event.target.closest('[data-cart-action]');
    if (!button) return;
    const id = button.dataset.product;
    const action = button.dataset.cartAction;
    if (!cart[id]) return;
    if (action === 'increase') cart[id] = Math.min(99, cart[id] + 1);
    else if (action === 'decrease' && cart[id] > 1) cart[id] -= 1;
    else delete cart[id];
    saveCart();
    renderCart({ id, action });
    drawer.querySelector('.shop-announcement').textContent = cart[id] ? `${products[id].name} : ${cart[id]} ${cart[id] === 1 ? 'canette' : 'canettes'}.` : `${products[id].name} retiré de ta sélection.`;
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-open-cart], [data-add-product], [data-menu-toggle]');
    if (!button) return;
    event.preventDefault();
    if (button.hasAttribute('data-add-product')) addProduct(button.dataset.addProduct, button);
    else if (button.hasAttribute('data-open-cart')) { renderCart(); openDialog(drawer, button); }
    else if (button.hasAttribute('data-menu-toggle')) openDialog(menu, button);

  });

  window.addEventListener('storage', event => {
    if (event.key !== cartKey) return;
    try {
      const saved = JSON.parse(event.newValue || '{}');
      cart = {};
      for (const id of Object.keys(products)) if (Number.isInteger(saved?.[id]) && saved[id] > 0) cart[id] = Math.min(saved[id], 99);
      renderCart();
    } catch { /* Ignore malformed selections from another tab. */ }
  });
  renderCart();
})();

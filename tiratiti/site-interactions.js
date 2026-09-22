(() => {
  'use strict';

  const products = {
    classique: { name: 'Le Classique', image: 'assets/classique.png', note: 'Café, crème, cacao.' },
    speculoos: { name: 'Le Spéculoos', image: 'assets/speculoos.png', note: 'La douceur du biscuit.' }
  };
  const cartKey = 'tiratiti-cart-v1';
  const recordKey = 'tiratiti-game-record-v1';
  let cart = {};
  let record = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(cartKey) || '{}');
    for (const id of Object.keys(products)) {
      if (Number.isInteger(saved?.[id]) && saved[id] > 0) cart[id] = Math.min(saved[id], 99);
    }
    record = Math.max(0, Math.min(9999, Number(localStorage.getItem(recordKey)) || 0));
  } catch { /* The experience also works when local storage is unavailable. */ }

  const drawer = document.createElement('dialog');
  drawer.className = 'shop-drawer';
  drawer.id = 'shop-drawer';
  drawer.setAttribute('aria-labelledby', 'shop-title');
  drawer.innerHTML = `
    <div class="shop-heading"><h2 id="shop-title">TON PETIT<br>BONHEUR.</h2><button class="shop-close" type="button" data-close-dialog aria-label="Fermer le panier" autofocus>×</button></div>
    <p class="shop-intro">Les pots qui te font envie.</p>
    <div class="shop-content"></div>
    <div class="shop-footer"><p class="shop-total"></p><button class="shop-checkout" type="button" disabled>COMMANDE BIENTÔT DISPONIBLE</button><p class="shop-note">La commande en ligne arrive bientôt.</p></div>
    <p class="shop-announcement" role="status" aria-live="polite"></p>`;

  const menu = document.createElement('dialog');
  menu.className = 'mobile-menu';
  menu.id = 'mobile-menu';
  menu.setAttribute('aria-label', 'Navigation');
  menu.innerHTML = `
    <div class="menu-heading"><span>TIRATITI</span><button type="button" data-close-dialog aria-label="Fermer le menu" autofocus>×</button></div>
    <nav aria-label="Navigation mobile"><a href="#accueil">LE POT <span>↗</span></a><a href="#histoire">L’HISTOIRE <span>↗</span></a><a href="#le-pot">LES DÉTAILS <span>↗</span></a><a href="#parfums">LES PARFUMS <span>↗</span></a><a href="#actualites">LES NOUVELLES <span>↗</span></a></nav>
    <button class="menu-game" type="button" data-open-game>UNE PAUSE GOURMANDE ? <span>↗</span></button>`;

  const game = document.createElement('dialog');
  game.className = 'game-dialog';
  game.id = 'gourmandise-game';
  game.setAttribute('aria-labelledby', 'game-title');
  game.setAttribute('aria-describedby', 'game-instructions');
  game.innerHTML = `
    <div class="game-heading"><h2 id="game-title">ATTRAPE<br>LA GOURMANDISE.</h2><button class="game-close" type="button" data-close-dialog aria-label="Fermer le jeu" autofocus>×</button></div>
    <p id="game-instructions">20 secondes pour attraper un maximum de cafés et de boudoirs. Touche, clique ou utilise Entrée sur l’ingrédient.</p>
    <div class="game-stats"><p><span>SCORE</span><strong class="game-score">00</strong></p><p><span>SECONDES</span><strong class="game-time">20</strong></p><p><span>RECORD</span><strong class="game-record">00</strong></p></div>
    <div class="game-board"><div class="game-message"><strong>À TOI<br>DE CROQUER.</strong><span>Prêt pour une petite pause ?</span></div><button class="game-target" type="button" aria-label="Attraper le grain de café" hidden></button></div>
    <div class="game-controls"><button class="game-start" type="button">C’EST PARTI ↗</button><button class="game-pause" type="button" hidden>PAUSE Ⅱ</button><button class="game-replay" type="button" hidden>ON REJOUE ↗</button></div>
    <p class="game-announcement" role="status" aria-live="polite"></p>`;

  document.body.append(drawer, menu, game);
  const dialogs = [drawer, menu, game];
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
      if (dialog === game) pauseGame();
      if (dialogs.some(item => item.open)) return;
      if (scrollLock !== null) {
        document.documentElement.style.overflow = scrollLock;
        scrollLock = null;
      }
      const trigger = returnFocus.get(dialog);
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
    });
  }

  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    const destination = document.getElementById(link.hash.slice(1));
    const focusTarget = destination?.querySelector('h1, h2') || destination;
    if (focusTarget) {
      // Continue keyboard navigation at the chosen section after leaving the menu.
      if (!focusTarget.hasAttribute('tabindex')) {
        focusTarget.setAttribute('tabindex', '-1');
        focusTarget.addEventListener('blur', () => focusTarget.removeAttribute('tabindex'), { once: true });
      }
      returnFocus.set(menu, focusTarget);
    }
    menu.close();
  }));
  document.querySelectorAll('[data-menu-toggle]').forEach(button => {
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'mobile-menu');
    button.setAttribute('aria-haspopup', 'dialog');
  });

  function saveCart() {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch { /* No storage is required to select a pot. */ }
  }

  function renderCart(focusAction) {
    const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
    document.querySelectorAll('[data-cart-count]').forEach(element => {
      element.textContent = String(count);
      element.hidden = count === 0;
    });
    document.querySelectorAll('[data-open-cart]').forEach(button => {
      button.setAttribute('aria-label', `Ouvrir le panier, ${count} ${count === 1 ? 'pot' : 'pots'}`);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'shop-drawer');
    });
    drawer.querySelector('.shop-total').textContent = count ? `${count} ${count === 1 ? 'pot sélectionné' : 'pots sélectionnés'}` : 'LEQUEL TE FAIT CRAQUER ?';
    drawer.querySelector('.shop-content').innerHTML = count ? `<ul class="shop-lines">${Object.entries(cart).map(([id, quantity]) => `
      <li class="shop-line"><div class="shop-picture"><img src="${products[id].image}" alt="" width="130" height="160"></div><div class="shop-line-copy"><h3>${products[id].name}</h3><p>${products[id].note}</p><div class="shop-quantity"><button type="button" data-cart-action="decrease" data-product="${id}" aria-label="Retirer un pot ${products[id].name}">−</button><span aria-label="Quantité : ${quantity}">${quantity}</span><button type="button" data-cart-action="increase" data-product="${id}" aria-label="Ajouter un pot ${products[id].name}" ${quantity >= 99 ? 'disabled' : ''}>+</button></div><button class="shop-remove" type="button" data-cart-action="remove" data-product="${id}">Retirer <span class="shop-sr-only">${products[id].name}</span></button></div></li>`).join('')}</ul><button class="shop-continue" type="button" data-close-dialog>CONTINUER LA DÉCOUVERTE ↗</button>` : `
      <p class="shop-empty">TON PANIER<br>ATTEND SA<br>DOSE DE BONHEUR.</p><div class="shop-suggestions">${Object.entries(products).map(([id, product]) => `<button type="button" class="shop-suggestion" data-add-product="${id}"><img src="${product.image}" alt="" width="160" height="180"><span>${product.name}</span><span class="shop-add-label">AJOUTER +</span></button>`).join('')}</div>`;
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
    drawer.querySelector('.shop-announcement').textContent = `${products[id].name} ajouté au panier.`;
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
    drawer.querySelector('.shop-announcement').textContent = cart[id] ? `${products[id].name} : ${cart[id]} ${cart[id] === 1 ? 'pot' : 'pots'}.` : `${products[id].name} retiré du panier.`;
  });

  const bean = '<svg aria-hidden="true" viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="24" ry="34" fill="currentColor" transform="rotate(28 40 40)"/><path d="M53 12C25 34 54 43 28 67" fill="none" stroke="var(--gold, #f0efee)" stroke-width="4" stroke-linecap="round"/></svg>';
  const biscuit = '<svg aria-hidden="true" viewBox="0 0 80 80"><rect x="23" y="6" width="34" height="68" rx="17" fill="var(--gold, #f0efee)" stroke="currentColor" stroke-width="3" transform="rotate(-22 40 40)"/><path d="m28 28 3 1m6-10 3 1m-5 22 3 1m7-10 3 1m-6 23 3 1m7-9 3 1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  const target = game.querySelector('.game-target');
  const message = game.querySelector('.game-message');
  const startButton = game.querySelector('.game-start');
  const pauseButton = game.querySelector('.game-pause');
  const replayButton = game.querySelector('.game-replay');
  const scoreOutput = game.querySelector('.game-score');
  const timeOutput = game.querySelector('.game-time');
  const recordOutput = game.querySelector('.game-record');
  let score = 0;
  let remaining = 20000;
  let started = false;
  let running = false;
  let previousTime = 0;
  let frame = 0;
  const number = value => String(value).padStart(2, '0');
  recordOutput.textContent = number(record);

  function placeTarget() {
    const isBean = score % 2 === 0;
    target.innerHTML = isBean ? bean : biscuit;
    target.setAttribute('aria-label', isBean ? 'Attraper le grain de café' : 'Attraper le boudoir');
    target.style.left = `${14 + Math.random() * 72}%`;
    target.style.top = `${18 + Math.random() * 64}%`;
  }

  function finishGame() {
    running = false;
    cancelAnimationFrame(frame);
    target.hidden = true;
    pauseButton.hidden = true;
    replayButton.hidden = false;
    message.hidden = false;
    message.innerHTML = `<strong>${score ? 'BIEN JOUÉ !' : 'UNE AUTRE<br>CUILLÈRE ?'}</strong><span>${score} ${score === 1 ? 'gourmandise attrapée' : 'gourmandises attrapées'}.</span>`;
    if (score > record) {
      record = score;
      recordOutput.textContent = number(record);
      try { localStorage.setItem(recordKey, String(record)); } catch { /* A record is optional. */ }
    }
    timeOutput.textContent = '00';
    game.querySelector('.game-announcement').textContent = `Terminé ! ${score} ${score === 1 ? 'point' : 'points'}. Tu peux rejouer.`;
    if (game.open) replayButton.focus({ preventScroll: true });
  }

  function gameTick(time) {
    if (!running || !game.open) return;
    remaining = Math.max(0, remaining - (time - previousTime));
    previousTime = time;
    const seconds = number(Math.ceil(remaining / 1000));
    if (timeOutput.textContent !== seconds) timeOutput.textContent = seconds;
    if (remaining <= 0) finishGame();
    else frame = requestAnimationFrame(gameTick);
  }

  function startGame(reset = false) {
    if (!game.open) return;
    if (!started || reset || remaining <= 0) {
      score = 0;
      remaining = 20000;
      scoreOutput.textContent = '00';
      timeOutput.textContent = '20';
      placeTarget();
    }
    started = true;
    running = true;
    previousTime = performance.now();
    message.hidden = true;
    target.hidden = false;
    startButton.hidden = true;
    replayButton.hidden = true;
    pauseButton.hidden = false;
    game.querySelector('.game-announcement').textContent = 'C’est parti ! Attrape les ingrédients.';
    target.focus({ preventScroll: true });
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(gameTick);
  }

  function pauseGame() {
    if (!running) return;
    remaining = Math.max(0, remaining - (performance.now() - previousTime));
    running = false;
    cancelAnimationFrame(frame);
    if (remaining <= 0) { finishGame(); return; }
    timeOutput.textContent = number(Math.ceil(remaining / 1000));
    target.hidden = true;
    pauseButton.hidden = true;
    startButton.hidden = false;
    startButton.textContent = 'ON REPREND ↗';
    message.hidden = false;
    message.innerHTML = '<strong>UNE PETITE<br>PAUSE.</strong><span>On garde ta place.</span>';
    if (game.open) startButton.focus({ preventScroll: true });
  }

  target.addEventListener('keydown', event => {
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
  });
  target.addEventListener('click', () => {
    if (!running) return;
    if (remaining - (performance.now() - previousTime) <= 0) { remaining = 0; finishGame(); return; }
    score += 1;
    scoreOutput.textContent = number(score);
    placeTarget();
    target.focus({ preventScroll: true });
  });
  startButton.addEventListener('click', () => startGame());
  replayButton.addEventListener('click', () => startGame(true));
  pauseButton.addEventListener('click', pauseGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-open-cart], [data-add-product], [data-menu-toggle], [data-open-game]');
    if (!button) return;
    event.preventDefault();
    if (button.hasAttribute('data-add-product')) addProduct(button.dataset.addProduct, button);
    else if (button.hasAttribute('data-open-cart')) { renderCart(); openDialog(drawer, button); }
    else if (button.hasAttribute('data-menu-toggle')) openDialog(menu, button);
    else openDialog(game, button);
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

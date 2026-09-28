(() => {
  'use strict';
  const mapElement = document.querySelector('#dealer-map');
  const notice = document.querySelector('#map-notice');
  // No dealers published until the owner confirms real addresses.
  if (typeof L === 'undefined') {
    mapElement.querySelector('.map-loading').textContent = 'La carte est momentanément indisponible. Vous pouvez l’ouvrir dans OpenStreetMap ci-dessous.';
  } else {
    mapElement.replaceChildren();
    const center = [50.6392, 5.5762];
    const map = L.map(mapElement, { scrollWheelZoom: false, zoomControl: false }).setView(center, 11);
    L.control.zoom({ position: 'topright', zoomInTitle: 'Zoomer', zoomOutTitle: 'Dézoomer' }).addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    }).addTo(map);
    tiles.on('tileerror', () => { notice.textContent = 'Certaines parties de la carte sont indisponibles. Le lien OpenStreetMap reste accessible ci-dessous.'; });
    const reset = document.querySelector('#reset-map');
    reset.hidden = false;
    reset.addEventListener('click', () => map.setView(center, 11, { animate: false }));
    const frame = document.querySelector('#map-frame');
    const expand = document.querySelector('#expand-map');
    let previousOverflow = '';
    expand.hidden = false;
    function setExpanded(open) {
      if (open) { previousOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; }
      else document.documentElement.style.overflow = previousOverflow;
      frame.classList.toggle('is-expanded', open);
      expand.setAttribute('aria-pressed', String(open));
      expand.setAttribute('aria-label', open ? 'Réduire la carte' : 'Agrandir la carte');
      expand.title = open ? 'Réduire la carte (Échap)' : 'Agrandir la carte';
      expand.textContent = open ? '×' : '⛶';
      requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      expand.focus({ preventScroll: true });
    }
    expand.addEventListener('click', () => setExpanded(!frame.classList.contains('is-expanded')));
    document.addEventListener('keydown', event => {
      if (!frame.classList.contains('is-expanded')) return;
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false); }
      if (event.key === 'Tab') {
        const focusable = [...frame.querySelectorAll('button:not([hidden]),a[href],[tabindex="0"]')];
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }
  const form = document.querySelector('#dealer-form');
  const ready = document.querySelector('#email-ready');
  const status = document.querySelector('#form-status');
  const emailLink = document.querySelector('#send-email');
  let prepared = '';
  form.addEventListener('input', () => { ready.hidden = true; status.textContent = ''; prepared = ''; emailLink.removeAttribute('href'); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const value = key => String(data.get(key) || '').trim();
    if (['commerce', 'ville', 'nom', 'message'].some(key => !value(key))) {
      status.textContent = 'Merci de compléter les champs obligatoires avec votre demande.';
      return;
    }
    prepared = `Bonjour Timoty,\n\nJe souhaite proposer Tiratiti dans mon commerce.\n\nCommerce : ${value('commerce')}\nVille : ${value('ville')}\nType : ${value('type')}\nContact : ${value('nom')}\nE-mail : ${value('email')}\nTéléphone : ${value('telephone') || 'Non renseigné'}\n\n${value('message')}\n\nÀ bientôt,\n${value('nom')}`;
    emailLink.href = `mailto:contact@tiratiti.be?subject=${encodeURIComponent('Devenir revendeur Tiratiti — ' + value('commerce'))}&body=${encodeURIComponent(prepared)}`;
    document.querySelector('#email-preview').textContent = prepared;
    ready.hidden = false;
    status.textContent = 'Votre e-mail est prêt. Ouvrez votre messagerie pour le relire et l’envoyer, ou copiez le message.';
    emailLink.focus();
  });
  document.querySelector('#copy-email').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(prepared); status.textContent = 'Message copié. Collez-le dans un e-mail à contact@tiratiti.be.'; }
    catch { ready.querySelector('details').open = true; status.textContent = 'La copie automatique est indisponible. Vous pouvez sélectionner et copier le message affiché ci-dessous.'; }
  });
})();

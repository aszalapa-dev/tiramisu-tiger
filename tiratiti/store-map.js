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
})();

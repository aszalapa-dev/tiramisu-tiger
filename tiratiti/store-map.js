(() => {
  'use strict';
  const mapElement = document.querySelector('#dealer-map');
  const notice = document.querySelector('#map-notice');
  if (!mapElement) return;
  const unavailable = () => {
    mapElement.replaceChildren();
    const message = document.createElement('p');
    message.className = 'map-loading';
    message.textContent = 'La carte est momentanément indisponible. Vous pouvez l’ouvrir dans OpenStreetMap ci-dessous.';
    mapElement.append(message);
  };
  if (typeof mapboxgl === 'undefined' || !mapboxgl.supported()) {
    unavailable();
    return;
  }
  // Public browser configuration is generated at build time, outside Git.
  // No dealer addresses are published until the owner confirms real locations.
  const accessToken = window.TIRATITI_MAPBOX_TOKEN;
  if (!accessToken) { unavailable(); return; }
  const center = [5.5762, 50.6392];
  let map;
  try {
    mapElement.replaceChildren();
    map = new mapboxgl.Map({
      container: mapElement,
      accessToken,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom: 8,
      language: 'fr',
      scrollZoom: false,
      cooperativeGestures: true,
      dragRotate: false,
      touchPitch: false,
      attributionControl: false,
      locale: {
        'NavigationControl.ZoomIn': 'Zoomer',
        'NavigationControl.ZoomOut': 'Dézoomer',
        'NavigationControl.ResetBearing': 'Orienter vers le nord',
        'TouchPanBlocker.Message': 'Utilisez deux doigts pour déplacer la carte',
        'AttributionControl.ToggleAttribution': 'Afficher les crédits de la carte'
      }
    });
  } catch {
    unavailable();
    return;
  }
  {
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.AttributionControl(), 'bottom-right');
    map.on('load', () => {
      // Pale land and green main roads echo the supplied reference.
      for (const layer of map.getStyle().layers) {
        if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#fafafa');
        if (layer.type === 'line' && /motorway-trunk(?:-2)?$/.test(layer.id)) {
          map.setPaintProperty(layer.id, 'line-color', ['match', ['get', 'class'], 'motorway', '#45d94b', '#efcf55']);
        }
      }
      if (map.getLayer('landcover')) {
        map.setPaintProperty('landcover', 'fill-opacity', ['match', ['get', 'class'], 'wood', .24, 0]);
      }
      if (map.getLayer('landuse')) {
        map.setPaintProperty('landuse', 'fill-color', ['match', ['get', 'class'],
          ['wood', 'park'], '#d2efbd', ['scrub', 'grass', 'cemetery'], '#e5f2db',
          'water', '#a8dcf2', '#f3f3f4']);
      }
      mapElement.dataset.mapReady = 'true';
    });
    map.on('error', () => {
      notice.textContent = 'Certaines parties de la carte sont indisponibles. Le lien OpenStreetMap reste accessible ci-dessous.';
    });
    map.on('idle', () => {
      notice.textContent = 'Aucun point de vente affiché pour le moment.';
    });
    const reset = document.querySelector('#reset-map');
    reset.hidden = false;
    reset.addEventListener('click', () => map.jumpTo({ center, zoom: 8, bearing: 0, pitch: 0 }));
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
      requestAnimationFrame(() => map.resize());
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

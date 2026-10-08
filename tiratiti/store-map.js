(() => {
  'use strict';
  const mapElement = document.querySelector('#dealer-map');
  const notice = document.querySelector('#map-notice');
  if (!mapElement) return;
  // Explicit demo fixtures, never presented as confirmed retailers.
  const dealers = [
    { name: 'La Petite Cuillère', address: '12, rue des Douceurs', city: '4000 Liège', coords: [5.573, 50.642] },
    { name: 'Comptoir Biscuit', address: '8, place du Biscuit', city: '4020 Liège', coords: [5.593, 50.633] },
    { name: 'Café Nona', address: '24, allée du Café', city: '4100 Seraing', coords: [5.501, 50.607] },
    { name: 'L’Épicerie du Dimanche', address: '6, rue de la Gourmandise', city: '4050 Chaudfontaine', coords: [5.641, 50.584] },
    { name: 'La Pause Cacao', address: '17, avenue des Saveurs', city: '4040 Herstal', coords: [5.626, 50.671] },
    { name: 'Maison Boudoir', address: '3, passage de la Crème', city: '4800 Verviers', coords: [5.864, 50.589] }
  ];
  const demoNotice = 'Adresses et commerces fictifs : ces exemples ne sont pas des points de vente Tiratiti.';
  const list = document.querySelector('#dealer-list');
  const cards = dealers.map((dealer, index) => {
    const button = document.createElement('button');
    button.className = 'dealer-card';
    button.type = 'button';
    button.disabled = true;
    button.setAttribute('aria-pressed', 'false');
    const number = document.createElement('span');
    number.className = 'dealer-number'; number.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('span');
    const name = document.createElement('strong'); name.textContent = dealer.name;
    const address = document.createElement('span'); address.textContent = dealer.address;
    const city = document.createElement('span'); city.textContent = dealer.city;
    copy.append(name, address, city); button.append(number, copy); list.append(button);
    return button;
  });
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
  // Only the explicitly labelled demo fixtures below are displayed.
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
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const popup = new mapboxgl.Popup({ offset: 18, closeButton: true, maxWidth: '250px' });
    const markers = [];
    function selectDealer(index, fromMarker = false) {
      const dealer = dealers[index];
      cards.forEach((card, i) => card.setAttribute('aria-pressed', String(i === index)));
      markers.forEach((marker, i) => marker.classList.toggle('is-selected', i === index));
      const content = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = dealer.name;
      const address = document.createElement('p'); address.textContent = dealer.address + ', ' + dealer.city;
      const label = document.createElement('small'); label.textContent = 'Commerce et adresse fictifs';
      content.append(title, address, label);
      popup.setLngLat(dealer.coords).setDOMContent(content).addTo(map);
      map.easeTo({ center: dealer.coords, zoom: 12, duration: reducedMotion.matches ? 0 : 850 });
      if (fromMarker) list.scrollTo({ top: cards[index].offsetTop, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
    dealers.forEach((dealer, index) => {
      const marker = document.createElement('button');
      marker.className = 'dealer-marker'; marker.type = 'button';
      marker.textContent = String(index + 1);
      marker.setAttribute('aria-label', dealer.name + ' — commerce fictif');
      marker.addEventListener('click', event => { event.stopPropagation(); selectDealer(index, true); });
      new mapboxgl.Marker({ element: marker }).setLngLat(dealer.coords).addTo(map);
      markers.push(marker);
      cards[index].disabled = false;
      cards[index].addEventListener('click', () => selectDealer(index));
    });
    const showAll = () => {
      popup.remove();
      cards.forEach(card => card.setAttribute('aria-pressed', 'false'));
      markers.forEach(marker => marker.classList.remove('is-selected'));
      const bounds = new mapboxgl.LngLatBounds();
      dealers.forEach(dealer => bounds.extend(dealer.coords));
      map.fitBounds(bounds, { padding: { top: 90, right: 70, bottom: 55, left: 45 }, maxZoom: 11, duration: 0 });
    };
    showAll();
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
      notice.textContent = demoNotice;
    });
    const reset = document.querySelector('#reset-map');
    reset.hidden = false;
    reset.setAttribute('aria-label', 'Voir tous les commerces fictifs');
    reset.title = 'Voir tous les commerces fictifs';
    reset.addEventListener('click', showAll);
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

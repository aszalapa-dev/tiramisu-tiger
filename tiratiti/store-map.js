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
    if (window.TIRATITI_MAPBOX_TOKEN) loadButton = addLoadButton('Réessayer la carte');
  };
  function addLoadButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-load';
    button.textContent = label;
    button.addEventListener('click', requestMap);
    mapElement.append(button);
    return button;
  }
  mapElement.replaceChildren();
  const placeholder = document.createElement('p');
  placeholder.className = 'map-loading';
  placeholder.textContent = 'Découvrez les six commerces fictifs sur la carte.';
  mapElement.append(placeholder);
  let loadButton = addLoadButton('Afficher la carte');
  let resources, pending, map, started = false, observer;
  let automaticTimer = null, nearMap = false, removeAutomaticListeners = () => {};
  const assetLoads = new Map();
  function loadAsset(tag, id, url) {
    if (assetLoads.has(id)) return assetLoads.get(id);
    const promise = new Promise((resolve, reject) => {
      const element = document.createElement(tag);
      element.id = id;
      if (tag === 'link') { element.rel = 'stylesheet'; element.href = url; }
      else { element.src = url; element.async = true; }
      element.addEventListener('load', resolve, { once: true });
      element.addEventListener('error', () => {
        element.remove();
        reject(new Error('La carte n’a pas pu être chargée.'));
      }, { once: true });
      document.head.append(element);
    }).catch(error => { assetLoads.delete(id); throw error; });
    assetLoads.set(id, promise);
    return promise;
  }
  function loadResources() {
    if (!resources) {
      resources = Promise.all([
        loadAsset('link', 'mapbox-lazy-style', 'https://api.mapbox.com/mapbox-gl-js/v3.32.0/mapbox-gl.css'),
        window.mapboxgl ? Promise.resolve() : loadAsset('script', 'mapbox-lazy-script', 'https://api.mapbox.com/mapbox-gl-js/v3.32.0/mapbox-gl.js')
      ]).then(() => window.mapboxgl).catch(error => { resources = null; throw error; });
    }
    return resources;
  }
  function requestMap() {
    if (started || pending) return pending;
    cancelAutomatic();
    removeAutomaticListeners();
    if (observer) observer.disconnect();
    if (!window.TIRATITI_MAPBOX_TOKEN) { unavailable(); return; }
    loadButton.disabled = true;
    loadButton.textContent = 'Chargement de la carte…';
    mapElement.setAttribute('aria-busy', 'true');
    pending = loadResources().then(library => {
      if (!library || !library.supported()) throw new Error('Carte non prise en charge.');
      initializeMap(library);
      started = true;
    }).catch(() => {
      if (map) { map.remove(); map = null; }
      unavailable();
    }).finally(() => {
      pending = null;
      mapElement.setAttribute('aria-busy', 'false');
    });
    return pending;
  }
  const connection = navigator.connection;
  const economicalConnection = connection && (connection.saveData || /^(slow-)?2g$/.test(connection.effectiveType));
  const waitForScroll = innerWidth <= 760 || matchMedia('(pointer: coarse)').matches;
  function cancelAutomatic() {
    if (automaticTimer !== null) { clearTimeout(automaticTimer); automaticTimer = null; }
  }
  function scheduleAutomatic() {
    cancelAutomatic();
    if (!nearMap || document.hidden || started || pending) return;
    if (!waitForScroll) { requestMap(); return; }
    // SDK parsing and the first WebGL draw wait until touch momentum settles.
    automaticTimer = setTimeout(() => {
      automaticTimer = null;
      if (nearMap && !document.hidden && !started && !pending) requestMap();
    }, 180);
  }
  if ('IntersectionObserver' in window && !economicalConnection) {
    const onScroll = () => { if (nearMap) scheduleAutomatic(); };
    const onVisibility = () => { if (document.hidden) cancelAutomatic(); else scheduleAutomatic(); };
    if (waitForScroll) addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    removeAutomaticListeners = () => {
      if (waitForScroll) removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    observer = new IntersectionObserver(entries => {
      nearMap = entries.some(entry => entry.isIntersecting);
      scheduleAutomatic();
    }, { rootMargin: '300px 0px', threshold: 0 });
    observer.observe(mapElement);
  }
  function initializeMap(mapboxgl) {
    // Public browser configuration is generated at build time, outside Git.
    // Only the explicitly labelled demo fixtures below are displayed.
    const accessToken = window.TIRATITI_MAPBOX_TOKEN;
    const center = [5.5762, 50.6392];
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
      throw new Error('La carte n’a pas pu démarrer.');
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
  }
})();

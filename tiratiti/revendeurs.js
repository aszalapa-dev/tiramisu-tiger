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
    const map = L.map(mapElement, { scrollWheelZoom: false }).setView(center, 12);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    }).addTo(map);
    tiles.on('tileerror', () => { notice.textContent = 'Certaines parties de la carte sont indisponibles. Le lien OpenStreetMap reste accessible ci-dessous.'; });
    const reset = document.querySelector('#reset-map');
    reset.hidden = false;
    reset.addEventListener('click', () => map.setView(center, 12, { animate: false }));
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

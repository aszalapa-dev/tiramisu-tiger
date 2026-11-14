(() => {
  'use strict';
  const KEY = 'tiratiti.privacy.v1', VERSION = '2026-11-14.1';
  const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  const started = new Set();
  let choice = null, dialog, banner, returnFocus;
  function parse(raw) {
    try {
      const value = JSON.parse(raw), now = Date.now();
      return value?.version === VERSION && typeof value.mapbox === 'boolean' &&
        Number.isFinite(value.savedAt) && value.savedAt <= now &&
        Number.isFinite(value.expiresAt) && value.expiresAt > now &&
        value.expiresAt <= value.savedAt + MAX_AGE ? value : null;
    } catch { return null; }
  }
  try { choice = parse(localStorage.getItem(KEY)); if (!choice) localStorage.removeItem(KEY); } catch {}
  function removeMapboxData() {
    // Only Mapbox GL JS event/billing storage; never clear unrelated site data.
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (/^mapbox\.eventData(?::|\.)/.test(key)) keys.push(key);
      }
      keys.forEach(key => localStorage.removeItem(key));
    } catch {}
  }
  function notify() {
    document.dispatchEvent(new CustomEvent('tiratiti-privacy-change', {detail:{mapbox:choice?.mapbox === true}}));
  }
  function revokeRunningService() {
    removeMapboxData();
    // Removing a map alone cannot unload a third-party SDK or its pending requests.
    // Reload with the saved refusal so neither its script nor its storage is accessed again.
    if (started.has('mapbox')) window.location.reload();
  }
  function expire() {
    if (!choice || choice.expiresAt > Date.now()) return;
    choice = null;
    try { localStorage.removeItem(KEY); } catch {}
    if (banner) banner.hidden = false;
    notify();revokeRunningService();
  }
  function has(service) { expire();return service === 'mapbox' && choice?.mapbox === true; }
  function save(allowed) {
    const now = Date.now();
    choice = {version:VERSION,mapbox:allowed === true,savedAt:now,expiresAt:now+MAX_AGE};
    // If storage is disabled, respect the choice in memory for this page only.
    try { localStorage.setItem(KEY,JSON.stringify(choice)); } catch {}
    if (banner) banner.hidden = true;
    dialog?.close();notify();
    if (!choice.mapbox) revokeRunningService();
  }
  function open(trigger) {
    if (!dialog) return;
    returnFocus = trigger || document.activeElement;
    dialog.querySelector('#privacy-mapbox').checked = has('mapbox');
    if (!dialog.open) dialog.showModal();
  }
  window.TiratitiPrivacy = {has,open,save,markExternalStarted(service){if(has(service))started.add(service);},version:VERSION};
  if (!choice?.mapbox) removeMapboxData();
  addEventListener('storage',event => {
    if (event.key !== KEY && event.key !== null) return;
    choice = event.key === KEY ? parse(event.newValue) : null;
    if (banner) banner.hidden = Boolean(choice);
    notify();if (!choice?.mapbox) revokeRunningService();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)expire();});

  function mount() {
    banner = document.createElement('section');
    banner.className = 'privacy-banner';banner.setAttribute('aria-label','Cookies et confidentialité');
    banner.hidden = Boolean(choice);
    banner.innerHTML = `<div><h2>Votre vie privée, votre choix.</h2><p>La carte Mapbox reste bloquée sans votre accord. Si vous l’autorisez, Mapbox reçoit notamment votre adresse IP et utilise des identifiants techniques, avec un traitement possible aux États-Unis. Aucun outil publicitaire ni mesure d’audience n’est ajouté par Tiratiti. <a href="cookies.html">En savoir plus</a></p></div><div class="privacy-actions"><button type="button" data-privacy-refuse>Tout refuser</button><button type="button" data-privacy-accept>Tout accepter</button><button type="button" data-privacy-open>Personnaliser</button></div>`;
    dialog = document.createElement('dialog');dialog.className = 'privacy-dialog';
    dialog.setAttribute('aria-labelledby','privacy-title');
    dialog.innerHTML = `<div class="privacy-heading"><h2 id="privacy-title">Vos préférences</h2><button type="button" data-privacy-close aria-label="Fermer les préférences">Fermer</button></div><p>Vous pouvez visiter tout le site sans activer la carte. Votre choix est conservé pendant 180 jours et peut être modifié ici à tout moment.</p><div class="privacy-option"><strong>Préférences indispensables</strong><span>Toujours actives</span><p>Un stockage local mémorise uniquement votre décision et sa date. Il ne sert pas à suivre votre navigation.</p></div><div class="privacy-option"><label><input type="checkbox" id="privacy-mapbox"> <strong>Carte interactive Mapbox</strong></label><p>Affichage de la carte, identifiants techniques, sécurité et facturation du service. Mapbox reçoit votre adresse IP et des informations sur le navigateur et la carte consultée. Traitement possible hors Espace économique européen, notamment aux États-Unis. Nous ne demandons pas votre position GPS. <a href="confidentialite.html#prestataires">Prestataires et transferts</a>.</p></div><p>Un retrait recharge la page si la carte a déjà été chargée, afin d’arrêter le service. Il ne modifie pas la licéité des traitements déjà effectués.</p><div class="privacy-actions"><button type="button" data-privacy-refuse>Tout refuser</button><button type="button" data-privacy-accept>Tout accepter</button><button type="button" data-privacy-save>Enregistrer mon choix</button></div><p class="privacy-more"><a href="cookies.html">Politique de cookies</a> · <a href="confidentialite.html">Confidentialité</a></p>`;
    document.body.append(banner,dialog);
    document.addEventListener('click',event => {
      const button = event.target.closest('[data-privacy-open],[data-privacy-refuse],[data-privacy-accept],[data-privacy-save],[data-privacy-close]');
      if(!button)return;
      event.preventDefault();
      if(button.hasAttribute('data-privacy-open'))open(button);
      else if(button.hasAttribute('data-privacy-refuse'))save(false);
      else if(button.hasAttribute('data-privacy-accept'))save(true);
      else if(button.hasAttribute('data-privacy-save'))save(dialog.querySelector('#privacy-mapbox').checked);
      else dialog.close();
    });
    dialog.addEventListener('close',()=>returnFocus?.focus?.({preventScroll:true}));
    expire();
  }
  if(document.readyState === 'loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();

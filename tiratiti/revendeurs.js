(() => {
  'use strict';
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

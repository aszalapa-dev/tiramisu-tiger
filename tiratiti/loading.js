(() => {
  const dialog = document.querySelector('#site-loading');
  const message = document.querySelector('#loading-message');
  const skip = document.querySelector('#loading-skip');
  if (!dialog?.showModal) return;
  let settled = false;
  const previousOverflow = document.documentElement.style.overflow;
  const start = performance.now();
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();
  const release = reason => {
    if (settled) return;
    settled = true;
    clearTimeout(slowTimer);clearTimeout(timeout);
    document.documentElement.style.overflow = previousOverflow;
    document.body.dataset.loadingState = reason;
    dialog.close();
    if (reason === 'skipped') document.querySelector('.skip')?.focus({preventScroll:true});
  };
  const slowTimer = setTimeout(() => {
    message.textContent = 'Encore un instant… Tu peux déjà découvrir le site pendant que la canette se prépare.';
  }, 12000);
  // A missing module, unavailable CDN or very slow connection never traps visitors.
  const timeout = setTimeout(() => release('timeout'), 35000);
  skip.addEventListener('click', () => release('skipped'));
  dialog.addEventListener('cancel', event => { event.preventDefault();release('skipped'); });
  window.TiratitiLoading = {
    stage(text) { if (!settled) message.textContent = text; },
    async finish(reason = 'ready') {
      if (settled) return;
      if (reason === 'ready') {
        await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1800))]);
        // Avoid a flash on cached visits; readiness, not this minimum, controls exit.
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,650-(performance.now()-start))));
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      }
      release(reason);
    }
  };
})();

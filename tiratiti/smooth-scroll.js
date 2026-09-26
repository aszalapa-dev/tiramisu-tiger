(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, lastTime = 0, target = scrollY, position = scrollY, written = scrollY, direction = 0;
  const maximum = () => Math.max(0, document.scrollingElement.scrollHeight - innerHeight);
  const locked = () => document.hidden || reduced.matches || document.querySelector('dialog[open]')
    || document.body.classList.contains('modal-open') || getComputedStyle(root).overflowY === 'hidden';
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0; lastTime = 0; direction = 0;
    target = position = written = scrollY;
    root.classList.remove('smooth-scrolling');
  }
  function tick(time) {
    if (locked()) { stop(); return; }
    const dt = Math.min((time - (lastTime || time - 16.67)) / 1000, .05);
    lastTime = time;
    target = Math.max(0, Math.min(maximum(), target));
    position += (target - position) * (1 - Math.exp(-dt / .12));
    const done = Math.abs(target - position) < .5;
    if (done) position = target;
    // Instant writes avoid stacking native CSS smooth-scroll animations.
    window.scrollTo({ top: position, left: scrollX, behavior: 'instant' });
    written = scrollY;
    if (done) stop();
    else frame = requestAnimationFrame(tick);
  }
  addEventListener('wheel', event => {
    if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey
      || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY || locked()) { stop(); return; }
    // Leave maps, fields, dialogs and independently scrolling panels native.
    for (const node of event.composedPath()) {
      if (!(node instanceof Element) || node === document.body || node === root) continue;
      if (node.matches('input,textarea,select,[contenteditable],dialog,.leaflet-container,[data-native-scroll]')
        || (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY))) {
        stop(); return;
      }
    }
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (!frame || Math.sign(delta) !== direction) target = position = scrollY;
    direction = Math.sign(delta);
    target = Math.max(0, Math.min(maximum(), target + delta));
    event.preventDefault();
    root.classList.add('smooth-scrolling');
    if (!frame) frame = requestAnimationFrame(tick);
  }, { passive: false });
  // Touch momentum, keyboard, anchors and scrollbar dragging keep native control.
  addEventListener('touchstart', stop, { passive: true });
  addEventListener('pointerdown', stop, { passive: true });
  addEventListener('keydown', stop);
  addEventListener('click', stop);
  addEventListener('hashchange', stop);
  addEventListener('resize', stop);
  addEventListener('scroll', () => { if (frame && Math.abs(scrollY - written) > 2) stop(); }, { passive: true });
  document.addEventListener('visibilitychange', stop);
  reduced.addEventListener('change', stop);
})();

(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = n => Math.max(0, Math.min(1, n));
  const headings = [...document.querySelectorAll('main h1, main h2')]
    .filter(el => !el.closest('.journey, dialog'))
    .map(el => {
      el.setAttribute('aria-label', el.innerText.replace(/\n/g, ' '));
      el.removeAttribute('data-reveal');
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const words = [];
      for (const node of nodes) {
        const fragment = document.createDocumentFragment();
        for (const word of node.textContent.split(/(\s+)/)) {
          if (!word.trim()) { fragment.append(document.createTextNode(word)); continue; }
          const group = document.createElement('span');
          group.style.whiteSpace = 'nowrap';
          group.style.display = 'inline-block';
          group.style.opacity = reduce.matches ? '1' : '0.2';
          group.setAttribute('aria-hidden', 'true');
          group.textContent = word;
          group.className = 'heading-word';
          words.push(group);
          fragment.append(group);
        }
        node.replaceWith(fragment);
      }
      return { el, words, opacity: words.map(() => reduce.matches ? '1' : '0.2'), offscreenProgress: 0 };
    });
  const active = new Set();
  const byElement = new Map(headings.map(block => [block.el, block]));
  let frame = 0;

  function paintWords(block, progress) {
    block.words.forEach((word, i) => {
      const opacity = String(.2 + .8 * clamp(progress * block.words.length - i));
      if (block.opacity[i] === opacity) return;
      word.style.opacity = opacity;
      block.opacity[i] = opacity;
    });
  }
  function paint() {
    frame = 0;
    if (document.hidden || reduce.matches) return;
    const height = innerHeight;
    // Read only nearby headings, and finish every read before changing opacity.
    const positions = [...active].map(block => ({ block, top: block.el.getBoundingClientRect().top }));
    for (const { block, top } of positions) {
      const progress = clamp((height * .80 - top) / (height * .35));
      paintWords(block, progress);
    }
  }
  function cancel() { if (frame) { cancelAnimationFrame(frame); frame = 0; } }
  function schedule() {
    if (!frame && active.size && !document.hidden && !reduce.matches) frame = requestAnimationFrame(paint);
  }
  function restore() {
    cancel();
    if (document.hidden) return;
    for (const block of headings) {
      if (reduce.matches) paintWords(block, 1);
      else if (!active.has(block)) paintWords(block, block.offscreenProgress);
    }
    schedule();
  }
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const block = byElement.get(entry.target);
        if (entry.isIntersecting) active.add(block);
        else {
          active.delete(block);
          block.offscreenProgress = entry.boundingClientRect.bottom <= 0 ? 1 : 0;
          if (!document.hidden && !reduce.matches) paintWords(block, block.offscreenProgress);
        }
      }
      if (!active.size) cancel();
      schedule();
    }, { rootMargin: '160px 0px', threshold: 0 });
    headings.forEach(block => observer.observe(block.el));
  } else {
    // Preserve the reveal on older browsers without visibility observation.
    headings.forEach(block => active.add(block));
    schedule();
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('load', schedule);
  reduce.addEventListener('change', restore);
  document.addEventListener('visibilitychange', restore);
  document.fonts.ready.then(schedule);
})();

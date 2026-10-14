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
          group.setAttribute('aria-hidden', 'true');
          group.textContent = word;
          group.className = 'heading-word';
          words.push(group);
          fragment.append(group);
        }
        node.replaceWith(fragment);
      }
      return { el, words };
    });
  let frame = 0;
  function paint() {
    frame = 0;
    const height = innerHeight;
    const positions = headings.map(block => ({ ...block, top: block.el.getBoundingClientRect().top }));
    for (const { words, top } of positions) {
      const progress = clamp((height * .9 - top) / (height * .5));
      words.forEach((word, i) => {
        const amount = reduce.matches ? 1 : clamp((progress - i / Math.max(1, words.length - 1) * .7) / .3);
        word.style.opacity = String(.2 + .8 * amount);
      });
    }
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(paint); }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('load', schedule);
  reduce.addEventListener('change', schedule);
  document.fonts.ready.then(schedule);
  paint();
})();

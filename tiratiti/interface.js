const journey=document.querySelector('.journey');
const scene=document.querySelector('.scene');
const stream=document.querySelector('.story-stream');
const stage=document.querySelector('#product-stage');
const ingredients=document.querySelector('#ingredients');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const coarse=matchMedia('(pointer: coarse)');
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const ease=n=>n*n*(3-2*n);
let progress=0,target=0,span=1,coverSpan=0,start=0,height=innerHeight,heroHeight=innerHeight,frame=0,lastTime=0;
let userPaused=false,measureDirty=true,pageDirty=true,heroDirty=true;
const styleValues=new WeakMap();
function styleValue(el,name,value,custom=false){
  let values=styleValues.get(el);if(!values){values=new Map();styleValues.set(el,values);}
  if(values.get(name)===value)return;
  values.set(name,value);if(custom)el.style.setProperty(name,value);else el.style[name]=value;
}
document.documentElement.classList.add('js');

// One timeline drives the product, its backdrop and the text behind it.
const blocks=[...stream.querySelectorAll('[data-reveal]')].map(el=>{
  el.setAttribute('aria-label',el.innerText.replace(/\n/g,' '));
  const nodes=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())nodes.push(walker.currentNode);
  let count=0;
  for(const node of nodes){
    const fragment=document.createDocumentFragment();
    for(const word of node.textContent.split(/(\s+)/)){
      if(!word.trim()){fragment.append(document.createTextNode(word));continue;}
      const group=document.createElement('span');group.className='reveal-word';group.setAttribute('aria-hidden','true');
      for(const letter of word){const char=document.createElement('span');char.className='reveal-char';char.textContent=letter;char.style.opacity='1';char.style.setProperty('--char-delay',Math.min(count++*.011,.3)+'s');group.append(char);}
      fragment.append(group);
    }
    node.replaceWith(fragment);
  }
  return {el,words:[...el.querySelectorAll('.reveal-word')],hero:stream.contains(el),offset:0};
});
const heroBlocks=blocks.filter(b=>b.hero);
const pendingReveals=new Set();
const revealObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){pendingReveals.add(entry.target);revealObserver.unobserve(entry.target);}
  pageDirty=true;schedule();
},{threshold:.15});
for(const block of blocks)if(!block.hero)revealObserver.observe(block.el);
const movingElements=[...document.querySelectorAll('[data-tilt],[data-parallax],[data-ingredient-scroll]')];
const activeElements=new Set();
const motionObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){if(entry.isIntersecting)activeElements.add(entry.target);else activeElements.delete(entry.target);}
  pageDirty=true;schedule();
},{rootMargin:'120px'});
movingElements.forEach(el=>motionObserver.observe(el));


function measure(){
  height=innerHeight;
  // Safari's toolbar changes innerHeight during a swipe, while the svh scene
  // keeps its height. Use that same stable geometry for the product timeline.
  heroHeight=scene.clientHeight||height;
  start=journey.getBoundingClientRect().top+scrollY;
  // The final viewport only holds the scene while the next section covers it.
  // Exclude that overlap so the existing spin, text and lid timing stay intact.
  coverSpan=ingredients?Math.max(0,-parseFloat(getComputedStyle(ingredients).marginTop)||0):0;
  span=Math.max(1,journey.offsetHeight-heroHeight-coverSpan);
  const streamTop=stream.getBoundingClientRect().top;
  for(const block of heroBlocks)block.offset=block.el.getBoundingClientRect().top-streamTop;
  measureDirty=false;heroDirty=true;
}
function paintHero(){
  const y=progress*span;
  styleValue(stream,'transform',reduce.matches?'none':'translate3d(0,'+(-y).toFixed(2)+'px,0)');
  const initialY=innerWidth<761||(innerWidth<951&&heroHeight<501)?71:85;
  styleValue(stage,'--stage-offset-y',((initialY-50)*(1-ease(clamp(progress/.18)))*heroHeight/100).toFixed(2)+'px',true);
  stage.dataset.progress=String(progress);
  for(const block of heroBlocks){
    const reveal=clamp((heroHeight*.96-(block.offset-y))/(heroHeight*.35));
    block.words.forEach((word,i)=>{
      const f=reduce.matches?1:clamp(reveal*block.words.length-i);
      styleValue(word,'opacity',String(.2+.8*f));
    });
  }
  dispatchEvent(new CustomEvent('tiratiti-scroll',{detail:{progress,paused:userPaused||reduce.matches,reduced:reduce.matches}}));
  heroDirty=false;
}
function readSections(){
  if(userPaused&&!reduce.matches)return [];
  return [...activeElements].map(el=>({el,r:(el.classList.contains('craft-card')?el.parentElement:el).getBoundingClientRect()}));
}
function paintSections(positions){
  if(userPaused&&!reduce.matches)return;
  // Shrink only as the next panel covers the finished can. Follow the page
  // directly so scrolling back restores its size on the same short interval.
  const coverProgress=coverSpan&&!reduce.matches?clamp((scrollY-start-span)/coverSpan):0;
  const exit=ease(clamp((coverProgress-.2)/.32));
  styleValue(stage,'--stage-exit-scale',(1-.20*exit).toFixed(4),true);
  for(const el of pendingReveals)el.classList.add('is-visible');
  pendingReveals.clear();
  // Batch DOM reads before transforms. No perpetual decorative animation.
  for(const {el,r} of positions){
    if(el.hasAttribute('data-ingredient-scroll')){
      // Stagger each row along the same reversible scroll timeline.
      // Measure the stationary list so row transforms cannot feed back into it.
      const progress=(height*.92-r.top)/(height*.65);
      const distance=innerWidth<761?32:80;
      [...el.children].forEach((row,index)=>{
        if(reduce.matches){row.style.removeProperty('transform');row.style.removeProperty('opacity');return;}
        const arrival=ease(clamp((progress-index*.16)/.55));
        row.style.transform='translate3d('+((1-arrival)*distance).toFixed(2)+'px,'+((1-arrival)*12).toFixed(2)+'px,0)';
        row.style.opacity=String(.2+.8*arrival);
      });
      continue;
    }
    if(el.classList.contains('craft-card')){
      const index=[...el.parentElement.children].indexOf(el);
      const progress=(height*.92-r.top)/(height*.65);
      const reveal=reduce.matches?1:ease(clamp((progress-index*.25)/.32));
      el.style.setProperty('--photo-opacity',reveal.toFixed(4));
      el.style.setProperty('--photo-offset',((1-reveal)*24).toFixed(2)+'px');
    }
    if(reduce.matches){el.style.removeProperty('transform');continue;}
    const p=clamp((height/2-r.top-r.height/2)/height,-1,1);
    if(el.hasAttribute('data-tilt'))el.style.transform='translate3d(0,'+(p*15).toFixed(2)+'px,0) rotate('+(Number(el.dataset.tilt)*(1-p*.7)).toFixed(2)+'deg)';
    else if(el.classList.contains('full-cta-image'))el.style.transform='translate3d(0,'+(p*25).toFixed(2)+'px,0)';
    else el.style.transform='translate3d(0,'+(p*30).toFixed(2)+'px,0) rotate('+(14+p*8).toFixed(2)+'deg)';
  }
  pageDirty=false;
}
function tick(time){
  frame=0;if(document.hidden){lastTime=0;return;}
  const dt=Math.min((time-(lastTime||time-16.67))/1000,.05);lastTime=time;
  if(measureDirty)measure();
  target=reduce.matches?0:clamp((scrollY-start)/span);
  if(reduce.matches){progress=0;heroDirty=true;}
  else if(!userPaused&&(innerWidth<=760||(coarse.matches&&innerWidth<=1024)||document.documentElement.classList.contains('smooth-scrolling'))){
    // Native touch scrolling already has inertia. Follow it without adding a
    // second catch-up animation that continues after the finger has stopped.
    if(progress!==target){progress=target;heroDirty=true;}
  }
  else if(!userPaused&&Math.abs(target-progress)>.000015){
    const delta=target-progress;
    // Smooth wheel steps and cap catch-up after a fast swipe or a paused scroll.
    const step=delta*(1-Math.exp(-12*dt));
    progress+=Math.sign(step)*Math.min(Math.abs(step),dt*.5);
    if(Math.abs(target-progress)<.000015)progress=target;
    heroDirty=true;
  }
  // Read all active geometry before either animation mutates styles.
  const positions=pageDirty?readSections():null;
  if(heroDirty)paintHero();
  if(pageDirty)paintSections(positions);
  if(!reduce.matches&&!userPaused&&Math.abs(target-progress)>.000015)schedule();
  else lastTime=0;
}
function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
reduce.addEventListener('change',()=>{progress=0;measureDirty=true;pageDirty=true;heroDirty=true;schedule();});
addEventListener('scroll',()=>{pageDirty=true;schedule();},{passive:true});
addEventListener('resize',()=>{measureDirty=true;pageDirty=true;schedule();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastTime=0;heroDirty=true;schedule();}});
new ResizeObserver(()=>{measureDirty=true;pageDirty=true;schedule();}).observe(document.body);
document.fonts.ready.then(()=>{measureDirty=true;pageDirty=true;schedule();});
schedule();

const dialog=document.querySelector('#flavor-dialog');
const recipes={
  classique:{title:'Le Classique',description:'Boudoirs imbibés de café, crème au mascarpone et voile de cacao. Celui avec lequel tout a commencé.'},
  speculoos:{title:'Le Spéculos',description:'Du spéculos et notre crème au mascarpone. L’accent belge lui va bien.'},
  special:{title:'Le Spécial',description:'Des biscuits Pane di Stelle au cacao et notre crème au mascarpone. Pour ceux qui ont un faible pour le chocolat.'}
};
document.querySelectorAll('[data-flavor]').forEach(button=>button.addEventListener('click',()=>{
  const flavor=button.dataset.flavor;
  if(!recipes[flavor])return;
  document.querySelector('#dialog-title').textContent=recipes[flavor].title;
  document.querySelector('#dialog-description').textContent=recipes[flavor].description;
  document.querySelector('#dialog-visual').style.backgroundColor=flavor==='speculoos'?'var(--brick)':'var(--blue)';
  dialog.dataset.flavor=flavor;
  dialog.querySelector('.drag-hint').hidden=flavor==='special';
  dialog.showModal();document.body.classList.add('modal-open');
  dispatchEvent(new CustomEvent('tiratiti-flavor',{detail:{flavor}}));
}));
document.querySelectorAll('.dialog-close,.dialog-close-text').forEach(button=>button.addEventListener('click',()=>dialog.close()));
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');dispatchEvent(new Event('tiratiti-dialog-close'));});


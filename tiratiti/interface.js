const journey=document.querySelector('.journey');
const scene=document.querySelector('.scene');
const stream=document.querySelector('.story-stream');
const stage=document.querySelector('#product-stage');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const motionButton=document.querySelector('#motion-toggle');
const progressBar=document.querySelector('#scroll-progress');
const stepNumber=document.querySelector('#step-number');
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const ease=n=>n*n*(3-2*n);
let progress=0,target=0,span=1,start=0,height=innerHeight,frame=0,lastTime=0;
let userPaused=false,measureDirty=true,pageDirty=true,heroDirty=true;
document.documentElement.classList.add('js');

// One timeline drives the product, its backdrop and the text behind it.
const blocks=[...document.querySelectorAll('[data-reveal]')].map(el=>{
  el.setAttribute('aria-label',el.innerText.replace(/\n/g,' '));
  const nodes=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())nodes.push(walker.currentNode);
  let count=0;
  for(const node of nodes){
    const fragment=document.createDocumentFragment();
    for(const word of node.textContent.split(/(\s+)/)){
      if(!word.trim()){fragment.append(document.createTextNode(word));continue;}
      const group=document.createElement('span');group.className='reveal-word';group.setAttribute('aria-hidden','true');
      for(const letter of word){const char=document.createElement('span');char.className='reveal-char';char.textContent=letter;char.style.setProperty('--char-delay',Math.min(count++*.011,.3)+'s');group.append(char);}
      fragment.append(group);
    }
    node.replaceWith(fragment);
  }
  return {el,chars:[...el.querySelectorAll('.reveal-char')],hero:stream.contains(el),offset:0};
});
const heroBlocks=blocks.filter(b=>b.hero);
const pendingReveals=new Set();
const revealObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){pendingReveals.add(entry.target);revealObserver.unobserve(entry.target);}
  pageDirty=true;schedule();
},{threshold:.15});
for(const block of blocks)if(!block.hero)revealObserver.observe(block.el);
const movingElements=[...document.querySelectorAll('[data-tilt],[data-parallax]')];
const activeElements=new Set();
const motionObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){if(entry.isIntersecting)activeElements.add(entry.target);else activeElements.delete(entry.target);}
  pageDirty=true;schedule();
},{rootMargin:'120px'});
movingElements.forEach(el=>motionObserver.observe(el));

function updateButton(){
  const stopped=userPaused||reduce.matches;
  motionButton.setAttribute('aria-pressed',String(stopped));
  motionButton.setAttribute('aria-label',stopped?'Reprendre l’animation':'Mettre l’animation en pause');
  motionButton.textContent=stopped?'▷':'Ⅱ';
  motionButton.disabled=reduce.matches;
  document.body.classList.toggle('motion-stopped',stopped);
}
function measure(){
  height=innerHeight;
  start=journey.getBoundingClientRect().top+scrollY;
  span=Math.max(1,journey.offsetHeight-height);
  const streamTop=stream.getBoundingClientRect().top;
  for(const block of heroBlocks)block.offset=block.el.getBoundingClientRect().top-streamTop;
  measureDirty=false;heroDirty=true;
}
function paintHero(){
  const y=progress*span;
  stream.style.transform=reduce.matches?'none':'translate3d(0,'+(-y).toFixed(2)+'px,0)';
  const initialY=innerWidth<761?71:85;
  scene.style.setProperty('--stage-y',(initialY-(initialY-50)*ease(clamp(progress/.18)))+'%');
  stage.dataset.progress=String(progress);
  stepNumber.textContent=String(Math.min(4,1+Math.floor(progress*4))).padStart(2,'0');
  progressBar.style.transform='scaleX('+progress+')';
  for(const block of heroBlocks){
    const reveal=(height*.91-(block.offset-y))/(height*.56);
    block.chars.forEach((char,i)=>{
      const f=reduce.matches?1:clamp((reveal-i/Math.max(1,block.chars.length-1)*.3)/.5);
      char.style.opacity=String(.13+.87*f);
    });
  }
  dispatchEvent(new CustomEvent('tiratiti-scroll',{detail:{progress,paused:userPaused||reduce.matches,reduced:reduce.matches}}));
  heroDirty=false;
}
function paintSections(){
  if(userPaused&&!reduce.matches)return;
  for(const el of pendingReveals)el.classList.add('is-visible');
  pendingReveals.clear();
  // Batch DOM reads before transforms. No perpetual decorative animation.
  const positions=[...activeElements].map(el=>({el,r:el.getBoundingClientRect()}));
  for(const {el,r} of positions){
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
  else if(!userPaused&&Math.abs(target-progress)>.000015){
    const delta=target-progress;
    // Smooth wheel steps and cap catch-up after a fast swipe or a paused scroll.
    const step=delta*(1-Math.exp(-12*dt));
    progress+=Math.sign(step)*Math.min(Math.abs(step),dt*.5);
    if(Math.abs(target-progress)<.000015)progress=target;
    heroDirty=true;
  }
  if(heroDirty)paintHero();
  if(pageDirty)paintSections();
  if(!reduce.matches&&!userPaused&&Math.abs(target-progress)>.000015)schedule();
  else lastTime=0;
}
function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
motionButton.addEventListener('click',()=>{userPaused=!userPaused;updateButton();heroDirty=true;pageDirty=true;schedule();});
reduce.addEventListener('change',()=>{progress=0;updateButton();measureDirty=true;pageDirty=true;heroDirty=true;schedule();});
addEventListener('scroll',()=>{pageDirty=true;schedule();},{passive:true});
addEventListener('resize',()=>{measureDirty=true;pageDirty=true;schedule();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastTime=0;heroDirty=true;schedule();}});
new ResizeObserver(()=>{measureDirty=true;pageDirty=true;schedule();}).observe(document.body);
document.fonts.ready.then(()=>{measureDirty=true;pageDirty=true;schedule();});
updateButton();schedule();

const dialog=document.querySelector('#flavor-dialog');
const recipes={
  classique:{title:'Le Classique',description:'La rencontre du café, de la crème et du cacao. Un équilibre tout en douceur, pour retrouver le plaisir d’un tiramisu à chaque cuillère.'},
  speculoos:{title:'Le Spéculoos',description:'Le parfum du spéculoos, la douceur de la crème et ce petit goût de biscuit qui donne envie de recommencer.'}
};
document.querySelectorAll('[data-flavor]').forEach(button=>button.addEventListener('click',()=>{
  const flavor=button.dataset.flavor;
  document.querySelector('#dialog-title').textContent=recipes[flavor].title;
  document.querySelector('#dialog-description').textContent=recipes[flavor].description;
  document.querySelector('#dialog-add').dataset.addProduct=flavor;
  document.querySelector('#dialog-visual').style.backgroundColor=flavor==='speculoos'?'var(--brick)':'var(--blue)';
  dialog.showModal();document.body.classList.add('modal-open');
  dispatchEvent(new CustomEvent('tiratiti-flavor',{detail:{flavor}}));
}));
document.querySelectorAll('.dialog-close,.dialog-close-text').forEach(button=>button.addEventListener('click',()=>dialog.close()));
document.querySelector('#dialog-add').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');dispatchEvent(new Event('tiratiti-dialog-close'));});


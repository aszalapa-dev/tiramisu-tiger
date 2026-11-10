import { createRenderedSequence } from './sequence-playback.js?v=motion-trial-10';
import { createScrollPlayhead } from './scroll-playhead.js?v=coast-scroll-01';

const stage=document.querySelector('#product-stage');
const poster=document.querySelector('#poster');
let canvas=document.querySelector('#pot');
const button=document.querySelector('#retry-3d');
const status=document.querySelector('#scene-status');
const compact=innerWidth<=760||(innerWidth<=1024&&matchMedia('(pointer: coarse)').matches);
const manifestUrl=compact?'assets/rendered-one-turn-mobile/manifest.json':'assets/rendered-one-turn/manifest.json';
// Trial only changes the hero; the existing 360-degree product detail stays available.
const heroManifestUrl='assets/motion-trial-20261107/manifest.json';
let hero,attempt=0,dialogPlayer,dialogToken=0;
let renderedProgress=Number(stage.dataset.inputProgress??stage.dataset.progress??0);
let sceneVisible=true,eventPaused=false,resumeFrame=null;
const playhead=createScrollPlayhead({initialProgress:renderedProgress,onProgress:progress=>{
  renderedProgress=progress;hero?.render(progress);
}});
const canAnimate=()=>!document.hidden&&sceneVisible&&!eventPaused;
function cancelResume(){
  if(resumeFrame!==null)window.cancelAnimationFrame(resumeFrame);
  resumeFrame=null;
}
document.addEventListener?.('visibilitychange',()=>{
  cancelResume();
  if(!canAnimate()){playhead.suspend();return;}
  // The page measures its restored scroll position first. Resume at that fresh
  // target instead of playing a hidden interval or showing the old pose.
  if(window.requestAnimationFrame)resumeFrame=window.requestAnimationFrame(()=>{
    resumeFrame=null;if(canAnimate())playhead.resume();
  });
  else playhead.resume();
});
if(window.IntersectionObserver){
  new window.IntersectionObserver(entries=>{
    const entry=entries.find(item=>item.target===stage);
    if(!entry||entry.isIntersecting===sceneVisible)return;
    sceneVisible=entry.isIntersecting;
    if(!canAnimate()){cancelResume();playhead.suspend();}
    else if(resumeFrame===null)playhead.resume();
  },{rootMargin:'80px'}).observe(stage);
}
if(!canAnimate())playhead.suspend();
document.body.dataset.loadingState='ready';
window.TiratitiLoading={stage(){},finish(){}};

function startHero(){
  const token=++attempt;
  hero?.dispose();button.hidden=true;canvas.hidden=false;
  stage.setAttribute('aria-busy','true');
  status.textContent='Préparation de l’animation de la canette.';
  hero=createRenderedSequence({canvas,manifestUrl:heroManifestUrl,cacheLimit:compact?6:9,referenceElement:poster,
    onLayout:layout=>{if(token===attempt)canvas.classList.toggle('video-overscan',Boolean(layout));},
    onCanvas:next=>{canvas=next;canvas.classList.remove('video-overscan');},
    onFallback(){if(token===attempt)stage.classList.remove('loaded');},
    onReady(){
      if(token!==attempt)return;
      stage.classList.add('loaded');stage.setAttribute('aria-busy','false');
      canvas.dataset.renderMode='blender';
      status.textContent='Faites défiler pour faire basculer la canette, l’ouvrir et plonger la cuillère.';
    },
    onError(){
      if(token!==attempt)return;
      stage.classList.remove('loaded');stage.setAttribute('aria-busy','false');
      button.hidden=false;button.textContent='Relancer l’animation ↻';
      status.textContent='La photo reste disponible. Vous pouvez relancer l’animation.';
    }
  });
  hero.ready.catch(()=>{});
  hero.render(renderedProgress);
}
button.addEventListener('click',startHero);
addEventListener('tiratiti-scroll',event=>{
  const detail=event.detail,wasPaused=eventPaused;
  eventPaused=Boolean(detail.paused&&!detail.reduced);
  if(!canAnimate()){cancelResume();playhead.suspend();}
  playhead.set(detail.reduced?0:(detail.inputProgress??detail.progress),{immediate:Boolean(detail.reduced)});
  if(wasPaused&&!eventPaused&&canAnimate()&&resumeFrame===null)playhead.resume();
});
addEventListener('online',()=>{if(!button.hidden)startHero();});

// The product detail reuses the same native Blender materials and rotation.
addEventListener('tiratiti-flavor',event=>{
  const flavor=event.detail.flavor;
  if(!['classique','speculoos','special'].includes(flavor))return;
  const token=++dialogToken;
  dialogPlayer?.dispose();dialogPlayer=null;
  const host=document.querySelector('#dialog-visual');
  const hint=document.querySelector('.drag-hint');
  host.replaceChildren();
  const photo=document.createElement('img');
  photo.src=flavor==='classique'?'assets/classique.webp?v=opposite-tab-27':flavor==='speculoos'?'assets/photos/packshot-speculoos.webp':'assets/photos/packshot-special.webp';
  photo.alt='Pot Tiratiti '+(flavor==='classique'?'Le Classique':flavor==='speculoos'?'Le Spéculos':'Le Spécial');
  host.classList.toggle('has-product-photo',flavor!=='classique');
  hint.hidden=flavor!=='classique';
  if(flavor!=='classique')photo.className='dialog-packshot';
  host.append(photo);
  if(flavor!=='classique')return;
  const detailCanvas=document.createElement('canvas');
  detailCanvas.setAttribute('role','img');detailCanvas.setAttribute('aria-label','Canette à 360 degrés. Glissez ou utilisez les flèches gauche et droite.');
  detailCanvas.tabIndex=0;host.append(detailCanvas);
  hint.textContent='↔ Glisse sur le pot ou utilise les flèches du clavier';
  let position=0,dragging=false,lastX=0;
  const move=delta=>{
    position=((position+delta)%1+1)%1;
    if(position<1e-9||1-position<1e-9)position=0;
    // Invert the authored easing so a finger moves the can at a steady rate.
    let low=0,high=1;
    for(let i=0;i<24;i++){
      const t=(low+high)/2,eased=t*t*t*(10+t*(-15+6*t));
      if(eased<position)low=t;else high=t;
    }
    const progress=position===0?0:(low+high)/2*.68;
    dialogPlayer?.render(progress);
  };
  detailCanvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;detailCanvas.setPointerCapture(e.pointerId);});
  detailCanvas.addEventListener('pointermove',e=>{if(dragging){move((e.clientX-lastX)/600);lastX=e.clientX;}});
  detailCanvas.addEventListener('pointerup',()=>{dragging=false;});
  detailCanvas.addEventListener('pointercancel',()=>{dragging=false;});
  detailCanvas.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-.025:.025);}
  });
  dialogPlayer=createRenderedSequence({canvas:detailCanvas,manifestUrl,fixedScale:true,
    onReady(){if(token===dialogToken)photo.hidden=true;},
    onError(){if(token===dialogToken){photo.hidden=false;detailCanvas.hidden=true;hint.textContent='La photo du produit reste disponible.';}}
  });
  dialogPlayer.ready.catch(()=>{});
});
addEventListener('tiratiti-dialog-close',()=>{dialogToken++;dialogPlayer?.dispose();dialogPlayer=null;});
if(stage&&poster)startHero();

import { createRenderedSequence } from './rendered-sequence.js?v=one-turn-27';

const stage=document.querySelector('#product-stage');
const poster=document.querySelector('#poster');
const canvas=document.querySelector('#pot');
const button=document.querySelector('#retry-3d');
const status=document.querySelector('#scene-status');
const manifestUrl='assets/rendered-one-turn/manifest.json';
let hero,attempt=0,dialogPlayer,dialogToken=0;
document.body.dataset.loadingState='ready';
window.TiratitiLoading={stage(){},finish(){}};

function startHero(){
  const token=++attempt;
  hero?.dispose();button.hidden=true;canvas.hidden=false;
  stage.setAttribute('aria-busy','true');
  status.textContent='Préparation de l’animation de la canette.';
  hero=createRenderedSequence({canvas,manifestUrl,
    onReady(){
      if(token!==attempt)return;
      stage.classList.add('loaded');stage.setAttribute('aria-busy','false');
      canvas.dataset.renderMode='blender';
      status.textContent='Faites défiler pour faire tourner la canette et l’ouvrir.';
    },
    onError(){
      if(token!==attempt)return;
      stage.classList.remove('loaded');stage.setAttribute('aria-busy','false');
      button.hidden=false;button.textContent='Relancer l’animation ↻';
      status.textContent='La photo reste disponible. Vous pouvez relancer l’animation.';
    }
  });
  hero.ready.catch(()=>{});
  hero.render(Number(stage.dataset.progress||0));
}
button.addEventListener('click',startHero);
addEventListener('tiratiti-scroll',event=>hero?.render(event.detail.reduced?0:event.detail.progress));
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
  photo.src=flavor==='classique'?poster.src:flavor==='speculoos'?'assets/photos/packshot-speculoos.webp':'assets/photos/packshot-special.webp';
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

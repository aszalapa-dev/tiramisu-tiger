import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { loadBlenderOpening, orientClosure } from './blender-opening.js?v=tab-sync-26';

const stage=document.querySelector('#product-stage');
const canvas=document.querySelector('#pot');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const cache=new Map();
const loader=new GLTFLoader();
const draco=new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);
function loadModel(flavor){
  const modelURL=`assets/${flavor}.glb${flavor==='classique'?'?v=stickers-pdf-2':''}`;
  if(!cache.has(flavor))cache.set(flavor,loader.loadAsync(modelURL).then(gltf=>{
    let model=gltf.scene;
    for(const s of gltf.scenes){const pot=s.children.find(n=>n.name.includes('TIRATITI')&&n.name.includes('250ML'));if(pot){model=pot;break;}}
    if(flavor==='classique')orientClosure(model);
    const wrap=new THREE.Group();wrap.add(model);
    let box=new THREE.Box3().setFromObject(wrap);let size=box.getSize(new THREE.Vector3());
    if(size.y<size.x&&size.y<size.z){model.rotation.x=-Math.PI/2;box=new THREE.Box3().setFromObject(wrap);size=box.getSize(new THREE.Vector3());}
    model.position.sub(box.getCenter(new THREE.Vector3()));
    wrap.scale.setScalar(2.4/size.y);
    model.traverse(obj=>{if(!obj.isMesh)return;
      for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
        mat.envMapIntensity=/Aluminium|Gravure|Sertissage/.test(mat.name)?1.05:.5;
        for(const texture of [mat.map,mat.normalMap,mat.roughnessMap])if(texture)texture.anisotropy=8;
        if(!mat.map&&/Speculoos imbibe/.test(mat.name))mat.color.setHex(0xc17d3d);
        if(!mat.map&&/Mascarpone/.test(mat.name))mat.color.setHex(0xf0e8d6);
        if(/PET transparent/.test(mat.name)){
          // Thin PET refracts the food behind it and reflects the studio cards.
          mat.transmission=1;mat.transparent=false;mat.opacity=1;mat.depthWrite=true;mat.side=THREE.FrontSide;
          mat.ior=1.47;mat.thickness=.00045;mat.attenuationDistance=Infinity;
          mat.envMapIntensity=1;mat.roughness=.045;mat.clearcoat=.15;mat.clearcoatRoughness=.06;
        }
        if(/Etiquette|Papier interieur|Stickers PDF|Papier stickers PDF/.test(mat.name)){mat.alphaTest=.2;mat.depthWrite=true;}
      }
    });
    return wrap;
  }).catch(error=>{cache.delete(flavor);throw error;}));
  return cache.get(flavor);
}
function studioEnvironment(renderer){
  // Static studio cards produce directional reflections without per-frame shadow passes.
  const studio=new THREE.Scene();studio.background=new THREE.Color(0x100d0b);
  const cards=[];
  const card=(width,height,position,strength,color)=>{
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(strength),side:THREE.DoubleSide,toneMapped:false});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
    mesh.position.set(...position);mesh.lookAt(0,0,0);studio.add(mesh);cards.push(mesh);
  };
  card(3,5,[-3.8,2.8,4],4.5,0xfff3df);
  card(.55,4.8,[-1.8,1,4.5],10,0xffffff);
  card(3.5,2.5,[-.7,6,0],2.8,0xffffff);
  card(.85,4.5,[3.5,1,-2.3],3.2,0xffffff);
  card(2,3,[4,0,4],.45,0xffecd6);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(studio,.025);
  for(const mesh of cards){mesh.geometry.dispose();mesh.material.dispose();}
  pmrem.dispose();return environment;
}
function makeView(canvas,host,canRender=()=>true,verticalPadding=0){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<761?1:1.35));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(26,1,.1,100);
  const viewDirection=new THREE.Vector3(0,2.35,7.6).normalize();
  camera.position.copy(viewDirection).multiplyScalar(7.1);camera.lookAt(0,0,0);
  const env=studioEnvironment(renderer);scene.environment=env.texture;
  scene.add(new THREE.AmbientLight(0xfff4e0,.08));
  const key=new THREE.DirectionalLight(0xfff2df,2);key.position.set(-4.5,3.5,2.8);scene.add(key);
  const fill=new THREE.DirectionalLight(0xfff5eb,.5);fill.position.set(4,1,3);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,.45);rim.position.set(3.5,2.5,-3);scene.add(rim);
  const rig=new THREE.Group();scene.add(rig);
  let disposed=false,width=0,height=0,pixelRatio=0;
  const render=()=>{if(!disposed&&!document.hidden&&canRender())renderer.render(scene,camera);};
  const resize=()=>{
    const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio,innerWidth<761?1:1.35);
    if(!w||!h||(w===width&&h===height&&dpr===pixelRatio))return;
    width=w;height=h;pixelRatio=dpr;
    // Give the raised tab room above the original canvas. Expanding the
    // frustum by the identical ratio preserves every original pixel position
    // and the can's size; only the transparent drawing area grows.
    const pad=Math.round(h*verticalPadding),renderHeight=h+2*pad;
    renderer.setPixelRatio(dpr);renderer.setSize(w,renderHeight,false);
    if(verticalPadding){canvas.style.height=renderHeight+'px';canvas.style.top=-pad+'px';canvas.style.bottom='auto';}
    camera.aspect=w/renderHeight;
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(26)/2)*renderHeight/h));
    // Fit the full turning silhouette in the narrowest camera dimension.
    // The viewing direction stays fixed, so resize cannot change the lid angle.
    const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(26)/2)*Math.min(1,w/h));
    camera.position.copy(viewDirection).multiplyScalar(Math.max(7.1,1.53/Math.sin(halfFov)*1.04));
    camera.updateProjectionMatrix();render();
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  return {renderer,scene,camera,rig,render,dispose:()=>{disposed=true;observer.disconnect();env.dispose();renderer.dispose();}};
}
let hero,heroLid;
let progress=Number(stage.dataset.progress||0),visible=true,motionReduced=reduced.matches,lastHeroProgress=NaN;
let dialogView=null,modalAngle=0,dragging=false,lastX=0,modalToken=0,modalFrame=0;
// Spin twice around the can's vertical axis. A small precessing tilt evokes
// a spinning top; both tilt and angular speed settle to zero before opening.
function turnAt(p){
  const t=Math.max(0,Math.min(1,p/.82));
  const eased=t*t*t*(10+t*(-15+6*t));
  const y=4*Math.PI*eased;
  const wobble=.14*Math.sin(Math.PI*t)**2;
  return {x:wobble*Math.sin(y),y,z:wobble*Math.cos(y)};
}
function paintHero(force=false){
  if(!hero||!visible||document.hidden)return;
  const p=motionReduced?0:progress;
  if(!force&&p===lastHeroProgress)return;
  lastHeroProgress=p;
  const pose=turnAt(p);hero.rig.rotation.set(pose.x,pose.y,pose.z,'ZXY');
  // Leave room for the lifted tab without moving the centre of the can.
  const openingRoom=THREE.MathUtils.smoothstep(p,.74,.82);
  hero.rig.scale.setScalar(1-.14*openingRoom);
  if(heroLid){
    heroLid.update(Math.max(0,Math.min(1,(p-.82)/.16)));
  }
  hero.render();
}
addEventListener('tiratiti-scroll',e=>{
  if(Number.isFinite(e.detail.progress))progress=Math.max(0,Math.min(1,e.detail.progress));
  motionReduced=e.detail.reduced??reduced.matches;
  paintHero();
});
reduced.addEventListener('change',()=>{motionReduced=reduced.matches;paintHero(true);});
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)paintHero(true);},{threshold:0}).observe(stage);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){paintHero(true);if(dialogView)paintModal();}});
function paintModal(){if(modalFrame)return;modalFrame=requestAnimationFrame(()=>{modalFrame=0;if(dialogView){dialogView.rig.rotation.y=modalAngle;dialogView.render();}});}
const retryButton=document.querySelector('#retry-3d');
const sceneStatus=document.querySelector('#scene-status');
let heroLoading=false;
async function loadHero(){
  if(heroLoading||canvas.dataset.modelLoaded==='true')return;
  heroLoading=true;retryButton.hidden=true;canvas.hidden=false;
  stage.setAttribute('aria-busy','true');sceneStatus.textContent='Chargement du pot en 3D.';
  try{
    hero=makeView(canvas,stage,()=>visible,.18);
    // Clone only the objects: cached geometry and the closed product stay reusable.
    const model=(await loadModel('classique')).clone(true);hero.rig.add(model);
    paintHero(true);
    stage.classList.add('loaded');canvas.dataset.modelLoaded='true';
    document.querySelector('#motion-toggle').hidden=false;
    sceneStatus.textContent='Canette 3D prête. Faites défiler pour la découvrir et l’ouvrir.';
    try{
      // Normalise the original closed body first; the authored top inherits
      // precisely that transform. Product-dialog clones remain untouched.
      heroLid=await loadBlenderOpening(model,loader);
      canvas.dataset.openingLoaded='true';paintHero(true);
    }catch(error){
      canvas.dataset.openingLoaded='false';
      console.warn('L’ouverture animée est indisponible, le pot reste fermé.',error);
    }
  }catch(error){
    heroLid?.dispose();
    hero?.dispose();hero=null;heroLid=null;lastHeroProgress=NaN;
    console.warn('Le rendu 3D est indisponible, la photo du pot reste visible.',error);
    canvas.hidden=true;document.querySelector('#motion-toggle').hidden=true;
    retryButton.hidden=false;sceneStatus.textContent='Le pot 3D n’a pas chargé. Vous pouvez relancer son chargement.';
  }finally{heroLoading=false;stage.setAttribute('aria-busy','false');}
}
retryButton.addEventListener('click',loadHero);
addEventListener('online',()=>{if(visible)loadHero();});
// Start asynchronously so product viewers can open while the hero downloads.
loadHero();
addEventListener('tiratiti-flavor',async e=>{
  const token=++modalToken;const flavor=e.detail.flavor;const host=document.querySelector('#dialog-visual');
  if(dialogView){dialogView.dispose();dialogView=null;}
  if(flavor==='special'){
    // The original site's product photograph is available for this recipe;
    // there is no matching 3D model, so keep the photograph on screen.
    host.replaceChildren();
    const photo=document.createElement('img');photo.src='assets/special.webp';
    photo.alt='Tiratiti Le Spécial, biscuits Pane di Stelle au cacao et crème au mascarpone';
    host.append(photo);
    return;
  }
  host.replaceChildren();const poster=document.createElement('img');poster.src=`assets/${flavor}.png`;poster.alt=`Pot Tiratiti ${flavor==='classique'?'Le Classique':'Le Spéculoos'}`;host.append(poster);
  document.querySelector('.drag-hint').textContent='Chargement de la vue à 360°…';
  try{
    const model=(await loadModel(flavor)).clone(true);if(token!==modalToken)return;
    const c=document.createElement('canvas');c.setAttribute('role','img');c.setAttribute('aria-label','Vue du pot à 360 degrés. Utilisez les flèches gauche et droite pour le faire tourner.');c.tabIndex=0;host.append(c);
    dialogView=makeView(c,host);dialogView.rig.add(model);modalAngle=0;dialogView.render();poster.hidden=true;
    document.querySelector('.drag-hint').textContent='↔ Glisse sur le pot ou utilise les flèches du clavier';
    c.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;c.setPointerCapture(e.pointerId);});
    c.addEventListener('pointermove',e=>{if(dragging){modalAngle+=(e.clientX-lastX)*.012;lastX=e.clientX;paintModal();}});
    c.addEventListener('pointerup',()=>{dragging=false;});c.addEventListener('pointercancel',()=>{dragging=false;});
    c.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();modalAngle+=e.key==='ArrowLeft'?-.25:.25;paintModal();}});
  }catch(error){document.querySelector('.drag-hint').textContent='La vue 3D est momentanément indisponible.';console.warn(error);}
});
addEventListener('tiratiti-dialog-close',()=>{modalToken++;dragging=false;if(dialogView){dialogView.dispose();dialogView=null;}});

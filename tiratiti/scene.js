import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const stage=document.querySelector('#product-stage');
const canvas=document.querySelector('#pot');
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const cache=new Map();
const loader=new GLTFLoader();
const draco=new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);
function loadModel(flavor){
  if(!cache.has(flavor))cache.set(flavor,loader.loadAsync(`assets/${flavor}.glb`).then(gltf=>{
    let model=gltf.scene;
    for(const s of gltf.scenes){const pot=s.children.find(n=>n.name.includes('TIRATITI')&&n.name.includes('250ML'));if(pot){model=pot;break;}}
    const wrap=new THREE.Group();wrap.add(model);
    let box=new THREE.Box3().setFromObject(wrap);let size=box.getSize(new THREE.Vector3());
    if(size.y<size.x&&size.y<size.z){model.rotation.x=-Math.PI/2;box=new THREE.Box3().setFromObject(wrap);size=box.getSize(new THREE.Vector3());}
    model.position.sub(box.getCenter(new THREE.Vector3()));
    wrap.scale.setScalar(2.4/size.y);
    model.traverse(obj=>{if(!obj.isMesh)return;
      for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
        mat.envMapIntensity=/Aluminium|Gravure|Sertissage/.test(mat.name)?.85:.16;
        if(!mat.map&&/Speculoos imbibe/.test(mat.name))mat.color.setHex(0xc17d3d);
        if(!mat.map&&/Mascarpone/.test(mat.name))mat.color.setHex(0xf0e8d6);
        if(/PET transparent/.test(mat.name)){
          // A thin clear shell keeps its reflections while the page shows through.
          mat.transmission=0;mat.transparent=true;mat.opacity=.3;mat.depthWrite=false;mat.side=THREE.FrontSide;
          mat.envMapIntensity=2.1;mat.roughness=.075;mat.clearcoat=1;mat.clearcoatRoughness=.09;
        }
        if(/Etiquette|Papier interieur/.test(mat.name)){mat.alphaTest=.2;mat.depthWrite=true;}
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
function makeView(canvas,host,canRender=()=>true){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<761?1:1.35));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
  const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(26,1,.1,100);
  const viewDirection=new THREE.Vector3(0,2.35,7.6).normalize();
  camera.position.copy(viewDirection).multiplyScalar(7.1);camera.lookAt(0,0,0);
  const env=studioEnvironment(renderer);scene.environment=env.texture;
  scene.add(new THREE.AmbientLight(0xfff4e0,.035));
  const key=new THREE.DirectionalLight(0xfff2df,2.6);key.position.set(-4.5,3.5,2.8);scene.add(key);
  const fill=new THREE.DirectionalLight(0xffecd1,.12);fill.position.set(4,1,3);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,.45);rim.position.set(3.5,2.5,-3);scene.add(rim);
  const rig=new THREE.Group();scene.add(rig);
  let disposed=false,width=0,height=0,pixelRatio=0;
  const render=()=>{if(!disposed&&!document.hidden&&canRender())renderer.render(scene,camera);};
  const resize=()=>{
    const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio,innerWidth<761?1:1.35);
    if(!w||!h||(w===width&&h===height&&dpr===pixelRatio))return;
    width=w;height=h;pixelRatio=dpr;renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);
    camera.aspect=w/h;
    // Fit the full turning silhouette in the narrowest camera dimension.
    // The viewing direction stays fixed, so resize cannot change the lid angle.
    const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*Math.min(1,camera.aspect));
    camera.position.copy(viewDirection).multiplyScalar(Math.max(7.1,1.53/Math.sin(halfFov)*1.04));
    camera.updateProjectionMatrix();render();
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  return {renderer,scene,camera,rig,render,dispose:()=>{disposed=true;observer.disconnect();env.dispose();renderer.dispose();}};
}
let hero,heroLid;
let progress=Number(stage.dataset.progress||0),visible=true,motionReduced=reduced.matches,lastHeroProgress=NaN;
let dialogView=null,modalAngle=0,dragging=false,lastX=0,modalToken=0,modalFrame=0;
const fullTurn=Math.PI*2;
// Reference poses, expressed as fractions of the complete scroll story.
// ZXY applies local yaw before the tumble and the screen-facing diagonal roll.
// Keep pitch unwrapped: quaternion shortest-path interpolation would skip the flip.
const turns=[
  {p:0,x:0,y:0,z:0},
  {p:.10,x:.65,y:-.3,z:-.22},                       // Show the lid from the first scroll.
  {p:.24,x:1.65,y:-.65,z:-.4},                      // Lid faces the camera.
  {p:.39,x:3.15,y:-1.05,z:-.12},                    // Upside-down; reveal the rear.
  {p:.53,x:4.85,y:-.55,z:.28},                      // Underside passes into view.
  {p:.65,x:fullTurn,y:0,z:.35},                     // Complete the backflip gradually.
  {p:.76,x:fullTurn+.78,y:-.7,z:1.02},               // A final diagonal pivot, without a hold.
  {p:.86,x:fullTurn+.52,y:-.42,z:.63},
  {p:.96,x:fullTurn,y:0,z:0},                       // Settle upright before the lid opens.
  {p:1,x:fullTurn,y:0,z:0},
];
const axes=['x','y','z'];
// Shape-preserving Hermite tangents prevent overshoot at changes of direction,
// while keeping angular velocity continuous at every reference pose.
const tangents=turns.map((pose,i)=>Object.fromEntries(axes.map(axis=>{
  if(i===0||i===turns.length-1)return [axis,0];
  const left=pose.p-turns[i-1].p,right=turns[i+1].p-pose.p;
  const a=(pose[axis]-turns[i-1][axis])/left,b=(turns[i+1][axis]-pose[axis])/right;
  if(a*b<=0)return [axis,0];
  const w1=2*right+left,w2=right+2*left;
  return [axis,(w1+w2)/(w1/a+w2/b)];
})));
function turnAt(p){
  p=Math.max(0,Math.min(1,p));
  const i=Math.min(turns.length-2,Math.max(0,turns.findIndex((v,j)=>j<turns.length-1&&p<=turns[j+1].p)));
  const a=turns[i],b=turns[i+1],span=b.p-a.p,t=(p-a.p)/span;
  const t2=t*t,t3=t2*t;
  const pose={};
  for(const axis of axes){
    pose[axis]=(2*t3-3*t2+1)*a[axis]+(t3-2*t2+t)*span*tangents[i][axis]
      +(-2*t3+3*t2)*b[axis]+(t3-t2)*span*tangents[i+1][axis];
  }
  return pose;
}
function prepareHeroLid(model){
  // Only the identified disc and pull-tab assembly move; the rim stays on the pot.
  const pieces=[];
  const lidName=/^(Couvercle\s*\||Languette\s*\||Bord interieur languette|Contour roule languette|Estampage autour du rivet|Rivet de languette|Nervure circulaire emboutie|Rainure circulaire ouverture)/;
  // GLTFLoader replaces spaces in object names with underscores.
  const readableName=obj=>obj.name.replace(/_/g,' ');
  model.traverse(obj=>{if(obj.isMesh&&lidName.test(readableName(obj)))pieces.push(obj);});
  if(!pieces.some(obj=>/^Couvercle\s*\|/.test(readableName(obj))))return null;
  hero.rig.updateMatrixWorld(true);
  const bounds=new THREE.Box3();
  for(const piece of pieces)bounds.union(new THREE.Box3().setFromObject(piece));
  const pivot=new THREE.Group();pivot.name='Tiratiti lid opening';
  pivot.position.copy(bounds.getCenter(new THREE.Vector3()));
  hero.rig.add(pivot);hero.rig.updateMatrixWorld(true);
  for(const piece of pieces)pivot.attach(piece);
  return {pivot,restY:pivot.position.y};
}
function paintHero(force=false){
  if(!hero||!visible||document.hidden)return;
  const p=motionReduced?0:progress;
  if(!force&&p===lastHeroProgress)return;
  lastHeroProgress=p;
  const pose=turnAt(p);hero.rig.rotation.set(pose.x,pose.y,pose.z,'ZXY');
  if(heroLid){
    const t=Math.max(0,Math.min(1,(p-.96)/.04)),open=t*t*(3-2*t);
    heroLid.pivot.position.y=heroLid.restY+.28*open;
    heroLid.pivot.rotation.x=-.2*open;
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
    hero=makeView(canvas,stage,()=>visible);
    // Clone only the objects: cached geometry and the closed product stay reusable.
    const model=(await loadModel('classique')).clone(true);hero.rig.add(model);
    heroLid=prepareHeroLid(model);paintHero(true);
    stage.classList.add('loaded');canvas.dataset.modelLoaded='true';
    document.querySelector('#motion-toggle').hidden=false;
    sceneStatus.textContent='Pot 3D prêt. Faites défiler pour le retourner.';
  }catch(error){
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

// Start 3D for every arrival. The photo keeps the product visible while its
// model downloads, and navigation remains usable throughout.
const stage=document.querySelector('#product-stage');
const poster=document.querySelector('#poster');
const button=document.querySelector('#retry-3d');
const status=document.querySelector('#scene-status');
let modulePromise,sceneModule,flavorRequest=0;
document.body.dataset.loadingState='ready';
window.TiratitiLoading={stage(){},finish(){}};
function getScene() {
  if(!modulePromise)modulePromise=import('./scene.js?v=automatic-arrival-26')
    .then(module=>{sceneModule=module;return module;})
    .catch(error=>{modulePromise=null;button.hidden=false;button.textContent='Relancer la 3D';
      status.textContent='La photo du produit reste disponible. Vous pouvez réessayer la vue en 3D.';
      throw error;});
  return modulePromise;
}
async function startHero() {
  try{const module=await getScene();module.loadHero();}
  catch(error){console.warn('La vue 3D sera disponible après une nouvelle tentative.',error);}
}
button.addEventListener('click',()=>{if(!sceneModule)startHero();});
addEventListener('tiratiti-flavor',async event=>{
  if(sceneModule)return;
  const host=document.querySelector('#dialog-visual'),hint=document.querySelector('.drag-hint');
  const flavor=event.detail.flavor;
  if(!['classique','speculoos','special'].includes(flavor))return;
  host.replaceChildren();const photo=document.createElement('img');
  photo.src=flavor==='classique'?poster.src:flavor==='speculoos'?'assets/photos/packshot-speculoos.webp':'assets/photos/packshot-special.webp';
  photo.alt='Pot Tiratiti '+(flavor==='classique'?'Le Classique':flavor==='speculoos'?'Le Spéculos':'Le Spécial');
  host.classList.toggle('has-product-photo',flavor!=='classique');
  if(flavor!=='classique')photo.className='dialog-packshot';host.append(photo);
  hint.hidden=flavor!=='classique';
  if(flavor!=='classique')return;
  hint.textContent='Chargement de la vue à 360°…';
  const request=++flavorRequest;
  try{
    await getScene();
    const dialog=document.querySelector('#flavor-dialog');
    if(request===flavorRequest&&dialog.open&&dialog.dataset.flavor===flavor)
      dispatchEvent(new CustomEvent('tiratiti-flavor',{detail:{flavor}}));
  }catch(error){document.querySelector('.drag-hint').textContent='La photo du produit reste disponible.';}
});
addEventListener('tiratiti-dialog-close',()=>{flavorRequest++;});
if(stage&&poster)startHero();

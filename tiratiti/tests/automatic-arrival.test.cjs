const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../loading.js'),'utf8').replace(/^import .*?;\r?\n/gm,'');
function arrive(width=390,coarse=false){
  const calls=[],events={};
  const classes=new Set(),stage={dataset:{progress:'.3'},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},setAttribute(){}};
  const button={hidden:true,addEventListener(name,fn){events.retry=fn;}};
  const canvasClasses=new Set();
  const canvas={dataset:{},hidden:false,classList:{
    toggle(name,enabled){if(enabled)canvasClasses.add(name);else canvasClasses.delete(name);},
    remove(name){canvasClasses.delete(name);},contains:name=>canvasClasses.has(name)
  }};
  const status={textContent:''};
  const host={children:[],classList:{toggle(){}},replaceChildren(){this.children=[];},append(node){this.children.push(node);}};
  const hint={};
  const document={body:{dataset:{}},createElement:tag=>({tag,style:{},listeners:{},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},setPointerCapture(){}}),querySelector:selector=>({'#product-stage':stage,'#poster':{src:'poster.webp'},'#pot':canvas,'#retry-3d':button,'#scene-status':status,'#dialog-visual':host,'.drag-hint':hint})[selector]};
  const createRenderedSequence=options=>{const record={...options,poses:[]};calls.push(record);return {ready:Promise.resolve(),render:p=>record.poses.push(p),dispose(){record.disposed=true;}};};
  const createScrollPlayhead=({onProgress})=>({set:onProgress,suspend(){},resume(){}});
  new Function('document','window','addEventListener','matchMedia','innerWidth','createRenderedSequence','createScrollPlayhead',source)(document,{},(n,f)=>events[n]=f,()=>({matches:coarse}),width,createRenderedSequence,createScrollPlayhead);
  return {calls,events,canvas,stage,classes,button,status,host,hint};
}
test('phone arrival automatically uses the sharp rendered animation, without importing real-time 3D',()=>{
  const f=arrive();assert.equal(f.calls.length,1);assert.equal(f.calls[0].manifestUrl,'assets/rendered-one-turn-mobile/manifest.json');
  assert.deepEqual(f.calls[0].poses,[.3]);assert.doesNotMatch(source,/import\(.*scene\.js/);
  f.calls[0].onReady();assert.ok(f.classes.has('loaded'));assert.equal(f.button.hidden,true);
});

test('overscan follows the poster and a compatibility canvas returns to normal framing',()=>{
  const f=arrive(),options=f.calls[0];
  assert.equal(options.referenceElement.src,'poster.webp');
  options.onLayout({width:640,height:760,top:760});assert.ok(f.canvas.classList.contains('video-overscan'));
  options.onReady();assert.ok(f.classes.has('loaded'));
  options.onFallback();assert.equal(f.classes.has('loaded'),false,'The photo is shown while a fallback loads');
  let removed=false;const replacement={dataset:{},classList:{remove(name){removed=name==='video-overscan';}}};
  options.onCanvas(replacement);assert.ok(removed,'A fallback cannot inherit the enlarged video geometry');
  options.onReady();assert.equal(replacement.dataset.renderMode,'blender');assert.ok(f.classes.has('loaded'));
});

test('a touch phone in landscape still uses only the compact animation profile',()=>{
  const phone=arrive(844,true),desktop=arrive(844,false);
  assert.equal(phone.calls[0].manifestUrl,'assets/rendered-one-turn-mobile/manifest.json');
  assert.equal(desktop.calls[0].manifestUrl,'assets/rendered-one-turn/manifest.json');
  phone.events['tiratiti-flavor']({detail:{flavor:'classique'}});
  assert.equal(phone.calls[1].manifestUrl,phone.calls[0].manifestUrl,'Product detail reuses the same compact files');
});

test('the compact published sequence preserves every authored pose and transparent product edge',()=>{
  const root=path.resolve(__dirname,'..'),folder='assets/rendered-one-turn-mobile/';
  const hd=JSON.parse(fs.readFileSync(path.join(root,'assets/rendered-one-turn/manifest.json')));
  const mobile=JSON.parse(fs.readFileSync(path.join(root,folder,'manifest.json')));
  const published=JSON.parse(fs.readFileSync(path.join(root,'public-files.json')));
  assert.equal(mobile.width,640);assert.equal(mobile.height,760);
  assert.deepEqual(mobile.frames,hd.frames);assert.deepEqual(mobile.timeline,hd.timeline);
  assert.equal(mobile.closureRotationDegrees,180);assert.notEqual(mobile.revision,hd.revision);
  let mobileBytes=0,hdBytes=0;
  for(const frame of mobile.frames){
    assert.ok(published.includes(folder+frame),'Every mobile pose is included in the deployment');
    const bytes=fs.readFileSync(path.join(root,folder,frame));mobileBytes+=bytes.length;
    hdBytes+=fs.statSync(path.join(root,'assets/rendered-one-turn',frame)).size;
    assert.equal(bytes.toString('ascii',12,16),'VP8X');assert.ok(bytes[20]&16,'Alpha stays present');
    assert.equal(bytes.readUIntLE(24,3)+1,640);assert.equal(bytes.readUIntLE(27,3)+1,760);
  }
  assert.ok(mobileBytes<hdBytes*.8,'The mobile profile must reduce actual transfer bytes by at least 20%');
});
test('scroll seeks both ways and reduced motion holds the closed pose',()=>{
  const f=arrive(1500);assert.equal(f.calls[0].manifestUrl,'assets/rendered-one-turn/manifest.json');
  f.events['tiratiti-scroll']({detail:{progress:.95,reduced:false}});
  f.events['tiratiti-scroll']({detail:{progress:.1,reduced:false}});
  f.events['tiratiti-scroll']({detail:{progress:.7,reduced:true}});
  assert.deepEqual(f.calls[0].poses,[.3,.95,.1,0]);
});
test('a failed animation preserves the poster and retry starts a new player',()=>{
  const f=arrive();f.calls[0].onReady();f.calls[0].onError(new Error('offline'));
  assert.equal(f.classes.has('loaded'),false);assert.equal(f.button.hidden,false);
  f.events.retry();assert.equal(f.calls.length,2);assert.equal(f.calls[0].disposed,true);
});
test('the detail rotates immediately in both directions and wraps while staying closed',()=>{
  const f=arrive();f.events['tiratiti-flavor']({detail:{flavor:'classique'}});
  const detail=f.host.children[1],poses=f.calls[1].poses;
  detail.listeners.keydown({key:'ArrowLeft',preventDefault(){}});
  assert.ok(poses.at(-1)>0&&poses.at(-1)<=.68,'Left must turn from the initial pose');
  detail.listeners.keydown({key:'ArrowRight',preventDefault(){}});
  assert.ok(Math.abs(poses.at(-1))<1e-5,'Opposite arrow returns to initial pose');
  for(let i=0;i<44;i++)detail.listeners.keydown({key:'ArrowRight',preventDefault(){}});
  assert.ok(poses.every(p=>p>=0&&p<=.68),'Opening is never selected');
  assert.ok(poses.at(-1)<.68,'Multiple turns do not stick at the end');
});

test('a 150 pixel drag covers a quarter of the one-turn detail loop',()=>{
  const f=arrive();f.events['tiratiti-flavor']({detail:{flavor:'classique'}});
  const detail=f.host.children[1],poses=f.calls[1].poses;
  detail.listeners.pointerdown({clientX:0,pointerId:1});
  detail.listeners.pointermove({clientX:150});
  const t=poses.at(-1)/.68,turn=t*t*t*(10+t*(-15+6*t));
  assert.ok(Math.abs(turn-.25)<1e-6,'The one-turn detail uses 600 pixels per full turn');
  detail.listeners.pointerup();
});

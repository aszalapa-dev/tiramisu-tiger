const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../loading.js'),'utf8').replace(/^import .*?;\r?\n/,'');
function arrive(width=390){
  const calls=[],events={};
  const classes=new Set(),stage={dataset:{progress:'.3'},classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},setAttribute(){}};
  const button={hidden:true,addEventListener(name,fn){events.retry=fn;}};
  const canvas={dataset:{},hidden:false};
  const status={textContent:''};
  const host={children:[],classList:{toggle(){}},replaceChildren(){this.children=[];},append(node){this.children.push(node);}};
  const hint={};
  const document={body:{dataset:{}},createElement:tag=>({tag,style:{},listeners:{},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},setPointerCapture(){}}),querySelector:selector=>({'#product-stage':stage,'#poster':{src:'poster.webp'},'#pot':canvas,'#retry-3d':button,'#scene-status':status,'#dialog-visual':host,'.drag-hint':hint})[selector]};
  const createRenderedSequence=options=>{const record={...options,poses:[]};calls.push(record);return {ready:Promise.resolve(),render:p=>record.poses.push(p),dispose(){record.disposed=true;}};};
  new Function('document','window','addEventListener','matchMedia','innerWidth','createRenderedSequence',source)(document,{},(n,f)=>events[n]=f,()=>({matches:false}),width,createRenderedSequence);
  return {calls,events,canvas,stage,classes,button,status,host,hint};
}
test('phone arrival automatically uses the sharp rendered animation, without importing real-time 3D',()=>{
  const f=arrive();assert.equal(f.calls.length,1);assert.match(f.calls[0].manifestUrl,/rendered-smooth/);
  assert.deepEqual(f.calls[0].poses,[.3]);assert.doesNotMatch(source,/import\(.*scene\.js/);
  f.calls[0].onReady();assert.ok(f.classes.has('loaded'));assert.equal(f.button.hidden,true);
});
test('scroll seeks both ways and reduced motion holds the closed pose',()=>{
  const f=arrive(1500);assert.match(f.calls[0].manifestUrl,/rendered-smooth/);
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

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=process.env.TEST_SOURCE_ROOT||path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'loading.js'),'utf8').replace(/^import .*?;\r?\n/gm,'');

async function fixture({initial='.3',input='.4'}={}){
  const {createScrollPlayhead}=await import(pathToFileURL(path.join(root,'scroll-playhead.js')));
  let time=0,id=0;const frames=new Map(),listeners=new Map(),players=[],observers=[];
  const listen=(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);};
  const stage={dataset:{progress:initial,inputProgress:input},classList:{add(){},remove(){}},setAttribute(){}};
  const button={hidden:true,addEventListener(name,fn){listen('retry',fn);}};
  const canvas={dataset:{},classList:{toggle(){},remove(){}}};
  const document={hidden:false,body:{dataset:{}},addEventListener:listen,
    querySelector:selector=>({'#product-stage':stage,'#poster':{src:'poster.webp'},'#pot':canvas,'#retry-3d':button,'#scene-status':{}})[selector]};
  const schedule=fn=>{frames.set(++id,fn);return id;},cancel=frame=>frames.delete(frame);
  class IntersectionObserver{constructor(fn){this.fn=fn;observers.push(this);}observe(node){this.node=node;}}
  const window={requestAnimationFrame:schedule,cancelAnimationFrame:cancel,IntersectionObserver};
  const createRenderedSequence=options=>{const player={poses:[],ready:Promise.resolve(),render(p){this.poses.push(p);},dispose(){this.disposed=true;}};players.push(player);return player;};
  new Function('document','window','addEventListener','matchMedia','innerWidth','createRenderedSequence','createScrollPlayhead',source)(
    document,window,listen,()=>({matches:true}),393,createRenderedSequence,
    options=>createScrollPlayhead(options,{schedule,cancel,now:()=>time,isHidden:()=>document.hidden}));
  function fire(name,detail){for(const fn of listeners.get(name)||[])fn({detail});}
  return {players,frames,stage,button,document,
    scroll(inputProgress,extra={}){fire('tiratiti-scroll',{progress:.1,inputProgress,reduced:false,...extra});},
    retry(){fire('retry');},
    visible(value){document.hidden=!value;fire('visibilitychange');},
    scene(value){assert.ok(observers.length,'The animation has a scene visibility observer');observers[0].fn([{target:stage,isIntersecting:value}]);},
    step(ms=1000/60){time+=ms;const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(time);},
    settle(){for(let n=0;frames.size&&n<120;n++)this.step();assert.equal(frames.size,0,'The animation must stop scheduling at rest');}
  };
}

test('arrival uses the current raw scroll pose once and starts automatically',async()=>{
  const f=await fixture();assert.equal(f.players.length,1);assert.deepEqual(f.players[0].poses,[.4]);
});
test('the can follows raw input once, while the page can keep its own text easing',async()=>{
  const f=await fixture();f.scroll(.6);f.settle();assert.equal(f.players[0].poses.at(-1),.6);
});
test('ordinary scrolling has no synchronous pose jump and coasts after the last event',async()=>{
  const f=await fixture();f.scroll(.45);assert.deepEqual(f.players[0].poses,[.4]);
  f.step();const first=f.players[0].poses.at(-1);f.step();assert.ok(f.players[0].poses.at(-1)>first);
  for(let i=0;i<5;i++)f.step();assert.ok(f.players[0].poses.at(-1)<.45,'A short coast must remain after one gesture');
  f.settle();assert.equal(f.players[0].poses.at(-1),.45);
});
test('retry preserves the currently displayed pose while the follower is moving',async()=>{
  const f=await fixture();f.scroll(.7);f.step();f.step();const pose=f.players[0].poses.at(-1);
  f.stage.dataset.progress='.1';f.stage.dataset.inputProgress='.7';f.retry();
  assert.equal(f.players[0].disposed,true);assert.deepEqual(f.players[1].poses,[pose]);
});
test('hidden input is cached and restoration waits for the fresh page scroll measurement',async()=>{
  const f=await fixture();f.visible(false);f.scroll(.8);assert.equal(f.frames.size,0);
  f.visible(true);assert.equal(f.players[0].poses.at(-1),.4,'Do not restore a stale target synchronously');
  f.scroll(.9);f.step();assert.equal(f.players[0].poses.at(-1),.9);assert.equal(f.frames.size,0);
});
test('offscreen targets do no work and reentry aligns without invisible catch-up',async()=>{
  const f=await fixture();f.scene(false);f.scroll(.8);assert.equal(f.frames.size,0);
  assert.equal(f.players[0].poses.at(-1),.4);f.scene(true);
  assert.equal(f.players[0].poses.at(-1),.8);assert.equal(f.frames.size,0);
});
test('a second hide cancels deferred restoration',async()=>{
  const f=await fixture();f.visible(false);f.scroll(.8);f.visible(true);assert.equal(f.frames.size,1);
  f.visible(false);assert.equal(f.frames.size,0);f.step();assert.equal(f.players[0].poses.at(-1),.4);
});
test('paused input waits, then aligns once to the newest target',async()=>{
  const f=await fixture();f.scroll(.7,{paused:true});assert.equal(f.frames.size,0);
  assert.equal(f.players[0].poses.at(-1),.4);f.scroll(.8,{paused:false});
  assert.equal(f.players[0].poses.at(-1),.8);assert.equal(f.frames.size,0);
});
test('reduced motion immediately holds the closed pose and stays idle',async()=>{
  const f=await fixture();f.scroll(.7);f.step();f.scroll(.9,{paused:true,reduced:true});
  assert.equal(f.players[0].poses.at(-1),0);assert.equal(f.frames.size,0);
});

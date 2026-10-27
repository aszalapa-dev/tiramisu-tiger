import {test} from 'node:test';
import assert from 'node:assert/strict';

let createRenderedSequence;
const moduleURL=new URL('../rendered-sequence.js',import.meta.url);
try{({createRenderedSequence}=await import(moduleURL));}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};

function fixture({count=100,cacheLimit,compact=true,manifest}={}){
  assert.equal(typeof createRenderedSequence,'function','The sequence player must be exported');
  const requests=[],fetches=[],pending=new Map(),draws=[],images=[],errors=[];
  let hidden=false,visible=true,visibilityCallback,resizeCallback,documentCallback,dimensions={width:400,height:500};
  let nextFrame=0;const scheduled=new Map();
  const canvas={width:0,height:0,getContext:()=>({clearRect(){},drawImage:bitmap=>draws.push(bitmap.index)})};
  const env={baseURL:'https://site.test/',compact,pixelRatio:3,
    measure:()=>dimensions,isHidden:()=>hidden,
    schedule:callback=>{const id=++nextFrame;scheduled.set(id,callback);queueMicrotask(()=>{if(scheduled.has(id)){scheduled.delete(id);callback();}});return id;},cancel:id=>scheduled.delete(id),
    observeResize:callback=>{resizeCallback=callback;return()=>{resizeCallback=null;};},
    observeVisibility:callback=>{visibilityCallback=callback;return()=>{visibilityCallback=null;};},
    onDocumentVisibility:callback=>{documentCallback=callback;return()=>{documentCallback=null;};},
    fetch:async(url,options={})=>{
      fetches.push({url,options});const {signal}=options;
      if(url.endsWith('manifest.json'))return {ok:true,json:async()=>manifest??{version:1,width:640,height:840,frames:Array.from({length:count},(_,i)=>`frame-${i}.webp`)}};
      const index=Number(/frame-(\d+)\.webp/.exec(url)[1]);requests.push(index);
      return new Promise((resolve,reject)=>{
        pending.set(index,{resolve,reject});
        signal?.addEventListener('abort',()=>{pending.delete(index);reject(new DOMException('Aborted','AbortError'));},{once:true});
      });
    },
    decode:async response=>{const image={index:response.index,closed:false,close(){this.closed=true;}};images.push(image);return image;}
  };
  const player=createRenderedSequence({canvas,manifestUrl:'/render/manifest.json',cacheLimit,onError:error=>errors.push(error)},env);
  player.ready.catch(()=>{});
  return {player,canvas,requests,fetches,draws,images,errors,pending,
    async resolve(index){assert.ok(pending.has(index),`Frame ${index} was requested`);pending.get(index).resolve({ok:true,index});pending.delete(index);await flush();},
    async fail(index){pending.get(index).reject(new Error('network'));pending.delete(index);await flush();},
    setVisible(value){visible=value;visibilityCallback?.(visible);},
    setHidden(value){hidden=value;documentCallback?.();},
    resize(size){if(size)dimensions=size;resizeCallback?.();}
  };
}

test('starts automatically, caps mobile pixels and requests at most two frames',async()=>{
  const f=fixture();await flush();
  assert.deepEqual(f.requests,[0,1]);assert.equal(f.pending.size,2);
  await f.resolve(0);await f.player.ready;
  assert.equal(f.draws.at(-1),0);assert.equal(f.canvas.width,600);assert.equal(f.canvas.height,750);
  assert.ok(f.pending.size<=4);f.player.dispose();
});

test('a later exact frame wins over stale asynchronous downloads and reverse seeking works',async()=>{
  const f=fixture();await flush();await f.resolve(0);await f.resolve(1);
  const occupied=[...f.pending.keys()];f.player.render(.7);
  assert.ok(f.requests.includes(69));await f.resolve(69);
  assert.equal(f.draws.at(-1),69);
  for(const old of occupied)if(f.pending.has(old))await f.resolve(old);
  assert.equal(f.draws.at(-1),69,'A stale completion cannot overwrite the desired pose');
  f.player.render(0);await flush();
  if(f.draws.at(-1)!==0&&f.pending.has(0))await f.resolve(0);
  assert.equal(f.draws.at(-1),0);f.player.dispose();
});

test('bursts deduplicate downloads and the decoded cache releases evicted images',async()=>{
  const f=fixture({cacheLimit:4});await flush();await f.resolve(0);
  for(let i=0;i<30;i++)f.player.render(.5);
  assert.equal(f.requests.filter(index=>index===50).length,1);
  await f.resolve(50);
  for(let i=0;i<6&&f.pending.size;i++)await f.resolve([...f.pending.keys()][0]);
  assert.ok(f.images.filter(image=>!image.closed).length<=4);
  assert.ok(f.images.some(image=>image.closed),'Decoded images are released after eviction');
  assert.equal(f.draws.at(-1),50);
  f.player.dispose();assert.ok(f.images.every(image=>image.closed));
});

test('offscreen and hidden states stop drawing and queued work, then resume the latest pose',async()=>{
  const f=fixture();await flush();await f.resolve(0);f.setVisible(false);
  f.player.render(.9);const before=f.draws.length;
  for(const index of [...f.pending.keys()])await f.resolve(index);
  assert.equal(f.draws.length,before);assert.equal(f.pending.size,0);
  f.setVisible(true);await flush();assert.ok(f.pending.has(89));await f.resolve(89);
  assert.equal(f.draws.at(-1),89);f.setHidden(true);f.player.render(.2);
  const hiddenCount=f.draws.length;for(const index of [...f.pending.keys()])await f.resolve(index);
  assert.equal(f.draws.length,hiddenCount);assert.equal(f.pending.size,0);
  f.setHidden(false);await flush();assert.ok(f.pending.has(20));f.player.dispose();
});

test('dispose aborts downloads, removes observers and ignores later renders',async()=>{
  const f=fixture();await flush();await f.resolve(0);await f.player.ready;
  f.player.dispose();await flush();const requests=f.requests.length,draws=f.draws.length;
  f.player.render(1);f.resize();f.setVisible(true);f.setHidden(false);await flush();
  assert.equal(f.pending.size,0);assert.equal(f.requests.length,requests);assert.equal(f.draws.length,draws);
  assert.ok(f.images.every(image=>image.closed));
});

test('malformed manifests reject readiness and report an actionable error',async()=>{
  const f=fixture({manifest:{width:640,height:840,frames:[]}});
  await assert.rejects(f.player.ready,/manifest|séquence/i);await flush();
  assert.equal(f.errors.length,1);assert.equal(f.requests.length,0);f.player.dispose();
});

test('desktop pixel density stays bounded and progress outside the timeline clamps',async()=>{
  const f=fixture({compact:false});f.player.render(2);await flush();
  assert.equal(f.requests[0],99);await f.resolve(99);await f.player.ready;
  assert.equal(f.canvas.width,600);assert.equal(f.canvas.height,750);
  f.player.render(-1);const first=[...f.pending.keys()][0];await f.resolve(first);
  assert.ok(f.requests.includes(0));f.player.dispose();
});

test('a bitmap finishing decode after disposal is released without painting',async()=>{
  let finishDecode,closed=0,draws=0;
  const bitmap={close(){closed++;}};
  const player=createRenderedSequence({canvas:{getContext:()=>({clearRect(){},drawImage(){draws++;}})},manifestUrl:'/manifest.json'},{
    baseURL:'https://site.test/',compact:true,pixelRatio:1,measure:()=>({width:100,height:100}),isHidden:()=>false,
    observeResize:()=>()=>{},observeVisibility:()=>()=>{},onDocumentVisibility:()=>()=>{},
    fetch:async url=>({ok:true,json:async()=>({width:640,height:840,frames:['frame-0.webp']})}),
    decode:()=>new Promise(resolve=>{finishDecode=resolve;})
  });
  await flush();assert.equal(typeof finishDecode,'function');player.dispose();finishDecode(bitmap);await flush();
  assert.equal(closed,1);assert.equal(draws,0);await assert.rejects(player.ready,{name:'AbortError'});
});

test('a failed current frame reports the failure without starting unbounded retries',async()=>{
  const f=fixture();await flush();await f.fail(0);
  await assert.rejects(f.player.ready,/network/);assert.equal(f.errors.length,1);
  const before=f.requests.length;f.player.render(0);await flush();assert.equal(f.requests.length,before);
  f.player.dispose();
});

test('resizing while hidden restores the same pose when it becomes visible',async()=>{
  const f=fixture();await flush();await f.resolve(0);await f.player.ready;
  f.setHidden(true);const draws=f.draws.length;f.resize({width:300,height:400});
  assert.equal(f.draws.length,draws,'Hidden resize does not paint');
  f.setHidden(false);await flush();
  assert.equal(f.draws.length,draws+1,'The cleared canvas redraws even though the pose did not change');
  assert.equal(f.draws.at(-1),0);f.player.dispose();
});

test('selecting a failed prefetched frame gives it a fresh attempt',async()=>{
  const f=fixture();await flush();await f.resolve(0);await f.player.ready;await f.fail(1);
  assert.equal(f.errors.length,0,'An unrelated prefetch failure does not hide the product');
  f.player.render(0);await flush();assert.equal(f.requests.filter(index=>index===1).length,1);
  f.player.render(1/99);await flush();
  assert.equal(f.requests.filter(index=>index===1).length,2,'Selecting that pose retries its failed prefetch');
  await f.resolve(1);assert.equal(f.draws.at(-1),1);assert.equal(f.errors.length,0);f.player.dispose();
});

test('a fresh attempt failing as the target reports an error without looping',async()=>{
  const f=fixture();await flush();await f.resolve(0);await f.player.ready;await f.fail(1);
  f.player.render(1/99);await flush();
  assert.ok(f.pending.has(1),'The failed prefetch is retried as the target');await f.fail(1);
  assert.equal(f.errors.length,1);const before=f.requests.length;
  f.player.render(1/99);f.player.render(.8);await flush();assert.equal(f.requests.length,before);
  assert.equal(f.requests.filter(index=>index===1).length,2);f.player.dispose();
});

test('revisioned frames use versioned URLs and the compressed browser cache',async()=>{
  const f=fixture({manifest:{version:1,revision:'encoded-sha-123',width:640,height:840,frames:['frame-0.webp','frame-1.webp?quality=80']}});
  await flush();const frames=f.fetches.filter(request=>request.url.includes('frame-'));
  assert.equal(frames.length,2);
  for(const request of frames){
    assert.equal(new URL(request.url).searchParams.get('v'),'encoded-sha-123');
    assert.equal(request.options.cache,'force-cache');
  }
  assert.equal(new URL(frames[1].url).searchParams.get('quality'),'80');
  assert.equal(f.fetches[0].options.cache,undefined,'The manifest still revalidates normally');f.player.dispose();
});

test('unversioned legacy manifests keep normal browser cache validation',async()=>{
  const f=fixture();await flush();const frame=f.fetches.find(request=>request.url.includes('frame-'));
  assert.equal(new URL(frame.url).searchParams.has('v'),false);assert.equal(frame.options.cache,undefined);f.player.dispose();
});

test('the default mobile window decodes six frames while desktop keeps twenty',async()=>{
  for(const [compact,expected] of [[true,6],[false,20]]){
    const f=fixture({compact});await flush();
    for(let i=0;i<30&&f.pending.size;i++)await f.resolve([...f.pending.keys()][0]);
    assert.equal(f.requests.length,25,'Compressed preload is bounded to the initial pose and24ahead');
    assert.equal(f.images.filter(image=>!image.closed).length,expected);f.player.dispose();
  }
});

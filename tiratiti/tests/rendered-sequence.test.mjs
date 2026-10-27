import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRenderedSequence} from '../rendered-sequence.js';
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const timeline={rotationFrames:180,turns:2,rotationEnd:.68,openingStart:.70,openingEnd:.96,openingFrameStep:1/360,openingScale:.86,shrinkStart:.62,shrinkEnd:.70};
const manifestFor=(count=100,extra={})=>({width:800,height:950,frames:Array.from({length:count},(_,i)=>`frame-${i}.webp`),...extra});

function fixture({manifest=manifestFor(),compact=true,deferDecode=false,fixedScale=false}={}){
  const records=[],pending=new Map(),draws=[],images=[],errors=[],rafs=new Map(),decodes=new Map();
  let nextRAF=0,maxRAF=0,hidden=false,visibleChanged,documentChanged,resizeChanged,size={width:400,height:500},readyCalls=0,clock=0;
  const canvas={width:0,height:0,getContext:()=>({clearRect(){},drawImage:(image,...args)=>draws.push({index:image.index,args})})};
  const env={baseURL:'https://site.test/',compact,pixelRatio:3,measure:()=>size,isHidden:()=>hidden,
    observeResize:callback=>{resizeChanged=callback;return()=>resizeChanged=null;},
    observeVisibility:callback=>{visibleChanged=callback;return()=>visibleChanged=null;},
    onDocumentVisibility:callback=>{documentChanged=callback;return()=>documentChanged=null;},
    schedule:callback=>{rafs.set(++nextRAF,callback);maxRAF=Math.max(maxRAF,rafs.size);return nextRAF;},cancel:id=>rafs.delete(id),
    fetch:async(url,options={})=>{
      if(url.endsWith('manifest.json'))return {ok:true,json:async()=>manifest};
      const index=Number(/frame-(\d+)\.webp/.exec(url)[1]);
      const record={index,url,options,aborted:false,finished:false,started:clock};records.push(record);
      return new Promise((resolve,reject)=>{
        record.resolve=()=>{record.finished=true;if(pending.get(index)===record)pending.delete(index);resolve({ok:true,index,blob:async()=>({index,size:32000})});};
        record.reject=error=>{record.finished=true;if(pending.get(index)===record)pending.delete(index);reject(error);};
        pending.set(index,record);
        options.signal?.addEventListener('abort',()=>{record.aborted=true;record.reject(new DOMException('Aborted','AbortError'));},{once:true});
      });
    },
    decode:async blob=>{
      const image={index:blob.index,closed:false,close(){this.closed=true;}};images.push(image);
      if(deferDecode)return new Promise(resolve=>decodes.set(blob.index,()=>resolve(image)));
      return image;
    }
  };
  const player=createRenderedSequence({canvas,manifestUrl:'/manifest.json',fixedScale,onReady(){readyCalls++;},onError:error=>errors.push(error)},env);
  player.ready.catch(()=>{});
  const result={player,canvas,records,pending,draws,images,errors,rafs,decodes,
    get maxRAF(){return maxRAF;},get readyCalls(){return readyCalls;},
    async frame(){const callbacks=[...rafs.values()];rafs.clear();for(const callback of callbacks)callback();await flush();},
    async settle(){await flush();await result.frame();},
    async resolve(index){assert.ok(pending.has(index),`Frame ${index} pending`);pending.get(index).resolve();await result.settle();},
    async fail(index){assert.ok(pending.has(index),`Frame ${index} pending`);pending.get(index).reject(new Error('network'));await result.settle();},
    async drain(){for(let i=0;i<100&&pending.size;i++)await result.resolve([...pending.keys()][0]);assert.equal(pending.size,0);},
    async time(value,latency=40){clock=value;for(const record of [...pending.values()])if(record.started+latency<=clock)record.resolve();await result.settle();},
    setVisible(value){visibleChanged?.(value);},setHidden(value){hidden=value;documentChanged?.();},
    resize(value){size=value;resizeChanged?.();}
  };
  return result;
}

test('the first pose becomes ready before compressed preloading completes',async()=>{
  const f=fixture();await flush();assert.deepEqual(f.records.map(r=>r.index),[0,1]);
  await f.resolve(0);await f.player.ready;assert.equal(f.readyCalls,1);assert.equal(f.draws.at(-1).index,0);
  assert.equal(f.canvas.width,600);assert.equal(f.canvas.height,750);assert.ok(f.pending.size<=4);f.player.dispose();
});

test('a large cold seek immediately cancels speculative requests and prioritises the latest pose',async()=>{
  const f=fixture();await flush();f.player.render(.7);await flush();
  assert.ok(f.pending.has(69),'Latest exact pose starts without waiting for old transfers');
  assert.ok(f.records.slice(0,2).every(record=>record.aborted));
  f.player.render(.2);await flush();assert.ok(f.pending.has(20));
  await f.resolve(20);assert.equal(f.draws.at(-1).index,20);
  for(const record of f.records.filter(r=>r.aborted))record.resolve();await f.settle();
  assert.equal(f.draws.at(-1).index,20);assert.ok(f.pending.size<=4);f.player.dispose();
});

test('compressed lookahead is independent of the small decoded window and reused after a cold seek',async()=>{
  const f=fixture();await flush();await f.drain();
  assert.equal(f.records.length,25,'Only the first pose and 24 compressed lookahead frames load');
  assert.equal(f.images.filter(image=>!image.closed).length,6);
  assert.ok(!f.images.some(image=>image.index===10),'A future compressed frame is not decoded early');
  f.player.render(10/99);await f.settle();
  assert.equal(f.draws.at(-1).index,10,'A compressed cached pose decodes without waiting for network');
  assert.equal(f.records.filter(r=>r.index===10).length,1);
  assert.ok(f.images.filter(image=>!image.closed).length<=6);f.player.dispose();
});

test('draws coalesce to one RAF, choose the final requested pose and stop when idle',async()=>{
  const f=fixture();await flush();await f.drain();const before=f.draws.length;
  f.player.render(1/99);f.player.render(2/99);f.player.render(3/99);
  assert.equal(f.rafs.size,1);assert.equal(f.draws.length,before);
  await f.frame();assert.equal(f.draws.at(-1).index,3);assert.equal(f.draws.length,before+1);
  await f.frame();assert.equal(f.rafs.size,0);assert.equal(f.draws.length,before+1);assert.equal(f.maxRAF,1);f.player.dispose();
});

test('hidden resize redraws the cleared buffer on returning to the same pose',async()=>{
  const f=fixture();await flush();await f.resolve(0);f.setHidden(true);const before=f.draws.length;
  f.resize({width:300,height:400});await f.settle();assert.equal(f.draws.length,before);
  f.setHidden(false);await f.settle();assert.equal(f.draws.length,before+1);assert.equal(f.draws.at(-1).index,0);f.player.dispose();
});

test('hidden and offscreen states stop draws and queued work, then resume the latest pose',async()=>{
  const f=fixture();await flush();await f.resolve(0);f.setVisible(false);f.player.render(.9);const before=f.draws.length;
  for(const index of [...f.pending.keys()])await f.resolve(index);
  assert.equal(f.draws.length,before);assert.equal(f.pending.size,0);assert.equal(f.rafs.size,0);
  f.setVisible(true);await flush();assert.ok(f.pending.has(89));await f.resolve(89);
  assert.equal(f.draws.at(-1).index,89);f.player.dispose();
});

test('a failed prefetch retries when selected and reports a second failure without looping',async()=>{
  const f=fixture();await flush();await f.resolve(0);await f.fail(1);assert.equal(f.errors.length,0);
  f.player.render(1/99);await flush();assert.ok(f.pending.has(1));await f.fail(1);
  assert.equal(f.errors.length,1);const count=f.records.length;f.player.render(.8);await f.settle();assert.equal(f.records.length,count);f.player.dispose();
});

test('dispose cancels RAF and requests, and releases bitmaps whose decode finishes later',async()=>{
  const f=fixture({deferDecode:true});await flush();await f.resolve(0);assert.ok(f.decodes.has(0));
  f.player.dispose();f.decodes.get(0)();await f.settle();
  assert.equal(f.draws.length,0);assert.equal(f.rafs.size,0);assert.equal(f.pending.size,0);
  assert.ok(f.images.every(image=>image.closed));await assert.rejects(f.player.ready,{name:'AbortError'});
});

test('timeline transitions keep apparent scale continuous and rotation requests wrap',async()=>{
  const f=fixture({manifest:manifestFor(275,{timeline})});await flush();
  assert.ok(f.records.some(record=>record.index===0));await f.resolve(0);
  f.player.render(.699999);await f.settle();const closed=f.draws.at(-1);
  f.player.render(.70);await flush();assert.ok(f.pending.has(180));await f.resolve(180);const open=f.draws.at(-1);
  assert.equal(closed.index,0);assert.equal(open.index,180);
  assert.ok(Math.abs(closed.args[2]-open.args[2]*.86)<1e-6,'Opening pixels were already rendered at 86% scale');
  f.player.dispose();
});

test('versioned compressed fetches use the browser cache while legacy URLs revalidate normally',async()=>{
  for(const revision of [undefined,'new-render-sha']){
    const f=fixture({manifest:manifestFor(100,{revision})});await flush();const record=f.records[0];
    assert.equal(record.options.cache,revision?'force-cache':undefined);
    assert.equal(new URL(record.url).searchParams.get('v'),revision||null);f.player.dispose();
  }
});

test('fixed detail size is drawn atomically without CSS compensation',async()=>{
  const f=fixture({manifest:manifestFor(275,{timeline}),fixedScale:true});await flush();await f.resolve(0);
  const original=f.draws.at(-1);f.player.render(.6999);await f.settle();
  assert.equal(f.draws.at(-1).args[2],original.args[2]);
  f.player.render(.70);await flush();await f.resolve(180);
  assert.ok(Math.abs(f.draws.at(-1).args[2]*.86-original.args[2])<1e-9);f.player.dispose();
});

const invert=value=>{let low=0,high=1;for(let i=0;i<40;i++){const t=(low+high)/2,s=t*t*t*(10+t*(-15+6*t));if(s<value)low=t;else high=t;}return (low+high)/2*.68;};
test('late prefetch completions cannot reverse a forward gesture, including the closed-loop wrap',async()=>{
  const f=fixture({manifest:manifestFor(275,{timeline})});await flush();await f.resolve(0);
  f.player.render(invert(170/360));await flush();await f.resolve(170);await f.drain();
  const start=f.draws.length;
  for(let angle=171;angle<=190;angle++){
    f.player.render(invert(angle/360));await f.settle();
    for(const record of [...f.pending.values()].reverse())record.resolve();await f.settle();
  }
  let previous=170;
  for(const draw of f.draws.slice(start)){
    const coordinate=draw.index+(draw.index<90?180:0);
    assert.ok(coordinate>=previous,'Late work cannot make the product move backwards');previous=coordinate;
  }
  assert.equal(previous,190);
  const reverseStart=f.draws.length;
  for(let angle=189;angle>=170;angle--){
    f.player.render(invert(angle/360));await f.settle();
    for(const record of [...f.pending.values()].reverse())record.resolve();await f.settle();
  }
  previous=190;
  for(const draw of f.draws.slice(reverseStart)){
    const coordinate=draw.index+(draw.index<90?180:0);
    assert.ok(coordinate<=previous,'A deliberate reversal remains responsive through the wrap');previous=coordinate;
  }
  assert.equal(previous,170);f.player.dispose();
});

test('40 ms transfers sustain forward movement without backwards visual steps',async testContext=>{
  const f=fixture({manifest:manifestFor(275,{timeline})});f.player.render(.2);await flush();
  for(let time=0;time<=400;time+=10)await f.time(time);
  await f.player.ready;const start=f.draws.length;
  for(let tick=1;tick<=150;tick++){
    f.player.render(.2+.25*tick/150);await f.time(400+tick*1000/60);
  }
  const changes=f.draws.slice(start).filter((draw,index,array)=>!index||draw.index!==array[index-1].index);
  let previous=55,maximumStep=0;
  for(const draw of changes){
    let coordinate=draw.index;while(coordinate<previous-90)coordinate+=180;
    assert.ok(coordinate>=previous,'Monotonic input produces monotonic rotation');maximumStep=Math.max(maximumStep,coordinate-previous);previous=coordinate;
  }
  assert.ok(changes.length>=75,'The slow-network gesture keeps at least 30 visible changes per second ('+changes.length+')');
  testContext.diagnostic(changes.length+' monotonic changes / 2.5 s, '+changes.length/2.5+' per second, max '+maximumStep*2+' degrees');f.player.dispose();
});

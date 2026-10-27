import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRenderedSequence} from '../rendered-sequence.js';
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const timeline={rotationFrames:180,turns:2,rotationEnd:.68,openingStart:.70,openingEnd:.96,openingFrameStep:1/360,openingScale:.86,shrinkStart:.62,shrinkEnd:.70};
const manifestFor=(count=100,extra={})=>({width:800,height:950,frames:Array.from({length:count},(_,i)=>`frame-${i}.webp`),...extra});

function fixture({manifest=manifestFor(),compact=true,deferDecode=false,decodeMs=0,fixedScale=false,nativeDecoder,bandwidthMbps=0,transferBytes=42000,cacheResponses=false}={}){
  const records=[],pending=new Map(),draws=[],images=[],errors=[],rafs=new Map(),decodes=new Map();
  const compressedCache=new Set();let cacheReads=0;
  let nextRAF=0,maxRAF=0,hidden=false,visibleChanged,documentChanged,resizeChanged,size={width:400,height:500},readyCalls=0,clock=0;
  const canvas={width:0,height:0,getContext:()=>({clearRect(){},drawImage:(image,...args)=>draws.push({index:image.index,args,time:clock})})};
  if(nativeDecoder)canvas.ownerDocument={defaultView:{createImageBitmap:nativeDecoder}};
  const env={baseURL:'https://site.test/',compact,pixelRatio:3,measure:()=>size,isHidden:()=>hidden,
    observeResize:callback=>{resizeChanged=callback;return()=>resizeChanged=null;},
    observeVisibility:callback=>{visibleChanged=callback;return()=>visibleChanged=null;},
    onDocumentVisibility:callback=>{documentChanged=callback;return()=>documentChanged=null;},
    schedule:callback=>{rafs.set(++nextRAF,callback);maxRAF=Math.max(maxRAF,rafs.size);return nextRAF;},cancel:id=>rafs.delete(id),
    fetch:async(url,options={})=>{
      if(url.endsWith('manifest.json'))return {ok:true,json:async()=>manifest};
      const index=Number(/frame-(\d+)\.webp/.exec(url)[1]);
      if(cacheResponses&&compressedCache.has(index)){
        if(++cacheReads>256)throw new Error('Compressed cache is being refetched without settling');
        return {ok:true,index,blob:async()=>({index,size:transferBytes})};
      }
      const record={index,url,options,aborted:false,finished:false,started:clock,remaining:transferBytes,received:0};records.push(record);
      return new Promise((resolve,reject)=>{
        record.resolve=()=>{record.finished=true;compressedCache.add(index);if(pending.get(index)===record)pending.delete(index);resolve({ok:true,index,blob:async()=>({index,size:transferBytes})});};
        record.reject=error=>{record.finished=true;if(pending.get(index)===record)pending.delete(index);reject(error);};
        pending.set(index,record);
        options.signal?.addEventListener('abort',()=>{if(!record.finished){record.aborted=true;record.reject(new DOMException('Aborted','AbortError'));}},{once:true});
      });
    },
    decode:nativeDecoder?undefined:async (blob,options)=>{
      const image={index:blob.index,decodeOptions:options,closed:false,close(){this.closed=true;}};images.push(image);
      if(deferDecode||decodeMs)return new Promise(resolve=>{
        const complete=()=>{complete.done=true;resolve(image);};complete.due=clock+decodeMs;decodes.set(blob.index,complete);
      });
      return image;
    }
  };
  const player=createRenderedSequence({canvas,manifestUrl:'/manifest.json',fixedScale,onReady(){readyCalls++;},onError:error=>errors.push(error)},env);
  player.ready.catch(()=>{});
  const result={player,canvas,records,pending,draws,images,errors,rafs,decodes,
    get maxRAF(){return maxRAF;},get readyCalls(){return readyCalls;},
    get cacheReads(){return cacheReads;},
    async frame(){const callbacks=[...rafs.values()];rafs.clear();for(const callback of callbacks)callback();await flush();},
    async settle(){await flush();await result.frame();},
    async resolve(index){assert.ok(pending.has(index),`Frame ${index} pending`);pending.get(index).resolve();await result.settle();},
    async fail(index){assert.ok(pending.has(index),`Frame ${index} pending`);pending.get(index).reject(new Error('network'));await result.settle();},
    async drain(){for(let i=0;i<100&&pending.size;i++)await result.resolve([...pending.keys()][0]);assert.equal(pending.size,0);},
    async time(value,latency=40){
      if(bandwidthMbps){
        while(clock<value-1e-6){
          const next=Math.min(value,clock+1),active=[...pending.values()].filter(record=>record.started+latency<=clock);
          const share=active.length?bandwidthMbps*1e6/8/1000*(next-clock)/active.length:0;let changed=false;clock=next;
          for(const record of active){const bytes=Math.min(share,record.remaining);record.remaining-=bytes;record.received+=bytes;if(record.remaining<=1e-6){record.resolve();changed=true;}}
          if(decodeMs)for(const complete of decodes.values())if(!complete.done&&complete.due<=clock){complete();changed=true;}
          if(changed)await flush();
        }
      }else{
        clock=value;for(const record of [...pending.values()])if(record.started+latency<=clock)record.resolve();await flush();
        if(decodeMs)for(const complete of decodes.values())if(!complete.done&&complete.due<=clock)complete();
      }
      await result.settle();
    },
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

test('one turn reduces visible angular steps at 60 Hz with 40 ms transfers',async testContext=>{
  async function gesture(turns){
    const f=fixture({manifest:manifestFor(275,{timeline:{...timeline,turns}})});
    f.player.render(.2);await flush();
    for(let time=0;time<=400;time+=10)await f.time(time);
    await f.player.ready;const start=f.draws.length;let previous=f.draws.at(-1).index,maximumStep=0;
    for(let tick=1;tick<=150;tick++){
      f.player.render(.2+.25*tick/150);await f.time(400+tick*1000/60);
    }
    const changes=f.draws.slice(start).filter((draw,index,array)=>!index||draw.index!==array[index-1].index);
    for(const draw of changes){
      let coordinate=draw.index;while(coordinate<previous-90)coordinate+=180;
      assert.ok(coordinate>=previous,'Late transfers cannot reverse the '+turns+' turn gesture');
      maximumStep=Math.max(maximumStep,coordinate-previous);previous=coordinate;
    }
    assert.equal(f.errors.length,0);f.player.dispose();return {count:changes.length,maximumStep};
  }
  const two=await gesture(2),one=await gesture(1);
  assert.ok(one.maximumStep<=1,'One-turn playback advances at most one 2-degree image per visible change');
  assert.ok(one.maximumStep<two.maximumStep,'Fewer turns reduce angular jumps under the same input and latency');
  assert.ok(one.count>=75,'One-turn playback sustains at least 30 changes per second');
  testContext.diagnostic('one turn: '+one.count+' changes/2.5s, max '+one.maximumStep*2+' degrees; two turns: max '+two.maximumStep*2+' degrees; no backwards steps');
});

test('40–80 ms decoders keep forward progress after their six-frame window moves on',async context=>{
  for(const decodeMs of [40,80]){
    const f=fixture({manifest:manifestFor(275,{timeline:{...timeline,turns:1}}),decodeMs});
    f.player.render(.2);await flush();for(let tick=0;tick<=48;tick++)await f.time(tick*1000/60,0);
    await f.player.ready;const start=f.draws.length;
    for(let tick=1;tick<=150;tick++){
      f.player.render(.2+.25*tick/150);await f.time(800+tick*1000/60,0);
    }
    const changes=f.draws.slice(start).filter((draw,index,array)=>!index||draw.index!==array[index-1].index);
    assert.ok(changes.length>=20,'A slow decoder must produce visible progress during the gesture');
    assert.ok(changes.every((draw,index)=>!index||draw.index>=changes[index-1].index),'Late images stay monotonic');
    const inFlight=[...f.decodes.values()].filter(complete=>!complete.done).length;
    assert.ok(inFlight<=1);assert.ok(f.images.filter(image=>!image.closed).length<=6+inFlight,'Useful late frames keep six cached images plus the one decoding job');
    context.diagnostic(decodeMs+' ms decoder: '+changes.length+' changes during the 2.5 s gesture');f.player.dispose();
  }
});

test('a completed old-direction decode cannot overwrite a reversed gesture',async()=>{
  const f=fixture({manifest:manifestFor(275,{timeline:{...timeline,turns:1}}),deferDecode:true});
  f.player.render(invert(30/180));await flush();await f.resolve(30);f.decodes.get(30)();await f.settle();
  await f.resolve(31);assert.ok(f.decodes.has(31));
  f.player.render(invert(29/180));await flush();await f.resolve(29);
  f.decodes.get(31)();await f.settle();assert.notEqual(f.draws.at(-1).index,31);
  assert.equal(f.images.find(image=>image.index===31).closed,true);
  f.decodes.get(29)();await f.settle();assert.equal(f.draws.at(-1).index,29);f.player.dispose();
});

test('resize immediately restores the displayed frame while an ambiguous new target is pending',async()=>{
  const f=fixture({manifest:manifestFor(275,{timeline:{...timeline,turns:1}})});await flush();await f.resolve(0);
  const before=f.draws.length;f.player.render(.34);f.resize({width:390,height:480});
  assert.equal(f.draws.length,before+1,'The resized buffer is restored before the next RAF or decode');
  assert.equal(f.draws.at(-1).index,0,'The visible product stays present while its new pose downloads');f.player.dispose();
});

test('compact decoding requests the actual display density instead of full HD pixels',async()=>{
  const f=fixture();f.resize({width:390,height:500});await flush();await f.resolve(0);
  assert.deepEqual(f.images[0].decodeOptions,{resizeWidth:585,resizeHeight:695,resizeQuality:'high'});
  assert.equal(f.canvas.width,585);f.player.dispose();
  const desktop=fixture({compact:false});await flush();await desktop.resolve(0);
  assert.equal(desktop.images[0].decodeOptions,undefined,'Desktop rendering retains its original source resolution');desktop.player.dispose();
});

test('Safari rejecting ImageBitmap resize options retries the same image without them',async()=>{
  const calls=[];
  const f=fixture({nativeDecoder:async (blob,options)=>{
    calls.push(options);if(options)throw new TypeError('Resize options unsupported');return {index:blob.index,close(){}};
  }});
  f.resize({width:390,height:500});await flush();await f.resolve(0);await f.player.ready;
  assert.deepEqual(calls,[{resizeWidth:585,resizeHeight:695,resizeQuality:'high'},undefined]);
  assert.equal(f.draws.at(-1).index,0);assert.equal(f.errors.length,0);
  await f.resolve(1);assert.deepEqual(calls,[{resizeWidth:585,resizeHeight:695,resizeQuality:'high'},undefined,undefined],'Following frames skip already-rejected resize options');f.player.dispose();
});

test('a browser ignoring ImageBitmap resize options still draws the complete visible image',async()=>{
  let calls=0;
  const f=fixture({nativeDecoder:async blob=>{calls++;return {index:blob.index,width:800,height:950,close(){}};}});
  f.resize({width:390,height:500});await flush();await f.resolve(0);await f.player.ready;
  assert.equal(calls,1);assert.equal(f.readyCalls,1);assert.equal(f.errors.length,0);
  const draw=f.draws.at(-1);assert.equal(draw.index,0);assert.equal(draw.args[2],585);
  assert.ok(Math.abs(draw.args[3]-585*950/800)<1e-9,'Unresized Safari output keeps the full source proportions');f.player.dispose();
});

test('shared 5 Mbps transfers cannot starve cold, forward or reverse mobile gestures',async context=>{
  for(const mode of ['cold','forward','reverse']){
    const f=fixture({manifest:manifestFor(275,{timeline:{...timeline,turns:1},revision:'shared-pipe'}),decodeMs:80,bandwidthMbps:5,cacheResponses:true});
    f.player.render(.2);await flush();const origin=mode==='cold'?0:800;
    if(origin)for(let tick=0;tick<=48;tick++)await f.time(tick*1000/60,80);
    const start=f.draws.length;
    for(let tick=1;tick<=150;tick++){
      const p=mode==='reverse'?(tick<=75?.2+.25*tick/75:.45-.25*(tick-75)/75):.2+.25*tick/150;
      f.player.render(p);await f.time(origin+tick*1000/60,80);
    }
    const gesture=f.draws.slice(start).filter((draw,index,array)=>!index||draw.index!==array[index-1].index);
    // Clocked ImageBitmap jobs and shared body bytes both compete while input
    // keeps moving; cancelled bytes never return to the connection budget.
    assert.ok(gesture.length>=5,mode+' must keep displaying useful completed transfers');
    const stamps=[origin,...gesture.map(draw=>draw.time),origin+2500];
    const maximumGap=Math.max(...stamps.slice(1).map((time,index)=>time-stamps[index]));
    assert.ok(maximumGap<750,mode+' must not freeze for seconds while targets keep changing');
    if(mode==='cold')assert.ok(f.readyCalls>0&&f.draws[0].time<=600,'A moving cold target must not block first readiness');
    const beforeSettleReads=f.cacheReads,finalProgress=mode==='reverse'?.2:.45;f.player.render(finalProgress);
    for(let tick=1;tick<=120;tick++)await f.time(origin+2500+tick*1000/60,80);
    assert.equal(f.draws.at(-1).index,mode==='reverse'?28:141,'The held final target settles exactly');
    assert.ok(f.cacheReads-beforeSettleReads<=64,'A full warm compressed cache must settle with finite speculative work');
    assert.equal(f.errors.length,0);context.diagnostic(mode+': '+gesture.length+' visible changes over shared5Mbps');f.player.dispose();
  }
});

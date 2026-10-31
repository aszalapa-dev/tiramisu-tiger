import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeVideoSequence} from '../native-video-sequence.js';

const tick=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function metadata(count=18,gop=6){return {width:640,height:760,revision:'test1',frames:Array.from({length:count},(_,i)=>i+'.webp'),video:{url:'packed.h264',bytes:count*10,codec:'avc1.42c020',codedWidth:1280,codedHeight:760,packets:Array.from({length:count},(_,i)=>({offset:i*10,size:10,key:i%gop===0,timestamp:i*33333}))}};}

function fixture({manifest=metadata(),deferDecode=false,supported=true,rendererFailure=false,fixedScale=false}={}){
  const requests=[],draws=[],frames=[],decoders=[],errors=[],presents=[],raf=new Map(),readers=[];
  let nextRAF=0,resizeHook,visibilityHook,hiddenHook,hidden=false,readyCount=0,contextLost;
  let size={width:390,height:500};
  const all=new Uint8Array(manifest.video.bytes);for(let i=0;i<manifest.frames.length;i++)all.fill(i,i*10,i*10+10);
  const canvas={width:0,height:0,dataset:{}};
  const view={
    baseURL:'https://site.test/',pixelRatio:3,measure:()=>size,isHidden:()=>hidden,
    observeResize:hook=>{resizeHook=hook;return()=>resizeHook=null;},
    observeVisibility:hook=>{visibilityHook=hook;return()=>visibilityHook=null;},
    onDocumentVisibility:hook=>{hiddenHook=hook;return()=>hiddenHook=null;},
    schedule:callback=>{raf.set(++nextRAF,callback);return nextRAF;},cancel:id=>raf.delete(id),onPresent:i=>presents.push(i),
    isConfigSupported:async()=>({supported}),createChunk:init=>init,
    createRenderer(_canvas,hooks){
      if(rendererFailure)throw new Error('No GPU');contextLost=hooks.onContextLost;
      return {draw(frame,pose){assert.equal(frame.closed,false);draws.push({index:frame.index,pose});},resize(){},dispose(){this.disposed=true;}};
    },
    createDecoder({output,error}){
      const decoder={state:'unconfigured',jobs:[],batches:[],closed:false,configure(config){this.config=config;this.state='configured';},
        decode(chunk){this.jobs.push(chunk);},
        flush(){const jobs=this.jobs.splice(0);return new Promise((resolve,reject)=>{
          const batch={jobs,finish(){for(const chunk of jobs){const frame={index:chunk.data[0],timestamp:chunk.timestamp,closed:false,close(){assert.equal(this.closed,false,'Frame closed twice');this.closed=true;}};frames.push(frame);output(frame);}resolve();},reject};this.batches.push(batch);if(!deferDecode)queueMicrotask(()=>batch.finish());
        });},close(){this.state='closed';this.closed=true;},error};decoders.push(decoder);return decoder;
    },
    fetch:async(url,options={})=>{
      if(url.includes('manifest.json'))return {ok:true,json:async()=>manifest};
      const request={url,options,aborted:false};requests.push(request);
      options.signal?.addEventListener('abort',()=>{request.aborted=true;request.waiter?.reject(new DOMException('aborted','AbortError'));request.reject?.(new DOMException('aborted','AbortError'));});
      if(options.headers?.Range)return new Promise((resolve,reject)=>{request.resolve=resolve;request.reject=reject;});
      return {ok:true,status:200,body:{getReader(){const reader={queue:[],done:false,read(){if(this.queue.length)return Promise.resolve(this.queue.shift());if(this.done)return Promise.resolve({done:true});return new Promise((resolve,reject)=>{request.waiter={resolve,reject};});},cancel(){this.done=true;}};request.reader=reader;readers.push(reader);return reader;}}};
    }
  };
  const player=createNativeVideoSequence({canvas,manifestUrl:'/manifest.json',fixedScale,onReady(){readyCount++;},onError:error=>errors.push(error)},view);player.ready.catch(()=>{});
  const f={player,canvas,requests,draws,frames,decoders,errors,presents,raf,all,
    get readyCount(){return readyCount;},
    async flush(){await tick();const callbacks=[...raf.values()];raf.clear();for(const callback of callbacks)callback();await tick();},
    async feed(start,end){await tick();const request=requests.find(r=>r.reader&&!r.aborted);assert.ok(request,'Stream started');const item={value:all.slice(start,end),done:false};if(request.waiter){request.waiter.resolve(item);request.waiter=null;}else request.reader.queue.push(item);await f.flush();},
    async range(request,{status=206,start,end}={}){assert.ok(request?.resolve,'Priority range pending');const rangeStart=start??Number(/bytes=(\d+)/.exec(request.options.headers.Range)[1]);const rangeEnd=end??Number(/-(\d+)$/.exec(request.options.headers.Range)[1])+1;const data=status===200?all:all.slice(rangeStart,rangeEnd);request.resolve({ok:true,status,headers:{get:name=>name.toLowerCase()==='content-range'?`bytes ${rangeStart}-${rangeStart+data.length-1}/${all.length}`:null},arrayBuffer:async()=>data.buffer});await f.flush();},
    async complete(){const batch=decoders[0]?.batches.find(b=>!b.finished);assert.ok(batch);batch.finished=true;batch.finish();await f.flush();},
    resize(value){size=value;resizeHook?.();},visible(value){visibilityHook?.(value);},hide(value){hidden=value;hiddenHook?.();},lose(){contextLost?.(new Error('lost'));}
  };return f;
}

test('first complete packet paints before the stream completes; no idle RAF or bulk decode',async()=>{
  const f=fixture();await f.feed(0,10);await f.player.ready;
  assert.equal(f.draws.at(-1)?.index,0);assert.equal(f.readyCount,1);assert.equal(f.requests.length,1);
  assert.equal(f.canvas.width,585);assert.equal(f.canvas.height,750);assert.equal(f.raf.size,0);
  assert.equal(f.frames.length,1);f.player.dispose();assert.ok(f.frames.every(frame=>frame.closed));
});

test('random GOP seek decodes preceding key through target and closes intermediate frames',async()=>{
  const f=fixture();await f.feed(0,f.all.length);f.player.render(10/17);await f.flush();
  assert.equal(f.draws.at(-1)?.index,10);const last=f.decoders[0].batches.at(-1);
  assert.deepEqual(last.jobs.map(j=>j.data[0]),[6,7,8,9,10]);assert.equal(last.jobs[0].type,'key');
  assert.ok(f.frames.filter(frame=>!frame.closed).length<=2);f.player.dispose();
});

test('slow batches coalesce newer targets, preserve useful advance, and never paint old reverse output',async()=>{
  const f=fixture({deferDecode:true});await f.feed(0,f.all.length);await f.complete();
  f.player.render(10/17);await tick();f.player.render(11/17);await tick();await f.complete();
  assert.equal(f.draws.at(-1)?.index,10,'Useful late result advances instead of freezing');await f.complete();assert.equal(f.draws.at(-1)?.index,11);
  f.player.render(16/17);await tick();f.player.render(4/17);await tick();await f.complete();
  assert.equal(f.draws.at(-1)?.index,11,'Old forward batch cannot overwrite a reversed request');await f.complete();assert.equal(f.draws.at(-1)?.index,4);
  assert.ok(f.decoders[0].batches.every(b=>b.jobs.length<=6));f.player.dispose();
});

test('one priority range loads an unreceived target GOP without waiting for sequential prefix',async()=>{
  const f=fixture();await f.feed(0,10);f.player.render(10/17);await tick();
  const request=f.requests.find(r=>r.options.headers?.Range);assert.equal(request.options.headers.Range,'bytes=60-119');
  await f.range(request);assert.equal(f.draws.at(-1)?.index,10);assert.equal(f.requests.filter(r=>r.options.headers?.Range).length,1);
  f.player.dispose();assert.ok(f.requests.every(r=>r.aborted));
});

test('a server ignoring Range is interpreted from byte zero and never corrupts cached packets',async()=>{
  const f=fixture();await f.feed(0,10);f.player.render(10/17);await tick();
  await f.range(f.requests.find(r=>r.options.headers?.Range),{status:200});assert.equal(f.draws.at(-1)?.index,10);
  f.player.render(2/17);await f.flush();assert.equal(f.draws.at(-1)?.index,2);f.player.dispose();
});

test('new cold seeks cancel obsolete priority requests and version the shared video URL',async()=>{
  const f=fixture();await f.feed(0,10);f.player.render(10/17);await tick();const old=f.requests.at(-1);
  f.player.render(16/17);await tick();assert.ok(old.aborted);const current=f.requests.at(-1);
  assert.equal(current.options.headers.Range,'bytes=120-179');assert.match(current.url,/v=test1/);assert.equal(current.options.cache,'force-cache');
  await f.range(current);assert.equal(f.draws.at(-1)?.index,16);f.player.dispose();
});

test('resize redraws visible surface while an unreceived seek is pending',async()=>{
  const f=fixture();await f.feed(0,10);f.player.render(10/17);await tick();const before=f.draws.length;
  f.resize({width:400,height:430});assert.equal(f.draws.length,before+1);assert.equal(f.draws.at(-1)?.index,0);assert.equal(f.canvas.height,645);f.player.dispose();
});

test('hidden playback suspends network and drawing; resume restores latest requested pose',async()=>{
  const f=fixture();await f.feed(0,f.all.length);const before=f.draws.length;f.visible(false);f.player.render(10/17);await f.flush();
  assert.equal(f.draws.length,before);assert.ok(f.requests[0].aborted);f.visible(true);await f.flush();assert.equal(f.draws.at(-1)?.index,10);f.player.dispose();
});

test('dispose closes late asynchronous frames without painting or resolving ready',async()=>{
  const f=fixture({deferDecode:true});await f.feed(0,10);f.player.dispose();await f.complete();assert.equal(f.draws.length,0);assert.ok(f.frames.every(frame=>frame.closed));assert.equal(f.readyCount,0);
});

test('unsupported decoder config and unavailable GPU reject readiness for loader fallback',async()=>{
  for(const options of [{supported:false},{rendererFailure:true}]){const f=fixture(options);await assert.rejects(f.player.ready);assert.equal(f.errors.length,1);assert.equal(f.draws.length,0);f.player.dispose();}
});

test('invalid offsets, excessive GOPs and mismatched packed dimensions reject before video transfer',async()=>{
  for(const mutate of [m=>m.video.packets[0].offset=-1,m=>m.video.packets[0].key=false,m=>m.video.packets[6].key=false,m=>m.video.codedWidth=640]){
    const manifest=metadata();mutate(manifest);const f=fixture({manifest});await assert.rejects(f.player.ready);assert.equal(f.requests.length,0);f.player.dispose();
  }
});

test('context loss preserves no stale decoder or frame resources and reports fallback error once',async()=>{
  const f=fixture();await f.feed(0,10);f.lose();f.lose();assert.equal(f.errors.length,1);assert.ok(f.frames.every(frame=>frame.closed));assert.ok(f.decoders[0].closed);assert.ok(f.requests.every(r=>r.aborted));f.player.dispose();
});

test('a cold forward gesture keeps one useful full GOP transfer and paints its late completion',async()=>{
  const f=fixture();await f.feed(0,10);f.player.render(8/17);await tick();const request=f.requests.at(-1);
  assert.equal(request.options.headers.Range,'bytes=60-119');
  for(const index of [9,10,11,12,13]){f.player.render(index/17);await tick();}
  assert.equal(request.aborted,false,'Same-direction movement cannot starve the useful transfer');
  assert.equal(f.requests.filter(r=>r.options.headers?.Range&&!r.aborted).length,1);
  await f.range(request);assert.equal(f.draws.at(-1)?.index,11,'Late complete GOP still moves forward while exact target is absent');
  await f.range(f.requests.at(-1));assert.equal(f.draws.at(-1)?.index,13);f.player.dispose();
});

test('all-IDR assets decode exactly one packet for each arbitrary target',async()=>{
  const f=fixture({manifest:metadata(18,1)});await f.feed(0,f.all.length);
  for(const index of [14,2,17,0]){f.player.render(index/17);await f.flush();assert.equal(f.draws.at(-1)?.index,index);assert.equal(f.decoders[0].batches.at(-1).jobs.length,1);}
  f.player.dispose();
});

test('opening scale and fixed-size dialog use the authored timeline without changing native poses',async()=>{
  for(const fixedScale of [false,true]){
    const manifest=metadata();manifest.timeline={rotationFrames:12,turns:1,rotationEnd:.68,openingStart:.7,openingEnd:.96,openingFrameStep:.05,openingScale:.86,shrinkStart:.62,shrinkEnd:.7};
    const f=fixture({manifest,fixedScale});await f.feed(0,f.all.length);f.player.render(.85);await f.flush();
    assert.equal(f.draws.at(-1)?.index,15);assert.ok(Math.abs(f.draws.at(-1).pose.relativeScale-(fixedScale?1/.86:1))<1e-9);f.player.dispose();
  }
});

test('a truncated stream and malformed Content-Range report loader fallback instead of hanging',async()=>{
  const cold=fixture();await tick();cold.requests[0].waiter.resolve({done:true});await cold.flush();await assert.rejects(cold.player.ready,/incomplet/);assert.equal(cold.errors.length,1);cold.player.dispose();
  const f=fixture();await f.feed(0,10);f.player.render(10/17);await tick();
  f.requests.at(-1).resolve({ok:true,status:206,headers:{get:()=>`bytes 0-59/${f.all.length}`},arrayBuffer:async()=>f.all.slice(0,60).buffer});
  await f.flush();assert.match(f.errors[0]?.message,/Plage vidéo invalide/);assert.ok(f.frames.every(frame=>frame.closed));f.player.dispose();
});

test('unversioned legacy video URLs keep normal cache validation',async()=>{
  const manifest=metadata();delete manifest.revision;const f=fixture({manifest});await f.feed(0,10);
  assert.equal(f.requests[0].options.cache,undefined);assert.equal(new URL(f.requests[0].url).search,'');f.player.dispose();
});

test('a decoder failure reports once and immediately releases the current native surface',async()=>{
  const f=fixture();await f.feed(0,10);f.decoders[0].error(new Error('decode failed'));f.decoders[0].error(new Error('again'));
  assert.equal(f.errors.length,1);assert.ok(f.frames.every(frame=>frame.closed));assert.equal(f.raf.size,0);f.player.dispose();
});

test('resuming after a hidden resize redraws the retained frame even at exactly the same pose',async()=>{
  const f=fixture();await f.feed(0,10);const before=f.draws.length;
  f.visible(false);f.resize({width:400,height:430});await f.flush();assert.equal(f.draws.length,before);
  f.visible(true);await f.flush();assert.equal(f.draws.length,before+1);assert.equal(f.draws.at(-1)?.index,0);
  assert.equal(f.frames.length,1,'Restoring the backing buffer does not decode another frame');f.player.dispose();
});

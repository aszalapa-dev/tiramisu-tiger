import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeVideoSequence} from '../native-video-sequence.js';

const tick=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function metadata(count=18,gop=6){return {width:640,height:760,revision:'test1',frames:Array.from({length:count},(_,i)=>i+'.webp'),video:{url:'packed.h264',bytes:count*10,codec:'avc1.42c020',codedWidth:1280,codedHeight:760,packets:Array.from({length:count},(_,i)=>({offset:i*10,size:10,key:i%gop===0,timestamp:i*33333}))}};}

function fixture({manifest=metadata(),deferDecode=false,supported=true,rendererFailure=false,fixedScale=false,referenceElement,referenceSize,realRenderer=false,size:initialSize,onLayout}={}){
  const requests=[],draws=[],frames=[],decoders=[],errors=[],presents=[],raf=new Map(),readers=[];
  let nextRAF=0,resizeHook,visibilityHook,hiddenHook,hidden=false,readyCount=0,contextLost;
  let size=initialSize||{width:390,height:500};
  const all=new Uint8Array(manifest.video.bytes);for(let i=0;i<manifest.frames.length;i++)all.fill(i,i*10,i*10+10);
  const uniforms={},gpu={NO_ERROR:0,getError:()=>0,isContextLost:()=>false,getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:(_program,name)=>name};
  for(const name of ['createShader','createProgram','createBuffer','createTexture'])gpu[name]=()=>({});
  for(const name of ['shaderSource','compileShader','deleteShader','attachShader','linkProgram','deleteProgram','bindBuffer','bufferData','useProgram','enableVertexAttribArray','vertexAttribPointer','activeTexture','bindTexture','texParameteri','uniform1i','disable','enable','blendFunc','clearColor','viewport','pixelStorei','clear','deleteTexture','deleteBuffer'])gpu[name]=()=>{};
  let uploaded;
  gpu.uniform2f=(name,x,y)=>{uniforms[name]=[x,y];};gpu.texImage2D=(...args)=>{uploaded=args.at(-1);};gpu.drawArrays=()=>draws.push({index:uploaded.index,uniforms:{...uniforms}});
  const canvas={width:0,height:0,dataset:{},getContext:()=>gpu,addEventListener(){},removeEventListener(){},parentElement:{clientWidth:12,clientHeight:12}};
  const view={
    baseURL:'https://site.test/',pixelRatio:3,measure:()=>size,isHidden:()=>hidden,
    observeResize:hook=>{resizeHook=hook;return()=>resizeHook=null;},
    observeVisibility:hook=>{visibilityHook=hook;return()=>visibilityHook=null;},
    onDocumentVisibility:hook=>{hiddenHook=hook;return()=>hiddenHook=null;},
    schedule:callback=>{raf.set(++nextRAF,callback);return nextRAF;},cancel:id=>raf.delete(id),onPresent:i=>presents.push(i),
    isConfigSupported:async config=>({supported:typeof supported==='function'?supported(config):supported}),createChunk:init=>init,
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
  if(realRenderer)delete view.createRenderer;
  if(referenceSize)view.measureReference=()=>referenceSize;
  const player=createNativeVideoSequence({canvas,manifestUrl:'/manifest.json',fixedScale,referenceElement,onLayout,onReady(){readyCount++;},onError:error=>errors.push(error)},view);player.ready.catch(()=>{});
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

const overscanMetadata=()=>{const m=metadata();m.layout={width:640,height:760,top:760};m.height=1520;m.video.codedHeight=1520;return m;};
const projectedY=(f,v)=>{const uniforms=f.draws.at(-1).uniforms;return -((1-2*v)*uniforms.fit[1]+(uniforms.offset?.[1]||0))*f.canvas.height/2;};

test('extended raster preserves original body size and center while revealing space above it',async()=>{
  const old=fixture({realRenderer:true});await old.feed(0,10);
  const referenceElement={getBoundingClientRect:()=>({width:390,height:500})};
  const f=fixture({manifest:overscanMetadata(),realRenderer:true,referenceElement,size:{width:390,height:844}});await f.feed(0,10);
  assert.equal(f.canvas.height,1266,'Backing buffer follows the larger presentation canvas');
  for(const originalY of [0,.5,1])assert.ok(Math.abs(projectedY(f,.5+originalY*.5)-projectedY(old,originalY))<1e-9,'Original lower-half image keeps its exact body projection');
  assert.ok(projectedY(f,.35)<projectedY(f,.5),'Additional top raster can display the detached lid above the old image edge');
  assert.ok(projectedY(f,.35)>-f.canvas.height/2,'Its extra upper space lies inside the expanded canvas');
  assert.equal(f.decoders[0].config.codedHeight,1520);old.player.dispose();f.player.dispose();
});

test('reference-only size changes redraw the retained overscan frame without another decode',async()=>{
  const rect={width:390,height:500},referenceElement={getBoundingClientRect:()=>rect},f=fixture({manifest:overscanMetadata(),realRenderer:true,referenceElement,size:{width:390,height:844}});
  await f.feed(0,10);const before=f.draws.length,oldFit=f.draws.at(-1).uniforms.fit[0];
  rect.width=300;f.resize({width:390,height:844});
  assert.equal(f.draws.length,before+1);assert.ok(f.draws.at(-1).uniforms.fit[0]<oldFit);assert.equal(f.frames.length,1);f.player.dispose();
});

test('standalone legacy canvases ignore their parent size and keep the original centered fit',async()=>{
  const f=fixture({realRenderer:true});await f.feed(0,10);const uniforms=f.draws.at(-1).uniforms;
  assert.equal(uniforms.fit[0],1);assert.ok(Math.abs(uniforms.fit[1]-760*(585/640)/750)<1e-9);assert.ok(Math.abs(projectedY(f,.5))<1e-9);f.player.dispose();
});

test('layout validation and unsupported tall decode dimensions reject before video transfer',async()=>{
  for(const mutate of [m=>m.layout.width=639,m=>m.layout.top=-1,m=>m.layout.height=761,m=>m.layout.top=NaN]){
    const manifest=overscanMetadata();mutate(manifest);const f=fixture({manifest});await tick();assert.equal(f.requests.length,0,'Invalid layout must stop before transferring the video');await assert.rejects(f.player.ready);f.player.dispose();
  }
  const f=fixture({manifest:overscanMetadata(),supported:config=>config.codedHeight<=1000});await assert.rejects(f.player.ready,/Format vidéo natif/);assert.equal(f.requests.length,0);f.player.dispose();
});

test('transformed poster bounds determine physical can scale and shifted center inside the large canvas',async()=>{
  const canvasRect={width:351,height:759.6,left:10,top:20};
  const referenceSize={width:287.82,height:369,left:41.59,top:235.1};
  const f=fixture({manifest:overscanMetadata(),realRenderer:true,referenceSize,size:canvasRect});await f.feed(0,10);
  const xRatio=f.canvas.width/canvasRect.width,yRatio=f.canvas.height/canvasRect.height;
  const expectedWidth=referenceSize.width*xRatio,expectedScale=Math.min(expectedWidth/640,referenceSize.height*yRatio/760);
  const uniforms=f.draws.at(-1).uniforms;
  assert.ok(Math.abs(uniforms.fit[0]*f.canvas.width-640*expectedScale)<1e-9);
  const centerDeltaY=(referenceSize.top+referenceSize.height/2-canvasRect.top-canvasRect.height/2)*yRatio;
  assert.ok(Math.abs(projectedY(f,.75)-centerDeltaY)<1e-9,'Original body center follows the translated poster');
  const centerDeltaX=(referenceSize.left+referenceSize.width/2-canvasRect.left-canvasRect.width/2)*xRatio;
  assert.ok(Math.abs(uniforms.offset[0]*f.canvas.width/2-centerDeltaX)<1e-9);f.player.dispose();
});

test('layout callback expands the canvas before final reference measurement and first draw',async()=>{
  const size={width:390,height:500},seen=[];
  const f=fixture({manifest:overscanMetadata(),realRenderer:true,referenceSize:{width:390,height:500},size,onLayout(layout){seen.push(layout);size.height=844;}});
  await f.feed(0,10);assert.equal(seen.length,1);assert.equal(seen[0].top,760);assert.equal(f.canvas.height,1266);
  assert.ok(Math.abs(projectedY(f,.75))<1e-9);f.player.dispose();
});

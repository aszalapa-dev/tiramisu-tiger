import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeVideoSequence} from '../native-video-sequence.js';
const flush=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));};

async function scenario({reverse=false,from=.2}={}){
  const timeline={rotationFrames:180,turns:1,rotationEnd:.68,openingStart:.7,openingEnd:.96,openingFrameStep:1/360,openingScale:.86,shrinkStart:.62,shrinkEnd:.7};
  let offset=0;
  const packets=Array.from({length:275},(_,i)=>{const size=i%6===0?36000:12000;const packet={offset,size,key:i%6===0,timestamp:i*33333};offset+=size;return packet;});
  const manifest={width:640,height:760,revision:'network1',frames:packets.map((_,i)=>i+'.webp'),timeline,video:{url:'packed.h264',bytes:offset,codec:'avc1.42c020',codedWidth:1280,codedHeight:760,packets}};
  const bytes=new Uint8Array(offset);packets.forEach((packet,index)=>{bytes[packet.offset]=index&255;bytes[packet.offset+1]=index>>8;});
  const network=[],outputs=[],draws=[],rafs=new Map(),errors=[],frames=[];
  let clock=0,nextRAF=0,firstPaint=null,sent=0,maxAlive=0,maxBatch=0;
  const canvas={width:0,height:0,dataset:{}};
  const environment={baseURL:'https://site.test/',pixelRatio:1.5,measure:()=>({width:390,height:500}),isHidden:()=>false,
    observeResize:()=>()=>{},observeVisibility:()=>()=>{},onDocumentVisibility:()=>()=>{},
    schedule:callback=>{rafs.set(++nextRAF,callback);return nextRAF;},cancel:id=>rafs.delete(id),
    createRenderer:()=>({resize(){},dispose(){},draw(frame){draws.push({index:frame.index,time:clock});if(firstPaint===null)firstPaint=clock;}}),
    isConfigSupported:async()=>({supported:true}),createChunk:init=>init,
    createDecoder({output}){let jobs=[];return {state:'configured',configure(){},close(){this.state='closed';},decode(chunk){jobs.push(chunk);},flush(){
      const batch=jobs;jobs=[];maxBatch=Math.max(maxBatch,batch.length);
      return new Promise(resolve=>{batch.forEach((chunk,index)=>outputs.push({due:clock+(index+1)*4,done:false,finish(){
        this.done=true;const frame={index:chunk.data[0]+chunk.data[1]*256,timestamp:chunk.timestamp,closed:false,close(){assert.equal(this.closed,false);this.closed=true;}};frames.push(frame);output(frame);maxAlive=Math.max(maxAlive,frames.filter(f=>!f.closed).length);if(index===batch.length-1)resolve();
      }}));});
    }};},
    fetch:async(url,options={})=>{
      if(url.includes('manifest.json'))return {ok:true,json:async()=>manifest};
      const match=/bytes=(\d+)-(\d+)/.exec(options.headers?.Range||'');
      const start=match?Number(match[1]):0,end=match?Number(match[2])+1:bytes.length;
      const job={start,end,sent:start,emitted:start,eligible:clock+80,aborted:false,queue:[],waiter:null,finished:false};network.push(job);
      function deliver(item){if(job.waiter){const waiter=job.waiter;job.waiter=null;waiter.resolve(item);}else job.queue.push(item);}
      job.progress=()=>{while(job.sent-job.emitted>=16384||job.sent>=end&&job.emitted<end){const next=Math.min(end,job.emitted+16384);deliver({done:false,value:bytes.slice(job.emitted,next)});job.emitted=next;}if(job.sent>=end&&!job.finished){job.finished=true;deliver({done:true});}};
      options.signal?.addEventListener('abort',()=>{job.aborted=true;if(job.waiter){job.waiter.reject(new DOMException('aborted','AbortError'));job.waiter=null;}});
      return {ok:true,status:match?206:200,headers:{get:()=>`bytes ${start}-${end-1}/${bytes.length}`},body:{getReader:()=>({read(){if(job.queue.length)return Promise.resolve(job.queue.shift());if(job.aborted)return Promise.reject(new DOMException('aborted','AbortError'));return new Promise((resolve,reject)=>{job.waiter={resolve,reject};});},cancel(){job.aborted=true;return Promise.resolve();}})}};
    }
  };
  const player=createNativeVideoSequence({canvas,manifestUrl:'/manifest.json',onError:error=>errors.push(error)},environment);player.ready.catch(()=>{});player.render(from);await flush();
  async function advance(target){
    while(clock<target-1e-6){
      const next=Math.min(target,clock+1),active=network.filter(job=>!job.aborted&&!job.finished&&job.eligible<=clock);
      const share=active.length?5e6/8/1000*(next-clock)/active.length:0;clock=next;let changed=false;
      for(const job of active){const amount=Math.min(share,job.end-job.sent);job.sent+=amount;sent+=amount;const previous=job.emitted;job.progress();if(job.emitted!==previous||job.finished)changed=true;}
      for(const output of outputs)if(!output.done&&output.due<=clock){output.finish();changed=true;}
      if(changed)await flush();
    }
    const pending=[...rafs.values()];rafs.clear();for(const callback of pending)callback();await flush();
  }
  for(let tick=1;tick<=150;tick++){
    const progress=reverse?(tick<=75?.2+.25*tick/75:.45-.25*(tick-75)/75):from+(.45-from)*tick/150;
    player.render(progress);await advance(tick*1000/60);
  }
  const changes=draws.filter((draw,index,array)=>!index||draw.index!==array[index-1].index),times=[0,...changes.map(d=>d.time),2500];
  const maxGap=Math.max(...times.slice(1).map((time,index)=>time-times[index]));
  const moving=changes.length;
  player.render(reverse?.2:.45);for(let tick=151;tick<=300;tick++)await advance(tick*1000/60);
  assert.equal(draws.at(-1)?.index,reverse?28:141,'Latest exact target must be reached after settling');
  assert.equal(errors.length,0);assert.ok(maxAlive<=2,'Retained GPU surfaces stay bounded');assert.ok(maxBatch<=6);
  assert.ok(firstPaint<600,'Cold playback should start without waiting for the full stream');
  assert.ok(moving>=8,'A continuous gesture must not starve every in-flight body');assert.ok(maxGap<750,'No seconds-long network starvation');
  if(!reverse)assert.ok(changes.every((draw,index)=>index===0||draw.index>=changes[index-1].index),'Late outputs must never reverse monotonic forward motion');
  const result={reverse,from,firstPaintMs:Math.round(firstPaint),changes:moving,maxGapMs:Math.round(maxGap),finalIndex:draws.at(-1)?.index,sentBytes:Math.round(sent),maxAlive,maxBatch};
  player.dispose();assert.ok(frames.every(frame=>frame.closed));assert.equal(rafs.size,0);return result;
}

test('shared 5 Mbps, RTT80 ms: cold forward and reverse stay live and settle exactly',async context=>{
  for(const options of [{from:0},{from:.2},{reverse:true}])context.diagnostic(JSON.stringify(await scenario(options)));
});

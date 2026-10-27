import {createSequenceTimeline} from './sequence-timeline.js?v=smooth-27';

// Keep compressed lookahead separate from the small decoded image window.
export function createRenderedSequence({canvas,manifestUrl,onReady=()=>{},onError=()=>{},cacheLimit,fixedScale=false},environment={}){
  const view=canvas.ownerDocument?.defaultView||globalThis,doc=canvas.ownerDocument;
  const compact=environment.compact??((view.innerWidth||1024)<=760||
    ((view.innerWidth||1024)<=1024&&view.matchMedia?.('(pointer: coarse)').matches));
  const capacity=Math.max(3,Math.floor(cacheLimit||(compact?6:20)));
  const blobCapacity=32,density=Math.min(environment.pixelRatio??view.devicePixelRatio??1,1.5);
  const fetchFile=environment.fetch||view.fetch.bind(view),decode=environment.decode||decodeFrame;
  const measure=environment.measure||(()=>canvas.getBoundingClientRect());
  const isHidden=environment.isHidden||(()=>Boolean(doc?.hidden));
  const schedule=environment.schedule||(view.requestAnimationFrame?view.requestAnimationFrame.bind(view):callback=>setTimeout(callback,0));
  const cancel=environment.cancel||(view.cancelAnimationFrame?view.cancelAnimationFrame.bind(view):clearTimeout);
  const manifestURL=new URL(manifestUrl,environment.baseURL||doc?.baseURI||view.location?.href);
  const context=canvas.getContext('2d',{alpha:true});
  if(!context)throw new Error('Le navigateur ne peut pas afficher cette animation.');
  const manifestController=new AbortController();
  const blobs=new Map(),bitmaps=new Map(),fetches=new Map(),decodes=new Map(),failedFrames=new Set();
  let frames=[],timeline,pose,progress=0,direction=1,width=1,height=1,versioned=false;
  let fetchWanted=[],decodeWanted=[],visible=true,disposed=false,failed=false,settled=false;
  let frame=null,painted=-1,paintedKey='',lastCoordinate=null,resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});

  function canShow(){return !disposed&&!failed&&visible&&!isHidden();}
  function release(bitmap){bitmap.close?.();}
  function touch(cache,index){const item=cache.get(index);cache.delete(index);cache.set(index,item);return item;}
  function trim(cache,limit,wanted,close){
    while(cache.size>limit){
      const eligible=index=>index!==pose.index&&(cache!==bitmaps||index!==painted);
      const victim=[...cache.keys()].find(index=>eligible(index)&&!wanted.includes(index))??[...cache.keys()].find(eligible);
      if(victim===undefined)break;
      if(close)release(cache.get(victim));cache.delete(victim);
    }
  }
  function cancelPaint(){if(frame!==null){cancel(frame);frame=null;}}
  function requestPaint(){if(canShow()&&bitmaps.size&&frame===null)frame=schedule(()=>{frame=null;paint();});}
  function paint(){
    if(!canShow()||!pose||!bitmaps.size)return;
    const targetCoordinate=timeline.frameCoordinate(pose.index,pose);
    let nearest=-1,distance=Infinity,coordinate;
    for(const index of bitmaps.keys()){
      const candidate=timeline.frameCoordinate(index,pose);
      // Delayed work must neither run backwards nor overshoot then snap back.
      if(direction>0&&(candidate>targetCoordinate||lastCoordinate!==null&&candidate<lastCoordinate))continue;
      if(direction<0&&(candidate<targetCoordinate||lastCoordinate!==null&&candidate>lastCoordinate))continue;
      const delta=Math.abs(candidate-targetCoordinate);
      if(delta<distance||delta===distance&&index===pose.index){nearest=index;distance=delta;coordinate=candidate;}
    }
    if(nearest<0||!settled&&nearest!==pose.index)return;
    const bitmap=touch(bitmaps,nearest),relativeScale=(fixedScale?1:pose.scale)/timeline.frameScale(nearest);
    const key=[nearest,relativeScale,canvas.width,canvas.height].join('/');
    if(key===paintedKey){lastCoordinate=coordinate;return;}
    const scale=Math.min(canvas.width/width,canvas.height/height)*relativeScale;
    const drawWidth=width*scale,drawHeight=height*scale;
    context.clearRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,(canvas.width-drawWidth)/2,(canvas.height-drawHeight)/2,drawWidth,drawHeight);
    painted=nearest;paintedKey=key;lastCoordinate=coordinate;
    if(!settled){settled=true;resolveReady({frameCount:frames.length,width,height});onReady();}
    pumpDecode();pumpFetch();
  }
  function resize(){
    if(disposed)return;
    const rect=measure(),nextWidth=Math.max(1,Math.round(rect.width*density)),nextHeight=Math.max(1,Math.round(rect.height*density));
    if(canvas.width!==nextWidth||canvas.height!==nextHeight){canvas.width=nextWidth;canvas.height=nextHeight;paintedKey='';requestPaint();}
  }
  function abortFetch(index){const job=fetches.get(index);if(job){job.cancelled=true;fetches.delete(index);job.controller.abort();}}
  function fail(error){
    if(disposed||failed)return;
    failed=true;cancelPaint();for(const index of [...fetches.keys()])abortFetch(index);
    for(const bitmap of bitmaps.values())release(bitmap);bitmaps.clear();blobs.clear();
    if(!settled){settled=true;rejectReady(error);}onError(error);
  }
  function pumpDecode(){
    if(!canShow())return;
    while(decodes.size<(compact?1:2)){
      const index=decodeWanted.find(index=>blobs.has(index)&&!bitmaps.has(index)&&!decodes.has(index)&&!failedFrames.has(index));
      if(index===undefined)break;
      // Keep the displayed bitmap alive during a seek without repeatedly
      // decoding and evicting the last neighbour before RAF can draw the target.
      const hasSpareVictim=[...bitmaps.keys()].some(index=>index!==painted&&index!==pose.index&&!decodeWanted.includes(index));
      if(bitmaps.size>=capacity&&!hasSpareVictim&&index!==pose.index)break;
      const job={},blob=touch(blobs,index);decodes.set(index,job);
      Promise.resolve().then(()=>decode(blob))
        .then(bitmap=>{
          if(disposed||failed||!decodeWanted.includes(index)){release(bitmap);return;}
          bitmaps.set(index,bitmap);trim(bitmaps,capacity,decodeWanted,true);requestPaint();
        })
        .catch(error=>{if(!disposed&&!failed){failedFrames.add(index);blobs.delete(index);if(index===pose.index)fail(error);}})
        .finally(()=>{if(decodes.get(index)===job)decodes.delete(index);pumpDecode();});
    }
  }
  function pumpFetch(){
    if(!canShow()||!frames.length)return;
    while(fetches.size<(settled?4:2)){
      const index=fetchWanted.find(index=>!blobs.has(index)&&!fetches.has(index)&&!failedFrames.has(index));
      if(index===undefined)break;
      const job={controller:new AbortController(),cancelled:false};fetches.set(index,job);
      fetchFile(frames[index],{signal:job.controller.signal,...(versioned?{cache:'force-cache'}:{})})
        .then(response=>{if(!response.ok)throw new Error('Image de l’animation indisponible ('+response.status+').');return response.blob?response.blob():response;})
        .then(blob=>{if(!disposed&&!failed&&!job.cancelled){blobs.set(index,blob);trim(blobs,blobCapacity,fetchWanted,false);pumpDecode();}})
        .catch(error=>{if(!disposed&&!failed&&!job.cancelled&&error.name!=='AbortError'){failedFrames.add(index);if(index===pose.index)fail(error);}})
        .finally(()=>{if(fetches.get(index)===job)fetches.delete(index);pumpFetch();});
    }
  }
  function plan(previous){
    fetchWanted=timeline.neighbours(pose,direction,blobCapacity,{ahead:24,behind:7});
    decodeWanted=timeline.neighbours(pose,direction,capacity);
    const large=previous&&(previous.segment!==pose.segment||timeline.distance(previous.index,pose.index)>6);
    for(const index of [...fetches.keys()])if(!fetchWanted.includes(index)||(large&&!fetchWanted.slice(0,4).includes(index)))abortFetch(index);
    // A slow speculative request never holds both slots ahead of a new target.
    if(canShow()&&!blobs.has(pose.index)&&!fetches.has(pose.index)&&fetches.size>=(settled?4:2)){
      const victim=[...fetches.keys()].sort((a,b)=>fetchWanted.indexOf(b)-fetchWanted.indexOf(a))[0];abortFetch(victim);
    }
    pumpDecode();pumpFetch();requestPaint();
  }
  function render(value){
    if(disposed||failed)return;
    const nextProgress=Math.min(1,Math.max(0,Number.isFinite(value)?value:0));
    const previous=pose,previousProgress=progress,previousDirection=direction;progress=nextProgress;
    if(!timeline)return;
    pose=timeline.pose(progress);
    if(progress!==previousProgress)direction=progress>previousProgress?1:-1;
    if(previous&&pose.segment==='rotation'&&previous.segment==='rotation'&&pose.index!==previous.index&&timeline.distance(previous.index,pose.index)<=timeline.loopFrames/4){
      let delta=pose.index-previous.index;if(Math.abs(delta)>timeline.loopFrames/2)delta-=Math.sign(delta)*timeline.loopFrames;direction=Math.sign(delta);
    }
    if(direction!==previousDirection||Math.abs(progress-previousProgress)>.10)lastCoordinate=null;
    if(!previous||pose.index!==previous.index)failedFrames.delete(pose.index);
    plan(previous);
  }
  function visibilityChanged(){if(!canShow()){cancelPaint();return;}resize();if(pose)plan();}
  const unobserveResize=environment.observeResize?environment.observeResize(resize):observeResize();
  const unobserveVisibility=environment.observeVisibility?environment.observeVisibility(value=>{visible=value;visibilityChanged();}):observeVisibility();
  const unlistenDocument=environment.onDocumentVisibility?environment.onDocumentVisibility(visibilityChanged):listenDocument();
  resize();
  fetchFile(manifestURL.href,{signal:manifestController.signal})
    .then(response=>{if(!response.ok)throw new Error('Le manifeste de l’animation est indisponible.');return response.json();})
    .then(manifest=>{
      if(disposed)return;
      if(!Number.isFinite(manifest.width)||manifest.width<=0||!Number.isFinite(manifest.height)||manifest.height<=0||!Array.isArray(manifest.frames)||!manifest.frames.length||manifest.frames.some(frame=>typeof frame!=='string'||!frame))throw new Error('Le manifeste de la séquence est invalide.');
      width=manifest.width;height=manifest.height;timeline=createSequenceTimeline(manifest);
      versioned=typeof manifest.revision==='string'&&manifest.revision.length>0;
      frames=manifest.frames.map(frame=>{const url=new URL(frame,manifestURL);if(versioned)url.searchParams.set('v',manifest.revision);return url.href;});render(progress);
    }).catch(error=>{if(!disposed&&error.name!=='AbortError')fail(error);});
  function dispose(){
    if(disposed)return;
    disposed=true;manifestController.abort();cancelPaint();for(const index of [...fetches.keys()])abortFetch(index);
    unobserveResize?.();unobserveVisibility?.();unlistenDocument?.();for(const bitmap of bitmaps.values())release(bitmap);bitmaps.clear();blobs.clear();
    if(!settled){settled=true;rejectReady(new DOMException('Animation fermée.','AbortError'));}
  }
  function observeResize(){
    if(view.ResizeObserver){const observer=new view.ResizeObserver(resize);observer.observe(canvas);return()=>observer.disconnect();}
    view.addEventListener?.('resize',resize);return()=>view.removeEventListener?.('resize',resize);
  }
  function observeVisibility(){
    if(!view.IntersectionObserver)return()=>{};
    const observer=new view.IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);visibilityChanged();},{rootMargin:'80px'});observer.observe(canvas);return()=>observer.disconnect();
  }
  function listenDocument(){doc?.addEventListener('visibilitychange',visibilityChanged);return()=>doc?.removeEventListener('visibilitychange',visibilityChanged);}
  async function decodeFrame(blob){
    if(view.createImageBitmap)return view.createImageBitmap(blob);
    const url=view.URL.createObjectURL(blob),image=new view.Image();
    try{
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Image de l’animation illisible.'));image.src=url;});image.close=()=>view.URL.revokeObjectURL(url);return image;
    }catch(error){view.URL.revokeObjectURL(url);throw error;}
  }
  return {ready,render,dispose};
}

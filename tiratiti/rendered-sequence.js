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
  let frames=[],timeline,pose,progress=0,direction=1,width=1,height=1,versioned=false,bitmapResizeSupported=true;
  let fetchWanted=[],decodeWanted=[],visible=true,disposed=false,failed=false,settled=false;
  let frame=null,painted=-1,pendingPaint=-1,blobCandidate=-1,paintedKey='',lastCoordinate=null,lastRelativeScale=1,needsRestore=false,motionEpoch=0,fetchOrder=0,resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});

  function canShow(){return !disposed&&!failed&&visible&&!isHidden();}
  function release(bitmap){bitmap.close?.();}
  function touch(cache,index){const item=cache.get(index);cache.delete(index);cache.set(index,item);return item;}
  function trim(cache,limit,wanted,close){
    while(cache.size>limit){
      const eligible=index=>index!==pose.index&&(cache===blobs?index!==blobCandidate:index!==painted&&index!==pendingPaint);
      const victim=[...cache.keys()].find(index=>eligible(index)&&!wanted.includes(index))??[...cache.keys()].find(eligible);
      if(victim===undefined)break;
      if(close)release(cache.get(victim));cache.delete(victim);
    }
  }
  function cancelPaint(){if(frame!==null){cancel(frame);frame=null;}}
  function requestPaint(){if(canShow()&&bitmaps.size&&frame===null)frame=schedule(()=>{frame=null;paint();});}
  function drawBitmap(bitmap,relativeScale){
    const scale=Math.min(canvas.width/width,canvas.height/height)*relativeScale;
    const drawWidth=width*scale,drawHeight=height*scale;
    context.clearRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,(canvas.width-drawWidth)/2,(canvas.height-drawHeight)/2,drawWidth,drawHeight);
  }
  function restoreVisibleFrame(){
    if(!needsRestore||!canShow()||!bitmaps.has(painted))return;
    // Resize clears the backing buffer. Restore its visible frame immediately,
    // even when the latest scroll target is still loading or decoding.
    drawBitmap(bitmaps.get(painted),lastRelativeScale);
    paintedKey=[painted,lastRelativeScale,canvas.width,canvas.height].join('/');needsRestore=false;
  }
  function usefulCompletedFrame(index){
    const candidate=timeline.frameCoordinate(index,pose),target=timeline.frameCoordinate(pose.index,pose);
    return direction>0?candidate<=target&&(lastCoordinate===null||candidate>=lastCoordinate):
      candidate>=target&&(lastCoordinate===null||candidate<=lastCoordinate);
  }
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
    if(nearest<0)return;
    const bitmap=touch(bitmaps,nearest),relativeScale=(fixedScale?1:pose.scale)/timeline.frameScale(nearest);
    const key=[nearest,relativeScale,canvas.width,canvas.height].join('/');
    if(key===paintedKey){lastCoordinate=coordinate;pendingPaint=-1;return;}
    drawBitmap(bitmap,relativeScale);
    painted=nearest;paintedKey=key;lastCoordinate=coordinate;lastRelativeScale=relativeScale;pendingPaint=-1;needsRestore=false;
    if(!settled){settled=true;resolveReady({frameCount:frames.length,width,height});onReady();}
    pumpDecode();pumpFetch();
  }
  function resize(){
    if(disposed)return;
    const rect=measure(),nextWidth=Math.max(1,Math.round(rect.width*density)),nextHeight=Math.max(1,Math.round(rect.height*density));
    if(canvas.width!==nextWidth||canvas.height!==nextHeight){canvas.width=nextWidth;canvas.height=nextHeight;paintedKey='';needsRestore=true;}
    restoreVisibleFrame();requestPaint();
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
    if(blobCandidate>=0&&(!blobs.has(blobCandidate)||bitmaps.has(blobCandidate)||decodes.has(blobCandidate)||!usefulCompletedFrame(blobCandidate)))blobCandidate=-1;
    while(decodes.size<(compact?1:2)){
      const canDecode=index=>blobs.has(index)&&!bitmaps.has(index)&&!decodes.has(index)&&!failedFrames.has(index);
      const usefulCandidate=blobCandidate>=0&&canDecode(blobCandidate)&&usefulCompletedFrame(blobCandidate);
      const index=canDecode(pose.index)?pose.index:usefulCandidate?blobCandidate:decodeWanted.find(canDecode);
      if(index===undefined)break;
      // Keep the displayed bitmap alive during a seek without repeatedly
      // decoding and evicting the last neighbour before RAF can draw the target.
      const hasSpareVictim=[...bitmaps.keys()].some(index=>index!==painted&&index!==pendingPaint&&index!==pose.index&&!decodeWanted.includes(index));
      if(bitmaps.size>=capacity&&!hasSpareVictim&&index!==pose.index&&index!==blobCandidate)break;
      const job={epoch:motionEpoch},blob=touch(blobs,index);decodes.set(index,job);
      if(index===blobCandidate)blobCandidate=-1;
      // Decode no more pixels than this compact display can physically show.
      const fit=Math.min(1,canvas.width/width,canvas.height/height);
      const decodeOptions=compact&&fit<1?{resizeWidth:Math.max(1,Math.ceil(width*fit)),resizeHeight:Math.max(1,Math.ceil(height*fit)),resizeQuality:'high'}:undefined;
      Promise.resolve().then(()=>decode(blob,decodeOptions))
        .then(bitmap=>{
          const useful=!disposed&&!failed&&job.epoch===motionEpoch&&usefulCompletedFrame(index);
          if(disposed||failed||!decodeWanted.includes(index)&&!useful){release(bitmap);return;}
          // A slower phone can finish several poses behind the moving window.
          // Keep forward progress rather than throwing every completed job away.
          if(useful)pendingPaint=index;
          bitmaps.set(index,bitmap);trim(bitmaps,capacity,decodeWanted,true);requestPaint();
        })
        .catch(error=>{if(!disposed&&!failed){failedFrames.add(index);blobs.delete(index);if(index===pose.index)fail(error);}})
        .finally(()=>{if(decodes.get(index)===job)decodes.delete(index);pumpDecode();});
    }
  }
  function pumpFetch(){
    if(!canShow()||!frames.length)return;
    while(fetches.size<(compact?2:settled?4:2)){
      const index=fetchWanted.find(index=>!blobs.has(index)&&!fetches.has(index)&&!failedFrames.has(index));
      if(index===undefined)break;
      // A protected completed body may temporarily occupy one lookahead slot.
      // Wait for its decode instead of cycling other already-cached neighbours.
      const hasSpareBlob=[...blobs.keys()].some(index=>index!==pose.index&&index!==blobCandidate&&!fetchWanted.includes(index));
      if(blobs.size>=blobCapacity&&!hasSpareBlob&&index!==pose.index)break;
      const job={controller:new AbortController(),cancelled:false,epoch:motionEpoch,order:++fetchOrder};fetches.set(index,job);
      fetchFile(frames[index],{signal:job.controller.signal,...(versioned?{cache:'force-cache'}:{})})
        .then(response=>{if(!response.ok)throw new Error('Image de l’animation indisponible ('+response.status+').');return response.blob?response.blob():response;})
        .then(blob=>{
          if(disposed||failed||job.cancelled)return;
          if(job.epoch===motionEpoch&&usefulCompletedFrame(index)){
            const currentUseful=blobCandidate>=0&&blobs.has(blobCandidate)&&usefulCompletedFrame(blobCandidate);
            if(!currentUseful||timeline.distance(index,pose.index)<timeline.distance(blobCandidate,pose.index))blobCandidate=index;
          }
          blobs.set(index,blob);trim(blobs,blobCapacity,fetchWanted,false);pumpDecode();
        })
        .catch(error=>{if(!disposed&&!failed&&!job.cancelled&&error.name!=='AbortError'){failedFrames.add(index);if(index===pose.index)fail(error);}})
        .finally(()=>{if(fetches.get(index)===job)fetches.delete(index);pumpFetch();});
    }
  }
  function plan(previous){
    fetchWanted=timeline.neighbours(pose,direction,blobCapacity,{ahead:24,behind:7});
    decodeWanted=timeline.neighbours(pose,direction,capacity);
    const large=previous&&(previous.segment!==pose.segment||timeline.distance(previous.index,pose.index)>6);
    // Let one useful body finish on a shared connection instead of repeatedly
    // cancelling the most advanced transfer each time a finger passes a frame.
    const targetCoordinate=timeline.frameCoordinate(pose.index,pose);
    const protectedTransfer=[...fetches.entries()].filter(([index,job])=>{
      if(large||job.epoch!==motionEpoch)return false;
      const coordinate=timeline.frameCoordinate(index,pose);
      return direction>0?coordinate<=targetCoordinate+24&&(lastCoordinate===null||coordinate>=lastCoordinate):
        coordinate>=targetCoordinate-24&&(lastCoordinate===null||coordinate<=lastCoordinate);
    }).sort((a,b)=>a[1].order-b[1].order)[0]?.[0];
    for(const index of [...fetches.keys()]){
      if(index===protectedTransfer)continue;
      const job=fetches.get(index);
      if(!fetchWanted.includes(index)||job.epoch!==motionEpoch&&index!==pose.index||(large&&!fetchWanted.slice(0,4).includes(index)))abortFetch(index);
    }
    // The remaining lane follows the latest target while the protected lane
    // guarantees that continuous movement cannot starve every image body.
    if(canShow()&&!blobs.has(pose.index)&&!fetches.has(pose.index)&&fetches.size>=(compact?2:settled?4:2)){
      const victim=[...fetches.keys()].filter(index=>index!==protectedTransfer).sort((a,b)=>fetchWanted.indexOf(b)-fetchWanted.indexOf(a))[0];
      if(victim!==undefined)abortFetch(victim);
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
    if(direction!==previousDirection||Math.abs(progress-previousProgress)>.10){lastCoordinate=null;pendingPaint=-1;blobCandidate=-1;motionEpoch++;}
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
  async function decodeFrame(blob,options){
    if(view.createImageBitmap){
      if(options&&bitmapResizeSupported){try{return await view.createImageBitmap(blob,options);}catch{bitmapResizeSupported=false;}}
      // Some Safari versions reject resize options while accepting the image.
      return view.createImageBitmap(blob);
    }
    const url=view.URL.createObjectURL(blob),image=new view.Image();
    try{
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Image de l’animation illisible.'));image.src=url;});image.close=()=>view.URL.revokeObjectURL(url);return image;
    }catch(error){view.URL.revokeObjectURL(url);throw error;}
  }
  return {ready,render,dispose};
}

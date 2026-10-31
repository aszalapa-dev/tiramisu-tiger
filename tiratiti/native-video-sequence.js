import {createSequenceTimeline} from './sequence-timeline.js?v=smooth-27';

// Indexed Annex B AVC. The left half contains premultiplied RGB, the right alpha.
export function createNativeVideoSequence({canvas,manifestUrl,onReady=()=>{},onError=()=>{},fixedScale=false},environment={}){
  const view=canvas.ownerDocument?.defaultView||globalThis,doc=canvas.ownerDocument;
  const fetchFile=environment.fetch||view.fetch.bind(view);
  const manifestURL=new URL(manifestUrl,environment.baseURL||doc?.baseURI||view.location?.href);
  const measure=environment.measure||(()=>canvas.getBoundingClientRect());
  const hidden=environment.isHidden||(()=>Boolean(doc?.hidden));
  const schedule=environment.schedule||view.requestAnimationFrame?.bind(view)||((callback)=>setTimeout(callback,0));
  const cancel=environment.cancel||view.cancelAnimationFrame?.bind(view)||clearTimeout;
  const pixelRatio=Math.min(environment.pixelRatio??view.devicePixelRatio??1,1.5);
  const manifestController=new AbortController();
  let manifest,video,timeline,pose,buffer,videoURL,decoder,renderer,streamJob,priorityJob;
  let progress=0,direction=1,epoch=0,sequence=0,raf=null,visible=true,disposed=false,failed=false,settled=false;
  let batch=null,pending=null,displayed=null,lastCoordinate=null,lastScale=1,resolveReady,rejectReady;
  let received=[],streamCompleted=false,versioned=false,needsRestore=false;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});
  const canWork=()=>!disposed&&!failed&&visible&&!hidden();
  const close=frame=>frame?.close();
  const isAbort=error=>error?.name==='AbortError';
  const requestOptions=()=>versioned?{cache:'force-cache'}:{};

  function cancelPaint(){if(raf!==null){cancel(raf);raf=null;}}
  function stopNetwork(){
    for(const job of [streamJob,priorityJob])if(job){job.cancelled=true;job.controller.abort();job.reader?.cancel()?.catch?.(()=>{});}
    streamJob=null;priorityJob=null;
  }
  function cleanup(){
    cancelPaint();stopNetwork();manifestController.abort();
    if(decoder&&decoder.state!=='closed')decoder.close();
    close(pending?.frame);pending=null;close(displayed?.frame);displayed=null;
    renderer?.dispose();renderer=null;
  }
  function fail(error){
    if(disposed||failed)return;failed=true;cleanup();
    if(!settled){settled=true;rejectReady(error);}onError(error);
  }
  function useful(index){
    const coordinate=timeline.frameCoordinate(index,pose),target=timeline.frameCoordinate(pose.index,pose);
    return direction>0?coordinate<=target&&(lastCoordinate===null||coordinate>=lastCoordinate):
      coordinate>=target&&(lastCoordinate===null||coordinate<=lastCoordinate);
  }
  function wantPaint(){if(canWork()&&pending&&raf===null)raf=schedule(()=>{raf=null;paint();});}
  function draw(item){
    const relativeScale=(fixedScale?1:pose.scale)/timeline.frameScale(item.index);
    renderer.draw(item.frame,{index:item.index,relativeScale,width:manifest.width,height:manifest.height,codedWidth:video.codedWidth,codedHeight:video.codedHeight});
    lastScale=relativeScale;
  }
  function paint(){
    if(!canWork()||!pending)return;
    const item=pending;pending=null;
    if(item.epoch!==epoch||!useful(item.index)){close(item.frame);pump();return;}
    try{draw(item);}catch(error){close(item.frame);fail(error);return;}
    close(displayed?.frame);displayed=item;lastCoordinate=timeline.frameCoordinate(item.index,pose);needsRestore=false;
    if(canvas.dataset)canvas.dataset.renderBackend='video';environment.onPresent?.(item.index);
    if(!settled){settled=true;resolveReady({frameCount:manifest.frames.length,width:manifest.width,height:manifest.height});onReady();}
    pump();
  }
  function output(frame){
    const current=batch,index=current?.stamps.get(frame.timestamp);
    if(!canWork()||index===undefined||current.epoch!==epoch||!useful(index)){close(frame);return;}
    if(displayed?.index===index){close(frame);return;}
    if(pending){
      const old=timeline.frameCoordinate(pending.index,pose),next=timeline.frameCoordinate(index,pose);
      if(direction>0?next<old:next>old){close(frame);return;}close(pending.frame);
    }
    pending={frame,index,epoch};wantPaint();
  }
  function resize(){
    if(disposed)return;const rect=measure(),width=Math.max(1,Math.round(rect.width*pixelRatio)),height=Math.max(1,Math.round(rect.height*pixelRatio));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;renderer?.resize(width,height);needsRestore=true;}
    // A hidden resize clears the backing buffer too; restore on the next show,
    // even if its dimensions and requested pose are now unchanged.
    if(needsRestore&&displayed&&canWork()){
      try{renderer.draw(displayed.frame,{index:displayed.index,relativeScale:lastScale,width:manifest.width,height:manifest.height,codedWidth:video.codedWidth,codedHeight:video.codedHeight});needsRestore=false;}catch(error){fail(error);}
    }
    wantPaint();
  }
  function contains(start,end){return received.some(range=>range[0]<=start&&range[1]>=end);}
  function store(bytes,start){
    const end=start+bytes.byteLength;
    if(!Number.isSafeInteger(start)||start<0||end>buffer.length)throw new Error('Données vidéo hors limites.');
    buffer.set(bytes,start);received.push([start,end]);received.sort((a,b)=>a[0]-b[0]);
    const merged=[];for(const range of received){const previous=merged.at(-1);if(previous&&range[0]<=previous[1])previous[1]=Math.max(previous[1],range[1]);else merged.push([...range]);}received=merged;
    if(contains(0,video.bytes))streamCompleted=true;
    pump();
  }
  function group(index){
    let first=index;while(first>0&&!video.packets[first].key)first--;
    let last=first;while(last+1<video.packets.length&&!video.packets[last+1].key)last++;
    const start=video.packets[first].offset,end=video.packets[index].offset+video.packets[index].size;
    return {first,index,start,end,last,rangeEnd:video.packets[last].offset+video.packets[last].size};
  }
  async function readResponse(response,job,requestedStart,expectedEnd){
    if(!response.ok)throw new Error('Vidéo indisponible ('+response.status+').');
    let start=0,limit=video.bytes;
    if(response.status===206){
      const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers?.get('content-range')||'');
      if(!match||Number(match[1])!==requestedStart||Number(match[2])+1>video.bytes||Number(match[3])!==video.bytes||Number(match[2])<Number(match[1]))throw new Error('Plage vidéo invalide.');
      start=Number(match[1]);limit=Number(match[2])+1;
      if(limit<expectedEnd)throw new Error('Plage vidéo incomplète.');
    }else if(response.status!==200&&response.status!==undefined)throw new Error('Réponse vidéo invalide.');
    let cursor=start;
    if(response.body?.getReader){
      const reader=job.reader=response.body.getReader();
      while(true){const item=await reader.read();if(job.cancelled||disposed||failed)return;
        if(item.done)break;
        const bytes=item.value;if(cursor+bytes.byteLength>limit)throw new Error('Flux vidéo trop long.');store(bytes,cursor);cursor+=bytes.byteLength;
      }
    }else{
      const bytes=new Uint8Array(await response.arrayBuffer());if(job.cancelled||disposed||failed)return;
      if(cursor+bytes.byteLength>limit)throw new Error('Flux vidéo trop long.');store(bytes,cursor);cursor+=bytes.byteLength;
    }
    if(!job.cancelled&&cursor!==limit)throw new Error('Flux vidéo incomplet.');
  }
  function startStream(){
    if(!canWork()||!video||streamJob||streamCompleted)return;
    const start=received[0]?.[0]===0?received[0][1]:0;
    if(start>=video.bytes)return;
    const job={controller:new AbortController(),cancelled:false};streamJob=job;
    fetchFile(videoURL,{signal:job.controller.signal,...requestOptions(),...(start?{headers:{Range:`bytes=${start}-${video.bytes-1}`}}:{})})
      .then(response=>readResponse(response,job,start,video.bytes))
      .catch(error=>{if(!job.cancelled&&!disposed&&!failed&&!isAbort(error))fail(error);})
      .finally(()=>{if(streamJob===job)streamJob=null;});
  }
  function requestRange(wanted){
    if(priorityJob&&contains(priorityJob.start,priorityJob.end)){priorityJob.cancelled=true;priorityJob.controller.abort();priorityJob=null;}
    if(contains(wanted.start,wanted.end))return;
    // Let the opening packet of the already-running stream arrive without a duplicate request.
    if(wanted.start===0&&received.length===0&&streamJob)return;
    if(priorityJob?.start===wanted.start&&priorityJob?.end===wanted.rangeEnd)return;
    if(priorityJob&&priorityJob.epoch===epoch){
      const near=direction>0?priorityJob.last:priorityJob.first;
      const coordinate=timeline.frameCoordinate(near,pose),target=timeline.frameCoordinate(pose.index,pose);
      if(direction>0?coordinate<=target+6&&(lastCoordinate===null||coordinate>=lastCoordinate):
        coordinate>=target-6&&(lastCoordinate===null||coordinate<=lastCoordinate))return;
    }
    if(priorityJob){priorityJob.cancelled=true;priorityJob.controller.abort();priorityJob.reader?.cancel()?.catch?.(()=>{});}
    const job={start:wanted.start,end:wanted.rangeEnd,first:wanted.first,last:wanted.last,epoch,controller:new AbortController(),cancelled:false};priorityJob=job;
    fetchFile(videoURL,{signal:job.controller.signal,...requestOptions(),headers:{Range:`bytes=${wanted.start}-${wanted.rangeEnd-1}`}})
      .then(response=>readResponse(response,job,wanted.start,wanted.rangeEnd))
      .catch(error=>{if(!job.cancelled&&!disposed&&!failed&&!isAbort(error))fail(error);})
      .finally(()=>{if(priorityJob===job){priorityJob=null;pump();}});
  }
  function pump(){
    if(!canWork()||!video)return;
    const wanted=group(pose.index);
    if(priorityJob&&contains(priorityJob.start,priorityJob.end)){priorityJob.cancelled=true;priorityJob.controller.abort();priorityJob.reader?.cancel()?.catch?.(()=>{});priorityJob=null;}
    if(!contains(wanted.start,wanted.end))requestRange(wanted);
    if(batch||pending?.index===pose.index&&pending.epoch===epoch||displayed?.index===pose.index)return;
    let candidate=contains(wanted.start,wanted.end)?wanted:null,distance=Infinity;
    if(!candidate)for(let index=0;index<video.packets.length;index++){
      if(index===displayed?.index||index===pending?.index||!useful(index))continue;
      if(pending){const next=timeline.frameCoordinate(index,pose),waiting=timeline.frameCoordinate(pending.index,pose);if(direction>0?next<=waiting:next>=waiting)continue;}
      const available=group(index);if(!contains(available.start,available.end))continue;
      const delta=Math.abs(timeline.frameCoordinate(index,pose)-timeline.frameCoordinate(pose.index,pose));
      if(delta<distance){candidate=available;distance=delta;}
    }
    if(!candidate)return;
    const current=batch={epoch,index:candidate.index,stamps:new Map()};
    try{
      for(let index=candidate.first;index<=candidate.index;index++){
        const packet=video.packets[index],timestamp=++sequence*33333;current.stamps.set(timestamp,index);
        const init={type:packet.key?'key':'delta',timestamp,data:buffer.subarray(packet.offset,packet.offset+packet.size)};
        const chunk=environment.createChunk?environment.createChunk(init):new view.EncodedVideoChunk(init);decoder.decode(chunk);
      }
      Promise.resolve(decoder.flush()).then(()=>{
        if(batch===current)batch=null;if(canWork())pump();
      }).catch(error=>{if(!disposed&&!failed)fail(error);});
    }catch(error){batch=null;fail(error);}
  }
  function render(value){
    if(disposed||failed)return;
    const next=Math.min(1,Math.max(0,Number.isFinite(value)?value:0)),previous=progress,oldDirection=direction;
    progress=next;if(!timeline)return;const oldPose=pose;pose=timeline.pose(progress);
    if(next!==previous)direction=next>previous?1:-1;
    // Rotation dialogs wrap progress at one turn; infer their actual short direction.
    if(oldPose?.segment==='rotation'&&pose.segment==='rotation'&&oldPose.index!==pose.index&&timeline.distance(oldPose.index,pose.index)<=timeline.loopFrames/4){
      let delta=pose.index-oldPose.index;if(Math.abs(delta)>timeline.loopFrames/2)delta-=Math.sign(delta)*timeline.loopFrames;direction=Math.sign(delta);
    }
    if(direction!==oldDirection||Math.abs(next-previous)>.10){epoch++;lastCoordinate=null;close(pending?.frame);pending=null;}
    if(displayed?.index===pose.index&&canWork()){
      const scale=(fixedScale?1:pose.scale)/timeline.frameScale(displayed.index);
      if(scale!==lastScale){try{draw(displayed);}catch(error){fail(error);}}
    }
    startStream();pump();wantPaint();
  }
  function visibilityChanged(){
    if(!canWork()){cancelPaint();stopNetwork();return;}
    resize();startStream();pump();wantPaint();
  }
  function validate(input){
    const v=input.video,frames=input.frames;
    if(!(input.width>0&&input.height>0&&input.width<=4096&&input.height<=4096)||!Array.isArray(frames)||!frames.length||!v||
      typeof v.url!=='string'||!v.url||typeof v.codec!=='string'||!v.codec.startsWith('avc1.')||!Number.isSafeInteger(v.bytes)||v.bytes<=0||v.bytes>64*1024*1024||
      v.codedWidth!==input.width*2||v.codedHeight!==input.height||!Array.isArray(v.packets)||v.packets.length!==frames.length)
      throw new Error('Manifeste vidéo invalide.');
    let previousEnd=0,key=-1;
    v.packets.forEach((packet,index)=>{
      if(!Number.isSafeInteger(packet.offset)||!Number.isSafeInteger(packet.size)||packet.offset<previousEnd||packet.size<=0||packet.offset+packet.size>v.bytes||
        typeof packet.key!=='boolean'||!Number.isSafeInteger(packet.timestamp)||packet.timestamp<0)throw new Error('Index vidéo invalide.');
      if(packet.key)key=index;if(key<0||index-key>=6)throw new Error('Groupe vidéo trop long.');previousEnd=packet.offset+packet.size;
    });return input;
  }
  const unresize=environment.observeResize?environment.observeResize(resize):observeResize();
  const unvisible=environment.observeVisibility?environment.observeVisibility(value=>{visible=value;visibilityChanged();}):observeVisibility();
  const undocument=environment.onDocumentVisibility?environment.onDocumentVisibility(visibilityChanged):listenDocument();
  resize();
  fetchFile(manifestURL.href,{signal:manifestController.signal})
    .then(response=>{if(!response.ok)throw new Error('Manifeste vidéo indisponible.');return response.json();})
    .then(async input=>{
      if(disposed)return;manifest=validate(input);video=manifest.video;timeline=createSequenceTimeline(manifest);pose=timeline.pose(progress);
      const support=environment.isConfigSupported||(view.VideoDecoder?.isConfigSupported?.bind(view.VideoDecoder));
      if(!support)throw new Error('Décodage vidéo natif indisponible.');
      const config={codec:video.codec,codedWidth:video.codedWidth,codedHeight:video.codedHeight,optimizeForLatency:true,hardwareAcceleration:'prefer-hardware'};
      const result=await support(config);if(disposed)return;if(!result.supported)throw new Error('Format vidéo natif indisponible.');
      renderer=environment.createRenderer?environment.createRenderer(canvas,{onContextLost:fail}):createPackedRenderer(canvas,fail);
      renderer.resize(canvas.width,canvas.height);
      decoder=environment.createDecoder?environment.createDecoder({output,error:fail}):new view.VideoDecoder({output,error:fail});decoder.configure(config);
      buffer=new Uint8Array(video.bytes);versioned=typeof manifest.revision==='string'&&manifest.revision.length>0;
      const url=new URL(video.url,manifestURL);if(versioned)url.searchParams.set('v',manifest.revision);videoURL=url.href;
      startStream();pump();
    }).catch(error=>{if(!disposed&&!isAbort(error))fail(error);});
  function dispose(){
    if(disposed)return;disposed=true;cleanup();unresize?.();unvisible?.();undocument?.();buffer=null;received=[];
    if(!settled){settled=true;rejectReady(new DOMException('Animation fermée.','AbortError'));}
  }
  function observeResize(){if(view.ResizeObserver){const observer=new view.ResizeObserver(resize);observer.observe(canvas);return()=>observer.disconnect();}view.addEventListener?.('resize',resize);return()=>view.removeEventListener?.('resize',resize);}
  function observeVisibility(){if(!view.IntersectionObserver)return()=>{};const observer=new view.IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);visibilityChanged();},{rootMargin:'80px'});observer.observe(canvas);return()=>observer.disconnect();}
  function listenDocument(){doc?.addEventListener('visibilitychange',visibilityChanged);return()=>doc?.removeEventListener('visibilitychange',visibilityChanged);}
  return {ready,render,dispose};
}

function createPackedRenderer(canvas,onContextLost){
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
  if(!gl)throw new Error('Affichage vidéo GPU indisponible.');
  let disposed=false;
  function shader(type,source){const value=gl.createShader(type);gl.shaderSource(value,source);gl.compileShader(value);if(!gl.getShaderParameter(value,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(value);gl.deleteShader(value);throw new Error(message||'Shader vidéo invalide.');}return value;}
  const vertex=shader(gl.VERTEX_SHADER,'attribute vec2 a;uniform vec2 fit;varying vec2 uv;void main(){uv=vec2((a.x+1.0)*0.5,(1.0-a.y)*0.5);gl_Position=vec4(a*fit,0.0,1.0);}');
  const fragment=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 uv;uniform sampler2D image;uniform vec2 texel;void main(){vec2 p=clamp(uv,texel,vec2(1.0)-texel);vec3 rgb=texture2D(image,vec2(p.x*0.5,p.y)).rgb;float alpha=texture2D(image,vec2(0.5+p.x*0.5,p.y)).r;alpha=alpha<0.008?0.0:alpha;gl_FragColor=vec4(min(rgb,vec3(alpha)),alpha);}');
  const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);throw new Error('Programme vidéo GPU invalide.');}
  const vertices=gl.createBuffer(),texture=gl.createTexture();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  gl.useProgram(program);const attribute=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const fit=gl.getUniformLocation(program,'fit'),texel=gl.getUniformLocation(program,'texel');gl.uniform1i(gl.getUniformLocation(program,'image'),0);
  gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  function lost(event){event.preventDefault();onContextLost(new Error('Affichage vidéo interrompu.'));}canvas.addEventListener('webglcontextlost',lost);
  return {
    resize(width,height){gl.viewport(0,0,width,height);},
    draw(frame,{width,height,relativeScale,codedWidth,codedHeight}){
      if(disposed||gl.isContextLost())throw new Error('Affichage vidéo interrompu.');
      gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,frame);
      const scale=Math.min(canvas.width/width,canvas.height/height)*relativeScale;
      gl.uniform2f(fit,width*scale/canvas.width,height*scale/canvas.height);gl.uniform2f(texel,1/codedWidth,.5/codedHeight);
      gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error('Image vidéo GPU illisible ('+error+').');
    },
    dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);gl.deleteTexture(texture);gl.deleteBuffer(vertices);gl.deleteProgram(program);}
  };
}

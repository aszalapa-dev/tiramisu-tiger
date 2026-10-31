import {createRenderedSequence as createImageSequence} from './rendered-sequence.js?v=mobile-safari-27';
import {createNativeVideoSequence} from './native-video-sequence.js?v=fluid-31';

// Keep the native Blender images as an automatic compatibility fallback.
// A fresh canvas is essential: a WebGL canvas cannot become a 2D canvas.
export function createRenderedSequence(options,environment={}){
  const {videoManifestUrl,onCanvas=()=>{},onFallback=()=>{},onReady=()=>{},onError=()=>{},...base}=options;
  const view=base.canvas.ownerDocument?.defaultView||globalThis;
  const native=environment.supportsVideo??Boolean(videoManifestUrl&&view.VideoDecoder&&view.EncodedVideoChunk);
  const makeVideo=environment.createVideo||createNativeVideoSequence,makeImages=environment.createImages||createImageSequence;
  let canvas=base.canvas,player,progress=0,generation=0,disposed=false,settled=false;
  let resolve,reject;const ready=new Promise((yes,no)=>{resolve=yes;reject=no;});ready.catch(()=>{});
  function start(useVideo){
    if(disposed)return;
    const token=++generation;
    const failed=error=>queueMicrotask(()=>{
      if(disposed||token!==generation)return;
      if(useVideo){
        generation++;player?.dispose();player=null;onFallback();
        const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;
        onCanvas(canvas);start(false);
      }else{
        generation++;if(!settled){settled=true;reject(error);}onError(error);
      }
    });
    try{
      player=(useVideo?makeVideo:makeImages)({...base,canvas,manifestUrl:useVideo?videoManifestUrl:base.manifestUrl,
        onReady(){
          if(disposed||token!==generation)return;
          canvas.dataset.renderBackend=useVideo?'video':'images';
          if(!settled){settled=true;resolve({backend:canvas.dataset.renderBackend});}
          onReady({canvas,backend:canvas.dataset.renderBackend});
        },onError:failed});
      player.ready.catch(failed);player.render(progress);
    }catch(error){failed(error);}
  }
  queueMicrotask(()=>start(native&&Boolean(videoManifestUrl)));
  return {ready,
    render(value){progress=Math.max(0,Math.min(1,Number.isFinite(value)?value:0));if(!disposed)player?.render(progress);},
    dispose(){if(disposed)return;disposed=true;generation++;player?.dispose();
      if(!settled){settled=true;reject(new DOMException('Animation fermée.','AbortError'));}}
  };
}

const clamp=value=>Math.min(1,Math.max(0,Number.isFinite(value)?value:0));
const wrap=(value,length)=>((value%length)+length)%length;
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};

// A uniform closed turn can be reused twice; opening frames keep their own time.
export function createSequenceTimeline(manifest){
  const count=manifest.frames.length,meta=manifest.timeline;
  const loop=meta?Math.floor(meta.rotationFrames):0;
  if(meta&&(!(loop>0&&loop<count)||!(meta.turns>0)||!(meta.rotationEnd>0)||
    !(meta.openingStart>=meta.rotationEnd&&meta.openingEnd>meta.openingStart&&meta.openingEnd<=1)||
    !(meta.openingFrameStep>0)||!(meta.openingScale>0)||!(meta.shrinkEnd>meta.shrinkStart)))
    throw new Error('Le calendrier de la séquence est invalide.');

  function pose(value){
    const progress=clamp(value);
    if(!meta){const index=Math.round(progress*(count-1));return {progress,index,coordinate:index,scale:1,segment:'linear'};}
    const scale=1-(1-meta.openingScale)*smooth((progress-meta.shrinkStart)/(meta.shrinkEnd-meta.shrinkStart));
    if(progress>=meta.openingStart){
      const offset=Math.min(count-loop-1,Math.max(0,Math.round((progress-meta.openingStart)/meta.openingFrameStep)));
      return {progress,index:loop+offset,coordinate:loop*meta.turns+offset,scale,segment:'opening'};
    }
    const t=clamp(progress/meta.rotationEnd),eased=t*t*t*(10+t*(-15+6*t));
    const coordinate=loop*meta.turns*eased;
    return {progress,index:wrap(Math.round(coordinate),loop),coordinate,scale,segment:'rotation'};
  }
  function frameScale(index){return meta&&index>=loop?meta.openingScale:1;}
  function distance(a,b){
    const delta=Math.abs(a-b);
    return loop&&a<loop&&b<loop?Math.min(delta,loop-delta):delta;
  }
  function frameCoordinate(index,current){
    if(!meta)return index;
    if(index>=loop)return loop*meta.turns+index-loop;
    return index+Math.round((current.coordinate-index)/loop)*loop;
  }
  function neighbour(current,delta){
    if(!meta){const index=current.index+delta;return index>=0&&index<count?index:null;}
    if(current.segment==='rotation'){
      if(current.progress>=meta.rotationEnd&&delta>0){
        const index=loop+delta-1;return index<count?index:null;
      }
      return wrap(current.index+delta,loop);
    }
    const offset=current.index-loop+delta;
    if(offset>=0){const index=loop+offset;return index<count?index:null;}
    return wrap(offset+1,loop);
  }
  function neighbours(current,direction,limit,{ahead=limit-1,behind=limit-1}={}){
    const result=[current.index],seen=new Set(result);
    let forward=1,backward=1;
    function append(delta){
      const index=neighbour(current,delta);
      if(index!==null&&!seen.has(index)){seen.add(index);result.push(index);}
    }
    // Three images in the travel direction for each image behind the gesture.
    while(result.length<Math.min(count,limit)&&(forward<=ahead||backward<=behind)){
      for(let step=0;step<3&&forward<=ahead&&result.length<limit;step++)append(direction*forward++);
      if(backward<=behind&&result.length<limit)append(-direction*backward++);
    }
    return result;
  }
  return {pose,frameScale,frameCoordinate,distance,neighbours,loopFrames:loop};
}

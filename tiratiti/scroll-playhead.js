const clamp=value=>Math.min(1,Math.max(0,Number.isFinite(value)?value:0));

// Interpolate known scroll samples with a short lookback, never extrapolate.
export function createScrollPlayhead({onProgress,initialProgress=0},environment={}){
  const schedule=environment.schedule||(callback=>globalThis.requestAnimationFrame(callback));
  const cancel=environment.cancel||(id=>globalThis.cancelAnimationFrame(id));
  const now=environment.now||(()=>globalThis.performance?.now?.()??Date.now());
  const isHidden=environment.isHidden||(()=>Boolean(globalThis.document?.hidden));
  const lookbackMilliseconds=60,maxLag=.025,maxAnchors=16;
  let current=clamp(initialProgress),target=current,direction=0;
  let anchors=[{time:now(),value:current}];
  let frame=null,suspended=false,disposed=false;

  function canRun(){return !disposed&&!suspended&&!isHidden();}
  function stop(){if(frame!==null){cancel(frame);frame=null;}}
  function publish(value){if(value!==current){current=value;onProgress(current);}}
  function finish(time=now()){stop();anchors=[{time,value:target}];publish(target);}
  function bridge(time){anchors=[{time:time-lookbackMilliseconds,value:current},{time,value:target}];}
  function queue(){
    if(frame!==null||!canRun()||current===target)return;
    frame=schedule(tick);
  }
  function tick(timestamp){
    frame=null;
    if(!canRun())return;
    const time=Number.isFinite(timestamp)?timestamp:now();
    const sampleTime=time-lookbackMilliseconds;
    while(anchors.length>2&&anchors[1].time<=sampleTime)anchors.shift();
    const first=anchors[0],last=anchors.at(-1);
    if(sampleTime>=last.time){finish(time);return;}
    let next=first.value;
    if(sampleTime>first.time){
      const after=anchors.findIndex(anchor=>anchor.time>sampleTime);
      const a=anchors[after-1],b=anchors[after];
      next=a.value+(b.value-a.value)*(sampleTime-a.time)/(b.time-a.time);
    }
    // A reversal/lag-cap reset must not replay an older part of the curve.
    next=Math.max(Math.min(current,target),Math.min(Math.max(current,target),next));
    publish(next);
    if(current===target)finish(time);else queue();
  }
  function set(value,{immediate=false}={}){
    if(disposed)return;
    const next=clamp(value),inputDirection=Math.sign(next-target),time=now();
    const reversing=inputDirection&&direction&&inputDirection!==direction;
    target=next;if(inputDirection)direction=inputDirection;
    if(!canRun()){stop();return;}
    if(immediate){direction=0;finish(time);return;}
    if(!inputDirection){queue();return;}
    // When input reverses inside the old lag, align instead of continuing the
    // old-direction chase. Subsequent inputs can reverse without overshooting.
    if(reversing&&inputDirection*(target-current)<0){finish(time);return;}
    const distance=target-current;
    const capped=Math.abs(distance)>maxLag;
    if(capped)publish(target-Math.sign(distance)*maxLag);
    const previous=anchors.at(-1);
    if(capped||reversing||time-previous.time>=lookbackMilliseconds||time<=previous.time)bridge(time);
    else anchors.push({time,value:target});
    while(anchors.length>maxAnchors)anchors.shift();
    queue();
  }
  function suspend(){if(!disposed){suspended=true;stop();}}
  function resume(){
    if(disposed)return;
    suspended=false;direction=0;
    if(!isHidden())finish();
  }
  function dispose(){if(!disposed){disposed=true;stop();}}
  return {set,suspend,resume,dispose};
}

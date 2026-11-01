const clamp=value=>Math.min(1,Math.max(0,Number.isFinite(value)?value:0));

// Follow the latest scroll pose on the display clock, including between sparse
// input events. A critically damped response coasts into that pose, not past it.
export function createScrollPlayhead({onProgress,initialProgress=0},environment={}){
  const schedule=environment.schedule||(callback=>globalThis.requestAnimationFrame(callback));
  const cancel=environment.cancel||(id=>globalThis.cancelAnimationFrame(id));
  const now=environment.now||(()=>globalThis.performance?.now?.()??Date.now());
  const isHidden=environment.isHidden||(()=>Boolean(globalThis.document?.hidden));
  const baseOmega=14,maxOmega=32,speedResponse=60;
  const positionTolerance=.0001,velocityTolerance=.001;
  let current=clamp(initialProgress),target=current,velocity=0,omega=baseOmega;
  let direction=0,lastInputTime=now(),lastFrameTime=lastInputTime;
  let frame=null,generation=0,suspended=false,disposed=false;

  function canRun(){return !disposed&&!suspended&&!isHidden();}
  function stop(){
    generation++;
    if(frame!==null){cancel(frame);frame=null;}
  }
  function publish(value){if(value!==current){current=value;onProgress(current);}}
  function align(){
    stop();velocity=0;omega=baseOmega;direction=0;
    lastInputTime=lastFrameTime=now();publish(target);
  }
  function queue(){
    if(frame!==null||!canRun()||current===target&&velocity===0)return;
    const scheduledGeneration=generation;
    frame=schedule(timestamp=>tick(timestamp,scheduledGeneration));
  }
  function tick(timestamp,scheduledGeneration){
    // cancelAnimationFrame cannot retract an already dispatched callback.
    // Check its generation before touching the newer frame's ownership.
    if(scheduledGeneration!==generation||disposed)return;
    frame=null;
    if(!canRun()){stop();return;}
    const time=Number.isFinite(timestamp)?timestamp:now();
    const seconds=Math.max(0,(time-lastFrameTime)/1000);
    lastFrameTime=time;
    const displacement=current-target;
    const coefficient=velocity+omega*displacement;
    const decay=Math.exp(-omega*seconds);
    let next=target+(displacement+coefficient*seconds)*decay;
    velocity=(velocity-omega*coefficient*seconds)*decay;
    // Retargets may put a close target in the path of existing momentum.
    // Reach that target without extrapolating to an invented scroll pose.
    if((target-current)*(target-next)<=0){next=target;velocity=0;}
    if(Math.abs(target-next)<=positionTolerance&&Math.abs(velocity)<=velocityTolerance){next=target;velocity=0;}
    publish(next);
    queue();
  }
  function set(value,{immediate=false}={}){
    if(disposed)return;
    const next=clamp(value),inputDirection=Math.sign(next-target),time=now();
    if(inputDirection){
      const inputSeconds=(time-lastInputTime)/1000;
      const rawSpeed=inputSeconds>0?Math.abs(next-target)/inputSeconds:0;
      omega=Math.max(baseOmega,Math.min(maxOmega,speedResponse*rawSpeed));
      if(direction&&inputDirection!==direction)velocity=0;
      direction=inputDirection;lastInputTime=time;
    }
    target=next;
    // A target can cross the displayed pose during a single raw-input
    // direction. Brake old momentum that would move away from the new target.
    if(velocity*(target-current)<0)velocity=0;
    if(!canRun()){stop();return;}
    if(immediate){align();return;}
    // Ordinary input changes the target only. Never publish from this path.
    if(frame===null)lastFrameTime=time;
    queue();
  }
  function suspend(){if(!disposed){suspended=true;stop();}}
  function resume(){
    if(disposed)return;
    suspended=false;
    if(!isHidden())align();
  }
  function dispose(){if(!disposed){disposed=true;stop();}}
  return {set,suspend,resume,dispose};
}

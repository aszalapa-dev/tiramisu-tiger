import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const moduleUrl=process.env.SCROLL_PLAYHEAD_MODULE
  ?pathToFileURL(process.env.SCROLL_PLAYHEAD_MODULE).href
  :new URL('../scroll-playhead.js',import.meta.url).href;
const {createScrollPlayhead}=await import(moduleUrl);

function fixture({initialProgress=0,hz=60}={}){
  const frames=new Map(),values=[];let clock=0,nextId=0,hidden=false,value=initialProgress;
  const player=createScrollPlayhead({initialProgress,onProgress:next=>{value=next;values.push(next);}},{
    now:()=>clock,isHidden:()=>hidden,
    schedule:callback=>{frames.set(++nextId,callback);return nextId;},cancel:id=>frames.delete(id)
  });
  return {player,frames,values,get value(){return value;},get time(){return clock;},
    advance(milliseconds=1000/hz){clock+=milliseconds;const batch=[...frames.entries()];for(const[id,callback]of batch)if(frames.delete(id))callback(clock);},
    hidden(next){hidden=next;},
    settle(maxMilliseconds=1000){
      const start=clock;while(frames.size&&clock-start<maxMilliseconds)this.advance();
      assert.equal(frames.size,0,'Settling must stop animation work within one second');return clock-start;
    }
  };
}
const stepsOf=values=>values.slice(1).map((value,index)=>value-values[index]);

// Fails if sample interpolation reaches the latest sample and idles between inputs.
for(const [inputHz,displayHz] of [[5,60],[10,60],[5,120],[10,120],[20,60],[30,60],[20,120],[30,120]])test(`${inputHz} Hz input keeps every interior ${displayHz} Hz refresh moving`,context=>{
  const f=fixture({initialProgress:.2,hz:displayHz}),visual=[],raw=[],lags=[];let target=.2;
  for(let tick=0;tick<displayHz*3;tick++){
    if(tick%(displayHz/inputHz)===0){target=.2+.08*tick/displayHz;f.player.set(target);}
    f.advance();visual.push(f.value);raw.push(target);
    assert.ok(f.value<=target+1e-12,'Motion may not go beyond the latest scroll pose');
    if(tick>=displayHz/2)lags.push(target-f.value);
  }
  const interior=visual.slice(displayHz/2,displayHz*2.5),steps=stepsOf(interior);
  const held=steps.filter(step=>step===0).length,rawHeld=stepsOf(raw.slice(displayHz/2,displayHz*2.5)).filter(step=>step===0).length;
  const maxLag=Math.max(...lags),meanLag=lags.reduce((sum,lag)=>sum+lag,0)/lags.length;
  context.diagnostic(`held refreshes ${rawHeld} raw → ${held} visual; mean/peak moving lag ${(meanLag/.08*1000).toFixed(1)}/${(maxLag/.08*1000).toFixed(1)} ms; velocity ratio ${(Math.max(...steps)/Math.min(...steps)).toFixed(3)}×`);
  assert.equal(held,0,'Sparse inputs must not produce static display refreshes');
  assert.ok(steps.every(step=>step>0),'A forward gesture must keep advancing');
  assert.ok(meanLag/.08<.2,'The follower must not build an average backlog beyond 200 ms of motion');
  assert.ok(maxLag/.08<(inputHz===5?.3:.2),'Even sparse input bursts must have a bounded response');
  if(inputHz>=20)assert.ok(Math.max(...steps)/Math.min(...steps)<1.35,'Frequent input must keep a steady visible speed');
  f.player.dispose();
});

// Fails if the old lag-cap publishes synchronously from set().
test('ordinary impulses and retargets only change the target until a display frame',()=>{
  const f=fixture({initialProgress:.1});assert.equal(f.frames.size,0);f.player.set(.9);
  assert.equal(f.value,.1);assert.equal(f.values.length,0);assert.equal(f.frames.size,1);
  f.advance();const first=f.value;assert.ok(first>.1&&first<.9);
  f.player.set(.98);assert.equal(f.value,first);assert.equal(f.values.length,1);
  f.player.set(.95);assert.equal(f.value,first,'A raw reversal must not snap the pose');
  f.player.dispose();
});

// Catches restarting velocity on every target sample, which causes visible braking.
test('forward retargeting preserves the motion already in flight',context=>{
  const f=fixture({initialProgress:.1,hz:120}),positions=[];f.player.set(.5);
  for(let i=0;i<12;i++){f.advance();positions.push(f.value);}
  const before=positions.at(-1)-positions.at(-2);f.player.set(.55);const atInput=f.value;f.advance();
  const after=f.value-atInput;
  assert.ok(after>before*.85,'A later forward target cannot discard existing velocity');
  assert.ok(after<before*1.3,'A target update cannot create a visible speed jump');
  context.diagnostic(`retarget frame step ratio ${(after/before).toFixed(3)}×`);f.player.dispose();
});

test('a large ordinary seek animates and settles exactly without a seconds-long backlog',context=>{
  const f=fixture();f.player.set(.9);assert.equal(f.value,0);
  f.advance();assert.ok(f.value>0&&f.value<.15,'The first frame must animate the seek');
  const settled=f.settle();assert.equal(f.value,.9);assert.equal(f.values.at(-1),.9);
  assert.ok(f.values.every((v,i)=>v>=0&&v<=.9&&(i===0||v>f.values[i-1])));
  context.diagnostic(`large seek settles after ${(settled+1000/60).toFixed(1)} ms`);f.player.dispose();
});

test('after a scroll gesture stops the can coasts, slows, reaches the exact target and idles',context=>{
  const f=fixture({initialProgress:.1,hz:120});let target=.1,lastInputTime=0;
  for(let tick=0;tick<120;tick++){
    if(tick%12===0){target=.1+.08*tick/120;f.player.set(target);lastInputTime=f.time;}f.advance();
  }
  const finalInputValue=f.value,coast=[];
  for(let i=0;i<18;i++){f.advance();coast.push(f.value);}
  assert.ok(coast[0]>finalInputValue,'The first refresh after input stops must still move');
  assert.ok(coast.at(-1)>coast[0],'Coasting must continue beyond one refresh');
  assert.ok(coast.at(-1)<target,'Coasting must ease into the target');
  const steps=stepsOf(coast);assert.ok(steps.slice(10).every((step,i)=>i===0||step<steps[9+i]),'The tail must slow down');
  const settled=f.settle(),settledAt=f.time;assert.equal(f.value,target);assert.equal(f.values.at(-1),target);
  const calls=f.values.length;for(let i=0;i<10;i++)f.advance();
  assert.equal(f.values.length,calls);assert.equal(f.frames.size,0);
  context.diagnostic(`stop settles in ${(settledAt-lastInputTime).toFixed(1)} ms from final input (${(150+settled).toFixed(1)} ms after input interval); first/tail coast frame ${(steps[0]/steps.at(-1)).toFixed(2)}×`);f.player.dispose();
});

test('irregular 80–220 ms input gaps keep the display moving with bounded response',context=>{
  const f=fixture({initialProgress:.1,hz:120}),intervals=[80,170,110,220,90,140],positions=[];
  let due=80,index=0,target=.1;const lags=[];
  for(let tick=0;tick<360;tick++){
    if(f.time+1e-8>=due){target=.1+.07*due/1000;f.player.set(target);due+=intervals[index++%intervals.length];}
    f.advance();positions.push(f.value);
    if(tick>60)lags.push(target-f.value);
    assert.ok(f.value<=target+1e-12,'Uneven input must never extrapolate');
  }
  const steps=stepsOf(positions.slice(60));assert.ok(steps.every(step=>step>0),'Long input gaps must not freeze the display');
  const maxLag=Math.max(...lags),meanLag=lags.reduce((sum,lag)=>sum+lag,0)/lags.length;
  assert.ok(meanLag/.07<.2,'Jitter must not accumulate a long average tail');
  assert.ok(maxLag/.07<.3,'Individual jitter bursts must have a bounded response');
  context.diagnostic(`jitter mean/peak moving lag ${(meanLag/.07*1000).toFixed(1)}/${(maxLag/.07*1000).toFixed(1)} ms`);
  f.settle();assert.equal(f.value,target);f.player.dispose();
});

for(const [inputHz,displayHz]of [[30,60],[30,120],[60,60],[60,120]])test(`${inputHz} Hz fast input stays responsive and even on a ${displayHz} Hz display`,context=>{
  const f=fixture({initialProgress:.1,hz:displayHz}),values=[],interval=displayHz/inputHz;let target=.1,maxLag=0;
  for(let tick=0;tick<displayHz*1.5;tick++){
    if(tick%interval===0){target=.1+.5*tick/displayHz;const before=f.value;f.player.set(target);assert.equal(f.value,before);}
    f.advance();values.push(f.value);maxLag=Math.max(maxLag,target-f.value);
    assert.ok(f.value<=target+1e-12,'Fast input cannot be extrapolated');
  }
  const steps=stepsOf(values.slice(Math.ceil(displayHz*.3),displayHz*1.3)),ratio=Math.max(...steps)/Math.min(...steps);
  assert.ok(steps.every(step=>step>0),'Fast input must keep moving');
  assert.ok(maxLag<.06,'Fast input cannot trail by more than 0.06 progress');
  assert.ok(ratio<1.35,`Target arrivals must not pulse visible speed (${ratio.toFixed(3)}×)`);
  context.diagnostic(`fast velocity ratio ${ratio.toFixed(3)}×; maximum lag ${maxLag.toFixed(5)}`);
  f.settle();assert.equal(f.value,target);f.player.dispose();
});

for(const accelerating of [true,false])test(`a smoothly ${accelerating?'accelerating':'decelerating'} gesture stays monotonic and settles exactly`,()=>{
  const f=fixture({initialProgress:.1}),values=[];let target=.1;
  const position=time=>accelerating?.1+.1*time+.4*time*time/3:.1+.5*time-.4*time*time/3;
  for(let tick=0;tick<90;tick++){
    if(tick%2===0){target=position(tick/60);f.player.set(target);}f.advance();values.push(f.value);
    assert.ok(f.value<=target+1e-12);assert.ok(target-f.value<.07,'Changing speed must not accumulate obsolete motion');
  }
  assert.ok(stepsOf(values.slice(20,80)).every(step=>step>0));f.settle();assert.equal(f.value,target);f.player.dispose();
});

test('a reversed target behind the visual brakes forward momentum and reverses on the next frame',()=>{
  const f=fixture();f.player.set(.8);for(let i=0;i<8;i++)f.advance();
  const before=f.value;assert.ok(before>.2);f.player.set(.05);assert.equal(f.value,before);f.advance();
  assert.ok(f.value<before&&f.value>.05,'Reversal must start moving backward without jumping');
  f.settle();assert.equal(f.value,.05);f.player.dispose();
});

test('a reversal inside the old lag converges toward the new target without snapping or crossing it',()=>{
  const f=fixture();f.player.set(.8);for(let i=0;i<4;i++)f.advance();
  const before=f.value;assert.ok(before<.6);f.player.set(.6);assert.equal(f.value,before);
  f.advance();assert.ok(f.value>before&&f.value<.6,'The pose must smoothly approach a target still ahead of it');
  f.settle();assert.equal(f.value,.6);assert.ok(f.values.every(v=>v<=.6));f.player.dispose();
});

// Catches stale momentum when a steadily increasing raw target crosses the pose
// after a reversal, without generating another raw-input direction change.
test('a target crossing the display pose brakes velocity that points away from the latest target',()=>{
  const f=fixture();f.player.set(.8);for(let i=0;i<8;i++)f.advance();
  f.player.set(.05);f.advance();
  for(let hundredths=6;hundredths<=30;hundredths++){
    const target=hundredths/100,before=f.value;f.player.set(target);
    assert.equal(f.value,before,'A crossing target must not synchronously snap the pose');
    f.advance();
    assert.ok(f.value>=Math.min(before,target)-1e-12&&f.value<=Math.max(before,target)+1e-12,
      `The display must move toward target ${target}, from ${before}, received ${f.value}`);
  }
  f.settle();assert.equal(f.value,.3);f.player.dispose();
});

test('the first display frame uses its actual duration at 60 and 120 Hz',()=>{
  const slow=fixture(),fast=fixture({hz:120});slow.player.set(.2);fast.player.set(.2);slow.advance();fast.advance();
  assert.ok(fast.value>0&&fast.value<slow.value*.4,'The 8.33 ms frame must not receive a 16.67 ms startup kick');
  fast.advance();assert.ok(Math.abs(fast.value-slow.value)<1e-12,'Equivalent elapsed time must produce the same pose');
  slow.player.dispose();fast.player.dispose();
});

test('variable display durations converge identically to fixed timing without overshooting',()=>{
  const fixed=fixture({hz:120}),uneven=fixture();fixed.player.set(.7);uneven.player.set(.7);
  for(let i=0;i<48;i++)fixed.advance();
  for(const milliseconds of [8,37,11,66,3,110,15,50,100])uneven.advance(milliseconds);
  assert.ok(Math.abs(fixed.value-uneven.value)<1e-12,'Frame partitioning must not change the time response');
  uneven.advance(2000);assert.equal(uneven.value,.7);assert.equal(uneven.frames.size,0);
  fixed.player.dispose();uneven.player.dispose();
});

test('hidden and suspended states cancel work, keep latest input and align when resumed',()=>{
  const f=fixture();f.player.set(.5);f.advance();f.hidden(true);
  const calls=f.values.length;f.advance();assert.equal(f.frames.size,0);assert.equal(f.values.length,calls);
  f.player.set(.8);assert.equal(f.frames.size,0);f.advance();assert.equal(f.values.length,calls);
  f.hidden(false);f.player.resume();assert.equal(f.value,.8);assert.equal(f.frames.size,0);
  f.player.suspend();f.player.set(.4);f.advance();assert.equal(f.value,.8);assert.equal(f.frames.size,0);
  f.player.resume();assert.equal(f.value,.4);f.player.dispose();
});

test('explicit immediate and reduced-motion style updates align and clamp without animation',()=>{
  const f=fixture();f.player.set(.5);f.player.set(.3,{immediate:true});
  assert.equal(f.value,.3);assert.equal(f.frames.size,0);
  f.player.set(2,{immediate:true});assert.equal(f.value,1);
  f.player.set(-1,{immediate:true});assert.equal(f.value,0);
  f.player.set(Number.NaN,{immediate:true});assert.equal(f.value,0);f.player.dispose();
});

test('a canceled stale callback cannot publish or steal a newer scheduled frame',()=>{
  const f=fixture();f.player.set(.5);const stale=[...f.frames.values()][0];
  f.player.suspend();f.player.set(.3);f.player.resume();f.player.set(.6);
  const current=[...f.frames.values()][0],before=f.value;stale(200);
  assert.equal(f.value,before,'Invalidated work must not move the resumed player');
  assert.equal(f.frames.size,1,'Invalidated work must not schedule duplicate frames');
  assert.equal([...f.frames.values()][0],current,'Invalidated work must leave the current callback alone');
  f.advance();assert.ok(f.value>before&&f.value<.6);f.player.dispose();
});

test('disposal cancels scheduled work and ignores stale callbacks and later commands',()=>{
  const f=fixture();f.player.set(.5);const late=[...f.frames.values()][0];f.player.dispose();
  const calls=f.values.length;late(100);f.player.set(.9,{immediate:true});f.player.resume();
  assert.equal(f.values.length,calls);assert.equal(f.frames.size,0);
});

for(const inputHz of [30,60])test(`${inputHz} Hz exponential touch momentum keeps a smooth moving tail`,context=>{
  const f=fixture({initialProgress:.1}),values=[];let target=.1;
  for(let tick=0;tick<120;tick++){
    if(tick%(60/inputHz)===0){target=.1+.5*(1-Math.exp(-3*tick/60));f.player.set(target);}f.advance();values.push(f.value);
    assert.ok(f.value<=target+1e-12);assert.ok(target-f.value<.1,'Momentum must not build a seconds-long backlog');
  }
  const steps=values.slice(40,90).map((value,i)=>value-values[39+i]);assert.ok(steps.every(step=>step>0));
  const adjacent=steps.slice(1).map((step,i)=>Math.max(step,steps[i])/Math.min(step,steps[i]));
  assert.ok(Math.max(...adjacent)<1.25,`Momentum must not pulse between refreshes (${Math.max(...adjacent).toFixed(3)}×)`);
  context.diagnostic(`momentum maximum adjacent velocity ratio ${Math.max(...adjacent).toFixed(3)}×`);
  f.settle();assert.equal(f.value,target);f.player.dispose();
});

test('a fast gesture followed by idle does not poison the next slow gesture',context=>{
  const f=fixture({initialProgress:.1});
  for(let tick=0;tick<30;tick++){if(tick%2===0)f.player.set(.1+.8*tick/60);f.advance();}
  f.settle();f.advance(1000);const start=f.value,values=[];let target=start;
  for(let tick=0;tick<90;tick++){
    if(tick%2===0){target=start+.08*tick/60;f.player.set(target);}f.advance();values.push(f.value);
    assert.ok(f.value<=target+1e-12);assert.ok(target-f.value<.016);
  }
  const steps=values.slice(20,80).map((value,i)=>value-values[19+i]),ratio=Math.max(...steps)/Math.min(...steps);
  assert.ok(steps.every(step=>step>0));assert.ok(ratio<1.35,'Previous fast tuning cannot pulse the next slow gesture');
  context.diagnostic(`next slow gesture velocity ratio ${ratio.toFixed(3)}×`);
  f.settle();assert.equal(f.value,target);f.player.dispose();
});

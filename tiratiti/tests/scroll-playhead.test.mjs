import {test} from 'node:test';
import assert from 'node:assert/strict';

let createScrollPlayhead;
try{({createScrollPlayhead}=await import('../scroll-playhead.js'));}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}

function fixture({initialProgress=0,hz=60}={}){
  assert.equal(typeof createScrollPlayhead,'function','The bounded scroll playhead must be exported');
  const frames=new Map(),values=[];let clock=0,nextId=0,hidden=false,value=initialProgress;
  const player=createScrollPlayhead({initialProgress,onProgress:next=>{value=next;values.push(next);}},{
    now:()=>clock,isHidden:()=>hidden,
    schedule:callback=>{frames.set(++nextId,callback);return nextId;},cancel:id=>frames.delete(id)
  });
  return {player,frames,values,get value(){return value;},
    advance(milliseconds=1000/hz){clock+=milliseconds;const batch=[...frames.entries()];for(const[id,callback]of batch)if(frames.delete(id))callback(clock);},
    hidden(next){hidden=next;},
    settle(){for(let i=0;frames.size&&i<120;i++)this.advance();assert.equal(frames.size,0,'The playhead must stop scheduling once settled');}
  };
}

for(const [inputHz,displayHz] of [[20,60],[30,60],[20,120],[30,120]])test(`${inputHz} Hz target input spreads motion across ${displayHz} Hz display frames`,testContext=>{
  const f=fixture({initialProgress:.2,hz:displayHz}),visual=[],raw=[];let target=.2;
  for(let tick=0;tick<displayHz*2;tick++){
    if(tick%(displayHz/inputHz)===0){target=.2+.12*tick/displayHz;f.player.set(target);}
    f.advance();visual.push(f.value);raw.push(target);
    assert.ok(f.value<=target+1e-12,'The playhead cannot extrapolate beyond the input');
    assert.ok(target-f.value<=.025+1e-12,'Input lag remains bounded');
  }
  const deltas=values=>values.slice(1).map((value,index)=>value-values[index]);
  const smooth=deltas(visual),stepped=deltas(raw);
  const held=smooth.filter(delta=>delta===0).length,rawHeld=stepped.filter(delta=>delta===0).length;
  assert.ok(held<displayHz/10,'Most display frames should advance while the target is moving');
  assert.ok(Math.max(...smooth)<Math.max(...stepped)*.8,'Target bursts should become smaller display steps');
  assert.ok(smooth.every(delta=>delta>=0),'Smoothing cannot reverse a forward gesture');
  testContext.diagnostic(`held refreshes: ${rawHeld} raw → ${held} smoothed; largest progress step: ${Math.max(...stepped).toFixed(6)} → ${Math.max(...smooth).toFixed(6)}`);
  f.player.dispose();
});

for(const [inputHz,displayHz] of [[20,60],[30,60],[20,120],[30,120]])test(`${inputHz} Hz linear input keeps near-constant interior velocity at ${displayHz} Hz`,testContext=>{
  const f=fixture({initialProgress:.2,hz:displayHz}),values=[];const interval=displayHz/inputHz;
  for(let tick=0;tick<displayHz*3;tick++){
    if(tick%interval===0)f.player.set(.2+.08*tick/displayHz);
    f.advance();values.push(f.value);
  }
  const interior=values.slice(displayHz/2,displayHz*2.5);
  const steps=interior.slice(1).map((value,index)=>value-interior[index]);
  assert.ok(steps.every(step=>step>0),'Steady motion cannot hold display frames');
  const ratio=Math.max(...steps)/Math.min(...steps);
  assert.ok(ratio<=1.2,`Sample arrivals must not pulse the visible speed (${ratio.toFixed(3)}×)`);
  testContext.diagnostic(`largest / smallest interior progress step: ${ratio.toFixed(3)}×`);
  f.player.dispose();
});

test('large seeks immediately stay within 0.025 progress without overshooting or taking seconds',()=>{
  const f=fixture();f.player.set(.9);
  assert.ok(f.value>=.875&&f.value<=.9,'A large seek skips the obsolete backlog immediately');
  for(let i=0;i<12;i++){f.advance();assert.ok(f.value<=.9);assert.ok(.9-f.value<=.025+1e-12);}
  assert.ok(.9-f.value<.0005,'After 200 ms only a negligible settling distance remains');
  f.settle();assert.equal(f.value,.9);f.player.dispose();
});

for(const [inputHz,displayHz]of [[30,60],[30,120],[60,60],[60,120]])test(`${inputHz} Hz fast linear input does not pulse against the lag cap at ${displayHz} Hz`,context=>{
  const f=fixture({initialProgress:.1,hz:displayHz}),values=[],interval=displayHz/inputHz;
  for(let tick=0;tick<displayHz*1.5;tick++){
    const target=.1+.5*Math.floor(tick/interval)*interval/displayHz;
    if(tick%interval===0)f.player.set(target);
    f.advance();values.push(f.value);
    assert.ok(target-f.value<=.025+1e-12,'Adaptive timing must preserve the existing maximum lag');
    assert.ok(f.value<=target+1e-12,'The fast input must never be extrapolated');
  }
  const interior=values.slice(Math.ceil(displayHz*.3),displayHz*1.3),steps=interior.slice(1).map((v,i)=>v-interior[i]);
  assert.ok(steps.every(step=>step>0),'Fast linear input must not hold refreshes');
  const ratio=Math.max(...steps)/Math.min(...steps);
  assert.ok(ratio<=1.2,`The lag cap must not periodically accelerate the model (${ratio.toFixed(3)}×)`);
  context.diagnostic(`fast-input velocity ratio: ${ratio.toFixed(3)}×`);
  f.settle();assert.equal(f.value,.1+.5*(1.5-1/inputHz));f.player.dispose();
});

for(const accelerating of [true,false])test(`a smoothly ${accelerating?'accelerating':'decelerating'} touch gesture stays monotonic and reaches its exact final input`,()=>{
  const f=fixture({initialProgress:.1}),values=[];let target=.1;
  const position=time=>accelerating?.1+.1*time+.4*time*time/3:.1+.5*time-.4*time*time/3;
  for(let tick=0;tick<90;tick++){
    if(tick%2===0){target=position(tick/60);f.player.set(target);}
    f.advance();values.push(f.value);
    assert.ok(target-f.value<=.025+1e-12,'Changing speed cannot violate the lag budget');
    assert.ok(f.value<=target+1e-12,'Changing speed cannot extrapolate');
  }
  const interior=values.slice(20,80);
  assert.ok(interior.slice(1).every((v,i)=>v>interior[i]),'Gradual speed changes must not freeze display frames');
  f.settle();assert.equal(f.value,target);f.player.dispose();
});

test('a reversed target behind the visual reverses on the next display frame without inertia overshoot',()=>{
  const f=fixture();f.player.set(.02);f.advance();const before=f.value;
  assert.ok(before>.004);f.player.set(.004);f.advance();
  assert.ok(f.value<before);assert.ok(f.value>=.004);
  f.settle();assert.equal(f.value,.004);f.player.dispose();
});

test('reversal within the old lag aligns to the latest target instead of coasting in the old direction',()=>{
  const f=fixture();f.player.set(.02);f.advance();assert.ok(f.value<.019);
  f.player.set(.019);assert.equal(f.value,.019,'Flush the small old-direction lag on reversal');
  assert.equal(f.frames.size,0);f.player.set(.018);f.advance();assert.ok(f.value<.019&&f.value>=.018);
  f.player.dispose();
});

test('settling emits the exact target and stops idle animation frames',()=>{
  const f=fixture();assert.equal(f.frames.size,0);f.player.set(.02);f.settle();
  assert.equal(f.value,.02);assert.equal(f.values.at(-1),.02);
  const calls=f.values.length;for(let i=0;i<10;i++)f.advance();
  assert.equal(f.values.length,calls);assert.equal(f.frames.size,0);f.player.dispose();
});

test('the first 120 Hz frame uses its actual 8.33 ms duration',()=>{
  const f=fixture({hz:120});f.player.set(.02);f.advance();
  assert.ok(f.value>.0025&&f.value<.003,'A 120 Hz frame must not receive a 16.67 ms startup kick');
  f.player.dispose();
});

test('hidden and suspended states cancel work, keep the latest input and resume at its current pose',()=>{
  const f=fixture();f.player.set(.02);f.advance();f.hidden(true);
  const calls=f.values.length;f.advance();assert.equal(f.frames.size,0);assert.equal(f.values.length,calls);
  f.player.set(.8);assert.equal(f.frames.size,0);f.advance();assert.equal(f.values.length,calls);
  f.hidden(false);f.player.resume();assert.equal(f.value,.8);assert.equal(f.frames.size,0);
  f.player.suspend();f.player.set(.4);f.advance();assert.equal(f.value,.8);assert.equal(f.frames.size,0);
  f.player.resume();assert.equal(f.value,.4);f.player.dispose();
});

test('immediate updates clamp to the timeline and disposal cancels future callbacks',()=>{
  const f=fixture();f.player.set(.02);f.player.set(.3,{immediate:true});
  assert.equal(f.value,.3);assert.equal(f.frames.size,0);
  f.player.set(2,{immediate:true});assert.equal(f.value,1);
  f.player.set(-1,{immediate:true});assert.equal(f.value,0);
  f.player.set(.02);const late=[...f.frames.values()][0];f.player.dispose();
  const calls=f.values.length;late(100);f.player.set(.9,{immediate:true});f.player.resume();
  assert.equal(f.values.length,calls);assert.equal(f.frames.size,0);
});

for(const inputHz of [30,60])test(`${inputHz} Hz exponential touch momentum restores an even cadence after a fast startup`,()=>{
  const f=fixture({initialProgress:.1}),values=[];let target=.1;
  for(let tick=0;tick<120;tick++){
    if(tick%(60/inputHz)===0){target=.1+.5*(1-Math.exp(-3*tick/60));f.player.set(target);}
    f.advance();values.push(f.value);
    assert.ok(f.value<=target+1e-12,'Momentum may not be extrapolated');
    assert.ok(target-f.value<=.025+1e-12,'Momentum remains within the lag budget');
  }
  const steps=values.slice(40,90).map((value,i)=>value-values[39+i]);
  assert.ok(steps.every(step=>step>0),'The still-moving momentum cannot freeze');
  const adjacent=steps.slice(1).map((step,i)=>Math.max(step,steps[i])/Math.min(step,steps[i]));
  assert.ok(Math.max(...adjacent)<1.25,`A decaying gesture must not pulse every other refresh (${Math.max(...adjacent).toFixed(3)}×)`);
  f.settle();assert.equal(f.value,target);f.player.dispose();
});

test('a fast gesture followed by idle does not poison the next slow gesture',()=>{
  const f=fixture({initialProgress:.1});
  for(let tick=0;tick<30;tick++){if(tick%2===0)f.player.set(.1+.8*tick/60);f.advance();}
  f.settle();f.advance(1000);const start=f.value,values=[];let target=start;
  for(let tick=0;tick<90;tick++){
    if(tick%2===0){target=start+.08*tick/60;f.player.set(target);}f.advance();values.push(f.value);
    assert.ok(f.value<=target+1e-12);assert.ok(target-f.value<=.025+1e-12);
  }
  const steps=values.slice(20,80).map((value,i)=>value-values[19+i]);
  assert.ok(steps.every(step=>step>0));
  assert.ok(Math.max(...steps)/Math.min(...steps)<1.2,'Old short-delay interpolation state cannot pulse the new gesture');
  f.settle();assert.equal(f.value,target);f.player.dispose();
});

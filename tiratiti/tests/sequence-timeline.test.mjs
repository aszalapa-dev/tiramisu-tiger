import {test} from 'node:test';
import assert from 'node:assert/strict';
let createSequenceTimeline;
try{({createSequenceTimeline}=await import('../sequence-timeline.js'));}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const metadata={rotationFrames:180,turns:2,rotationEnd:.68,openingStart:.70,openingEnd:.96,openingFrameStep:1/180,openingScale:.86,shrinkStart:.62,shrinkEnd:.70};
const make=(timeline=metadata,count=228)=>{
  assert.equal(typeof createSequenceTimeline,'function');
  return createSequenceTimeline({frames:Array(count),timeline});
};
const invert=value=>{let low=0,high=1;for(let i=0;i<40;i++){const t=(low+high)/2,s=t*t*t*(10+t*(-15+6*t));if(s<value)low=t;else high=t;}return (low+high)/2*.68;};

test('a uniform closed loop produces two turns while opening stays a separate segment',()=>{
  const t=make();
  assert.equal(t.pose(0).index,0);
  assert.equal(t.pose(invert(.125)).index,45);
  assert.equal(t.pose(.34).index,0,'The middle completes the first turn');
  assert.equal(t.pose(invert(.625)).index,45,'The second turn reuses identical rendered frames');
  assert.equal(t.pose(.68).index,0);assert.equal(t.pose(.69999).index,0);
  assert.equal(t.pose(.70).index,180);assert.equal(t.pose(.70+10/180).index,190);
  assert.equal(t.pose(.96).index,227);assert.equal(t.pose(1).index,227);
});

test('opening density and frame count come from metadata instead of a fixed length',()=>{
  const t=make({...metadata,openingFrameStep:1/360},275);
  assert.equal(t.pose(.70+10/360).index,190);assert.equal(t.pose(.96).index,274);
  assert.equal(t.pose(1).index,274);
});

test('render scale compensates the baked opening size without a seam',()=>{
  const t=make();
  assert.equal(t.pose(.62).scale,1);
  assert.ok(Math.abs(t.pose(.66).scale-.93)<1e-12);
  assert.ok(Math.abs(t.pose(.70-1e-8).scale-.86)<1e-10);
  assert.equal(t.pose(.70).scale,.86);
  assert.equal(t.frameScale(0),1);assert.equal(t.frameScale(180),.86);
  assert.equal(t.pose(.70).scale/t.frameScale(180),1);
});

test('rotation neighbours wrap in the travel direction and opening neighbours stay chronological',()=>{
  const t=make();
  const p=t.pose(invert(179/360));
  assert.equal(p.index,179);
  assert.deepEqual(t.neighbours(p,1,6),[179,0,1,2,178,3]);
  assert.deepEqual(t.neighbours(t.pose(0),-1,6),[0,179,178,177,1,176]);
  assert.deepEqual(t.neighbours(t.pose(.68),1,4),[0,180,181,182]);
  assert.deepEqual(t.neighbours(t.pose(.70),-1,4),[180,0,179,178]);
  assert.equal(t.distance(179,0),1);
});

test('legacy manifests remain linear with unmodified baked scale',()=>{
  const legacy=createSequenceTimeline({frames:Array(181)});
  assert.equal(legacy.pose(.5).index,90);assert.equal(legacy.pose(1).index,180);
  assert.equal(legacy.pose(.8).scale,1);assert.equal(legacy.frameScale(180),1);
  assert.equal(legacy.distance(0,180),180);
  assert.deepEqual(legacy.neighbours(legacy.pose(0),1,6),[0,1,2,3,4,5]);
});

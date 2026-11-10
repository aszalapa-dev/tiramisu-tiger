import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fitSequenceFrame} from '../sequence-framing.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../assets/motion-trial-20261107/manifest.json',import.meta.url)));

test('the full spoon and retained frames fit narrow, landscape and desktop viewports',()=>{
  for(const [width,height] of [[280,430],[350,490],[410,600],[640,260],[900,600],[1300,800]]){
    for(let target=0;target<240;target++)for(let held=0;held<240;held++){
      const scale=fitSequenceFrame(manifest,width,height,target/239,held);
      for(const index of [target,held]){
        assert.ok(2*manifest.framing.envelopes[index][0]*scale<=width+1e-8);
        assert.ok(2*manifest.framing.envelopes[index][1]*scale<=height+1e-8);
      }
    }
  }
});

test('legacy sequence dimensions keep their original containment and scale',()=>{
  assert.equal(fitSequenceFrame({width:800,height:950},400,500,.8,200),.5);
});

test('all 240 original alpha poses ship and start with a lightweight poster',()=>{
  const root=new URL('../',import.meta.url);
  const published=JSON.parse(fs.readFileSync(new URL('public-files.json',root)));
  assert.equal(manifest.frames.length,240);
  assert.equal(manifest.framing.envelopes.length,240);
  let total=0;
  for(const name of manifest.frames){
    const file='assets/motion-trial-20261107/'+name;
    assert.ok(published.includes(file));
    const bytes=fs.readFileSync(new URL(file,root));total+=bytes.length;
    assert.equal(bytes.toString('ascii',12,16),'VP8X');assert.ok(bytes[20]&16);
    assert.equal(bytes.readUIntLE(24,3)+1,960);assert.equal(bytes.readUIntLE(27,3)+1,996);
  }
  assert.ok(total<13_000_000);
  assert.ok(fs.statSync(new URL('assets/motion-trial-20261107/frame-001.webp',root)).size<60_000);
});

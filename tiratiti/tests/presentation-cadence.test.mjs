import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSequenceTimeline} from '../sequence-timeline.js';
import {createScrollPlayhead} from '../scroll-playhead.js';

// Test the resolution of the shipped poses, independently of decoder speed.
// A faster decoder cannot fill the gaps between sparse authored angles.
for(const profile of ['mobile','desktop'])for(const [segment,start] of [['rotation',.2],['opening',.72]]){
  test(`${profile} ${segment} has a new authored pose for each refresh during a slow continuous gesture`,async()=>{
    const manifest=JSON.parse(await readFile(new URL(`../assets/rendered-video-${profile}/manifest.json`,import.meta.url)));
    const timeline=createSequenceTimeline(manifest),frames=new Map(),indices=[];
    let clock=0,next=0,progress=start;
    const playhead=createScrollPlayhead({initialProgress:start,onProgress:p=>{progress=p;}},{
      now:()=>clock,isHidden:()=>false,
      schedule:fn=>{frames.set(++next,fn);return next;},cancel:id=>frames.delete(id)
    });
    for(let tick=0;tick<120;tick++){
      playhead.set(start+.08*tick/60);
      clock+=1000/60;
      const pending=[...frames];frames.clear();for(const [,fn] of pending)fn(clock);
      if(tick>=30&&tick<90)indices.push(timeline.pose(progress).index);
    }
    const advancing=indices.slice(1).filter((index,i)=>index!==indices[i]).length;
    assert.ok(advancing>=57,`Only ${advancing}/59 refreshes have a different pose; sparse source images still cause stepping`);
    playhead.dispose();
  });
}

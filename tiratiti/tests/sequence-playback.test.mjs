import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRenderedSequence} from '../sequence-playback.js';
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function fixture(supportsVideo=true){
 const calls=[],transitions=[];let errors=0,readyCount=0;
 function canvas(){return {dataset:{},cloneNode(){return canvas();},replaceWith(next){transitions.push(next);}};}
 const initial=canvas();
 const factory=backend=>options=>{
  const record={backend,options,poses:[],disposed:false};calls.push(record);
  return {ready:new Promise(()=>{}),render:p=>record.poses.push(p),dispose(){record.disposed=true;}};
 };
 const player=createRenderedSequence({canvas:initial,manifestUrl:'images/manifest.json',videoManifestUrl:'video/manifest.json',
  onFallback(){transitions.push('poster');},onCanvas(){transitions.push('canvas');},onReady(){readyCount++;},onError(){errors++;}},
  {supportsVideo,createVideo:factory('video'),createImages:factory('images')});
 return {player,calls,transitions,initial,get errors(){return errors;},get readyCount(){return readyCount;}};
}
test('supported video starts automatically at the latest scroll pose',async()=>{
 const f=fixture();f.player.render(.42);await flush();
 assert.equal(f.calls[0].backend,'video');assert.equal(f.calls[0].options.manifestUrl,'video/manifest.json');
 assert.deepEqual(f.calls[0].poses,[.42]);f.calls[0].options.onReady();assert.equal((await f.player.ready).backend,'video');
});
test('unsupported devices keep the image player and original canvas',async()=>{
 const f=fixture(false);await flush();assert.equal(f.calls[0].backend,'images');
 assert.equal(f.calls[0].options.canvas,f.initial);assert.equal(f.calls[0].options.manifestUrl,'images/manifest.json');assert.deepEqual(f.transitions,[]);
});
test('failed video automatically swaps to a fresh canvas at the latest pose',async()=>{
 const f=fixture();await flush();f.player.render(.78);const video=f.calls[0];
 video.options.onError(new Error('codec'));video.options.onError(new Error('duplicate'));await flush();
 assert.equal(f.calls.length,2);assert.ok(video.disposed);assert.notEqual(f.calls[1].options.canvas,f.initial);
 assert.deepEqual(f.calls[1].poses,[.78]);assert.equal(f.transitions[0],'poster');assert.equal(f.errors,0);
 video.options.onReady();assert.equal(f.readyCount,0);f.calls[1].options.onReady();assert.equal((await f.player.ready).backend,'images');
});
test('a later GPU failure restores the poster while its fallback loads',async()=>{
 const f=fixture();await flush();f.calls[0].options.onReady();await f.player.ready;
 f.player.render(.55);f.calls[0].options.onError(new Error('context lost'));await flush();
 assert.equal(f.transitions[0],'poster');assert.deepEqual(f.calls[1].poses,[.55]);
 f.calls[1].options.onReady();assert.equal(f.readyCount,2);
});
test('disposal ignores late callbacks and never starts a fallback',async()=>{
 const f=fixture();await flush();f.player.dispose();f.calls[0].options.onError(new Error('late'));f.calls[0].options.onReady();await flush();
 assert.equal(f.calls.length,1);assert.equal(f.readyCount,0);await assert.rejects(f.player.ready,{name:'AbortError'});
});
test('both backends failing reports one actionable error and stops retrying',async()=>{
 const f=fixture();await flush();f.calls[0].options.onError(new Error('video'));await flush();
 f.calls[1].options.onError(new Error('images'));f.calls[1].options.onError(new Error('duplicate'));await flush();
 assert.equal(f.errors,1);assert.equal(f.calls.length,2);await assert.rejects(f.player.ready,/images/);
});

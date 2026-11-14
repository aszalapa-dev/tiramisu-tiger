const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../privacy.js'),'utf8');
const KEY='tiratiti.privacy.v1', VERSION='2026-11-14.1', AGE=180*86400000;
function page({record,blocked=false,other={}}={}){
  let now=1800000000000,reloads=0;
  const storage=new Map(Object.entries(other));if(record!==undefined)storage.set(KEY,record);
  const windowEvents=new Map(),events=new Map(),nodes=[];
  const listen=(list,type,fn)=>{if(!list.has(type))list.set(type,[]);list.get(type).push(fn);};
  const emit=(list,event)=>{for(const fn of list.get(event.type)||[])fn(event);};
  function element(tag){const local=new Map(),checkbox={checked:false};return {tag,open:false,hidden:false,attributes:{},setAttribute(k,v){this.attributes[k]=v;},querySelector(){return checkbox;},addEventListener(t,fn){listen(local,t,fn);},close(){this.open=false;emit(local,{type:'close'});},showModal(){this.open=true;}};}
  const document={readyState:'complete',hidden:false,body:{append(...items){nodes.push(...items);}},createElement:element,addEventListener(t,fn){listen(events,t,fn);},dispatchEvent(event){emit(events,event);}};
  const window={location:{reload(){reloads++;}}};
  const localStorage={get length(){return storage.size;},key(i){return [...storage.keys()][i];},getItem(k){if(blocked)throw new Error('blocked');return storage.get(k)||null;},setItem(k,v){if(blocked)throw new Error('blocked');storage.set(k,v);},removeItem(k){if(blocked)throw new Error('blocked');storage.delete(k);}};
  vm.runInNewContext(source,{window,document,localStorage,Date:{now:()=>now},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},addEventListener(t,fn){listen(windowEvents,t,fn);}},{filename:'privacy.js'});
  return {api:window.TiratitiPrivacy,storage,nodes,document,get reloads(){return reloads;},advance(delta){now+=delta;},storageEvent(value){emit(windowEvents,{type:'storage',key:KEY,newValue:value});},click(attribute){emit(events,{type:'click',preventDefault(){},target:{closest(){return {hasAttribute(k){return k===attribute;}};}}});}};
}
const record=(mapbox,extra={})=>JSON.stringify({version:VERSION,mapbox,savedAt:1800000000000,expiresAt:1800000000000+AGE,...extra});
test('first visit defaults to no Mapbox, with no preference stored before a choice',()=>{
  const p=page();assert.equal(p.api.has('mapbox'),false);assert.equal(p.storage.has(KEY),false);assert.equal(p.nodes[0].hidden,false);
  p.api.open();assert.equal(p.nodes[1].open,true);assert.equal(p.nodes[1].querySelector().checked,false);
});
test('refuse and accept both save an explicit choice for no more than 180 days',()=>{
  for(const allowed of [false,true]){const p=page();p.click(allowed?'data-privacy-accept':'data-privacy-refuse');const saved=JSON.parse(p.storage.get(KEY));assert.equal(saved.mapbox,allowed);assert.equal(saved.expiresAt-saved.savedAt,AGE);assert.equal(p.api.has('mapbox'),allowed);assert.equal(p.nodes[0].hidden,true);}
});
test('personalisation stays off until the optional service is selected and saved',()=>{
  const p=page();p.api.open();p.click('data-privacy-save');assert.equal(p.api.has('mapbox'),false);
  p.api.open();p.nodes[1].querySelector().checked=true;p.click('data-privacy-save');assert.equal(p.api.has('mapbox'),true);assert.equal(p.nodes[1].open,false);
});
test('closing preferences never grants consent or changes an existing decision',()=>{
  const p=page();p.api.open();p.click('data-privacy-close');assert.equal(p.storage.has(KEY),false);assert.equal(p.api.has('mapbox'),false);
  const accepted=page({record:record(true)});accepted.api.open();accepted.nodes[1].querySelector().checked=false;accepted.click('data-privacy-close');assert.equal(accepted.api.has('mapbox'),true);
});
test('expired, malformed, altered lifetime, future and older-version preferences are rejected',()=>{
  for(const value of ['bad',record(true,{version:'old'}),record(true,{expiresAt:1800000000000}),record(true,{expiresAt:1800000000000+AGE+1}),record(true,{savedAt:1800000000001}),JSON.stringify({mapbox:true})]){
    const p=page({record:value,other:{'mapbox.eventData:test':'demo'}});assert.equal(p.api.has('mapbox'),false);assert.equal(p.nodes[0].hidden,false);assert.equal(p.storage.has('mapbox.eventData:test'),false);assert.equal(p.storage.has(KEY),false);
  }
});
test('stored acceptance and refusal survive a new page without changing the expiry',()=>{
  for(const allowed of [true,false]){const raw=record(allowed),p=page({record:raw});assert.equal(p.api.has('mapbox'),allowed);assert.equal(p.nodes[0].hidden,true);assert.equal(p.storage.get(KEY),raw);}
});
test('blocked browser storage still respects the explicit in-memory decision',()=>{
  const p=page({blocked:true});p.api.save(true);assert.equal(p.api.has('mapbox'),true);p.api.save(false);assert.equal(p.api.has('mapbox'),false);assert.equal(p.storage.has(KEY),false);
});
test('withdrawal clears only Mapbox identifiers and reloads only if its software has started',()=>{
  const p=page({record:record(true),other:{'mapbox.eventData:account':'x','mapbox.eventData.uuid:account':'x','mapbox.eventData.uuidTimestamp:account':'x','other-app':'keep'}});
  p.api.markExternalStarted('mapbox');p.api.save(false);assert.equal(p.reloads,1);assert.equal(p.storage.get('other-app'),'keep');assert.equal([...p.storage.keys()].filter(k=>k.startsWith('mapbox.eventData')).length,0);assert.equal(JSON.parse(p.storage.get(KEY)).mapbox,false);
  const fresh=page();fresh.api.save(false);assert.equal(fresh.reloads,0);
});
test('consent expiry revokes a running service and requests a fresh choice',()=>{
  const p=page({record:record(true)});p.api.markExternalStarted('mapbox');p.advance(AGE+1);assert.equal(p.api.has('mapbox'),false);assert.equal(p.reloads,1);assert.equal(p.storage.has(KEY),false);assert.equal(p.nodes[0].hidden,false);
});
test('withdrawal in another tab is applied to the currently running service',()=>{
  const p=page({record:record(true)});p.api.markExternalStarted('mapbox');p.storageEvent(record(false));assert.equal(p.api.has('mapbox'),false);assert.equal(p.reloads,1);
});
test('public pages have working legal destinations and no remotely loaded Google fonts',()=>{
  const root=path.resolve(__dirname,'..');
  const files=JSON.parse(fs.readFileSync(path.join(root,'public-files.json'),'utf8'));
  for(const name of ['index.html','revendeurs.html','mentions-legales.html','confidentialite.html','cookies.html']){
    const html=fs.readFileSync(path.join(root,name),'utf8');assert.ok(files.includes(name));
    for(const href of ['mentions-legales.html','confidentialite.html','cookies.html'])assert.ok(html.includes('href="'+href+'"'));
    assert.match(html,/data-privacy-open/);assert.match(html,/privacy\.js/);assert.doesNotMatch(html,/<(?:script|link)[^>]*(?:fonts\.googleapis|fonts\.gstatic|api\.mapbox)/);
  }
});
test('the contact form is unavailable until its local-only mail handlers are installed',()=>{
  const root=path.resolve(__dirname,'..');const html=fs.readFileSync(path.join(root,'revendeurs.html'),'utf8'),js=fs.readFileSync(path.join(root,'revendeurs.js'),'utf8');
  assert.match(html,/<fieldset id="dealer-fields" disabled>/);assert.ok(js.indexOf("event.preventDefault()")<js.indexOf(".disabled = false"));assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|sendBeacon/);assert.match(html,/href="confidentialite.html"/);
});

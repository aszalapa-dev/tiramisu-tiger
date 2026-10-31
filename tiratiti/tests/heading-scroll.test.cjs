const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../heading-scroll.js'),'utf8');

// Run the real page script with controlled viewport/visibility boundaries.
// Geometry reads and opacity writes are observable browser work, not timers.
function page({reduced=false}={}){
  const events=new Map(),documentEvents=new Map(),rafs=new Map(),operations=[],observers=[];
  let nextFrame=0;
  const listen=(map,name,callback)=>{if(!map.has(name))map.set(name,[]);map.get(name).push(callback);};
  const emit=(map,name)=>{for(const callback of map.get(name)||[])callback();};
  function element(tag='span'){
    const attributes=new Map(),style={};
    return {tag,children:[],attributes,
      style:new Proxy(style,{set(target,key,value){target[key]=value;if(key==='opacity')operations.push({type:'write',value});return true;}}),
      setAttribute(name,value){attributes.set(name,value);},removeAttribute(name){attributes.delete(name);},
      append(child){this.children.push(child);}
    };
  }
  const headings=[
    {id:'near',top:500,text:'LE BON TIRAMISU'},
    {id:'far',top:3000,text:'AUTRE\nTITRE'},
    {id:'above',top:-1000,text:'DÉJÀ PASSÉ'},
    {id:'hero',top:0,text:'HÉROS',excluded:true}
  ].map(data=>{
    const heading=Object.assign(element('h2'),data,{innerText:data.text});
    heading.setAttribute('data-reveal','');
    heading.closest=()=>heading.excluded?{}:null;
    heading.getBoundingClientRect=()=>{operations.push({type:'read',id:heading.id});return {top:heading.top,bottom:heading.top+80,height:80};};
    heading.textNode={textContent:data.text,replaceWith(fragment){heading.children=fragment.children;}};
    Object.defineProperty(heading,'words',{get(){return this.children.filter(child=>child.className==='heading-word');}});
    return heading;
  });
  const media={matches:reduced,addEventListener(name,callback){listen(events,'media:'+name,callback);}};
  const document={hidden:false,fonts:{ready:new Promise(()=>{})},
    querySelectorAll:()=>headings,createElement:element,
    createTextNode:text=>({textContent:text}),createDocumentFragment:()=>element('fragment'),
    createTreeWalker(heading){let done=false;return {nextNode(){if(done)return false;done=true;this.currentNode=heading.textNode;return true;}};},
    addEventListener(name,callback){listen(documentEvents,name,callback);}
  };
  class IntersectionObserver{
    constructor(callback,options){this.callback=callback;this.options=options;this.targets=new Set();observers.push(this);}
    observe(target){this.targets.add(target);}disconnect(){this.targets.clear();}
  }
  const context={document,NodeFilter:{SHOW_TEXT:4},IntersectionObserver,innerHeight:800,
    matchMedia:()=>media,addEventListener:(name,callback)=>listen(events,name,callback),
    requestAnimationFrame:callback=>{rafs.set(++nextFrame,callback);return nextFrame;},cancelAnimationFrame:id=>rafs.delete(id)};
  vm.runInNewContext(source,context,{filename:'heading-scroll.js'});
  const result={headings,operations,rafs,
    clear(){operations.length=0;},
    fire(name){emit(events,name);},
    frame(){const pending=[...rafs.values()];rafs.clear();for(const callback of pending)callback();},
    intersect(states){for(const observer of observers){const entries=[];for(const [id,isIntersecting] of Object.entries(states)){
      const target=headings.find(heading=>heading.id===id);if(observer.targets.has(target))entries.push({target,isIntersecting,boundingClientRect:{top:target.top,bottom:target.top+80,height:80}});
    }if(entries.length)observer.callback(entries);}},
    hidden(value){document.hidden=value;emit(documentEvents,'visibilitychange');},
    reduce(value){media.matches=value;emit(events,'media:change');},
    opacity(id){return headings.find(heading=>heading.id===id).words.map(word=>Number(word.style.opacity));}
  };
  return result;
}

test('offscreen headings do not read geometry, rewrite opacity or queue scroll frames',()=>{
  const p=page();p.intersect({near:false,far:false,above:false});p.frame();p.clear();
  for(let i=0;i<10;i++)p.fire('scroll');
  assert.equal(p.rafs.size,0);assert.deepEqual(p.operations,[]);
  p.fire('resize');assert.equal(p.rafs.size,0);assert.deepEqual(p.operations,[]);
});

test('only nearby headings are measured and every geometry read precedes opacity writes',()=>{
  const p=page();p.intersect({near:true,far:true,above:false});p.frame();
  p.headings[0].top=620;p.headings[1].top=500;p.clear();p.fire('scroll');p.frame();
  assert.deepEqual(p.operations.filter(op=>op.type==='read').map(op=>op.id),['near','far']);
  const firstWrite=p.operations.findIndex(op=>op.type==='write');
  assert.ok(firstWrite>=2);assert.ok(p.operations.slice(firstWrite).every(op=>op.type==='write'));
  p.clear();p.fire('scroll');p.frame();assert.equal(p.operations.filter(op=>op.type==='write').length,0,'The same pose does not rewrite any word');
  assert.equal(p.rafs.size,0,'Painting does not create an idle loop');
});

test('word reveals stay reversible and preserve the heading text and accessible name',()=>{
  const p=page();p.headings[0].top=700;p.intersect({near:true});p.frame();
  assert.deepEqual(p.opacity('near'),[.2,.2,.2],'Words wait until the heading reaches 80% of the viewport');
  p.headings[0].top=500;p.fire('scroll');p.frame();
  const halfway=p.opacity('near');assert.equal(halfway[0],1);assert.ok(Math.abs(halfway[1]-.6)<1e-10);assert.equal(halfway[2],.2);
  p.headings[0].top=0;p.fire('scroll');p.frame();assert.deepEqual(p.opacity('near'),[1,1,1]);
  p.headings[0].top=800;p.fire('scroll');p.frame();assert.deepEqual(p.opacity('near'),[.2,.2,.2]);
  const heading=p.headings[0];assert.equal(heading.attributes.get('aria-label'),'LE BON TIRAMISU');
  assert.equal(heading.children.map(child=>child.textContent).join(''),'LE BON TIRAMISU');
  assert.ok(heading.words.every(word=>word.attributes.get('aria-hidden')==='true'));
  assert.equal(p.headings[1].attributes.get('aria-label'),'AUTRE TITRE');
  assert.equal(p.headings[3].words.length,0,'The hero keeps its own animation');
});

test('leaving the viewport settles words without geometry reads and reentry uses the latest position',()=>{
  const p=page();p.intersect({near:true});p.frame();p.headings[0].top=-300;p.clear();
  p.intersect({near:false});p.frame();assert.deepEqual(p.opacity('near'),[1,1,1]);
  assert.equal(p.operations.filter(op=>op.type==='read').length,0);
  p.clear();p.fire('scroll');assert.equal(p.rafs.size,0);assert.deepEqual(p.operations,[]);
  p.headings[0].top=800;p.intersect({near:true});p.frame();assert.deepEqual(p.opacity('near'),[.2,.2,.2]);
});

test('a hidden page cancels pending work and restores reduced motion without measuring offscreen headings',()=>{
  const p=page();p.intersect({near:true,far:false,above:false});p.frame();p.clear();
  p.fire('scroll');assert.equal(p.rafs.size,1);p.hidden(true);assert.equal(p.rafs.size,0);
  p.fire('scroll');p.fire('resize');p.reduce(true);p.frame();assert.deepEqual(p.operations,[]);
  p.hidden(false);p.frame();assert.deepEqual(p.opacity('near'),[1,1,1]);assert.deepEqual(p.opacity('far'),[1,1]);
  assert.equal(p.operations.filter(op=>op.type==='read').length,0);
  p.clear();p.fire('scroll');assert.equal(p.rafs.size,0);assert.deepEqual(p.operations,[]);
  p.reduce(false);p.frame();assert.ok(Math.abs(p.opacity('near')[1]-.6)<1e-10);assert.deepEqual(p.opacity('far'),[.2,.2]);
  assert.deepEqual(p.operations.filter(op=>op.type==='read').map(op=>op.id),['near']);
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../interface.js'),'utf8').split('const dialog=')[0];

function page({width=390,height=700,reduced=false,coarse=true}={}){
  const events=new Map(),frames=new Map(),operations=[],observers=[];let frameId=0,time=0;
  const listen=(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);};
  const classes=()=>({values:new Set(),add(name){this.values.add(name);},contains(name){return this.values.has(name);}});
  function element(id){
    const values={};
    return {id,dataset:{},classList:classes(),children:[],
      style:new Proxy({setProperty(name,value){values[name]=value;operations.push({type:'write',id,name,value});},removeProperty(name){delete values[name];}},
        {set(target,name,value){target[name]=value;operations.push({type:'write',id,name,value});return true;}}),
      values,querySelectorAll:()=>[],hasAttribute:()=>false,
      getBoundingClientRect(){operations.push({type:'read',id});return {top:-context.scrollY,height:700};}
    };
  }
  const journey=element('journey'),scene=element('scene'),stream=element('stream'),stage=element('stage'),ingredients=element('ingredients'),decoration=element('decoration');
  journey.offsetHeight=3290;scene.clientHeight=700;scene.offsetHeight=700;
  const nodes={'.journey':journey,'.scene':scene,'.story-stream':stream,'#product-stage':stage,'#ingredients':ingredients};
  const media={matches:reduced,addEventListener:(name,fn)=>listen('reduce:'+name,fn)};
  const document={hidden:false,body:element('body'),documentElement:{classList:classes()},fonts:{ready:new Promise(()=>{})},
    querySelector:selector=>nodes[selector],querySelectorAll:()=>[decoration],addEventListener:listen};
  class IntersectionObserver{constructor(fn){this.fn=fn;observers.push(this);}observe(){}unobserve(){}}
  class ResizeObserver{constructor(fn){this.fn=fn;}observe(){}}
  const context={document,innerWidth:width,innerHeight:height,scrollY:0,IntersectionObserver,ResizeObserver,
    matchMedia:query=>query.includes('reduced')?media:{matches:coarse},getComputedStyle:()=>({marginTop:'-700px'}),
    addEventListener:listen,dispatchEvent:()=>{},CustomEvent:class{constructor(name,options){this.type=name;this.detail=options.detail;}},
    requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id)};
  vm.runInNewContext(source,context,{filename:'interface.js'});
  const p={context,stage,scene,journey,stream,operations,frames,
    fire(name){for(const fn of events.get(name)||[])fn();},
    step(){time+=16.67;const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(time);},
    scroll(y){context.scrollY=y;p.fire('scroll');p.step();},
    settle(){for(let i=0;frames.size&&i<400;i++)p.step();},
    resize(height,width=context.innerWidth){context.innerHeight=height;context.innerWidth=width;p.fire('resize');p.step();},
    active(){observers[1].fn([{target:decoration,isIntersecting:true}]);},
    clear(){operations.length=0;},progress(){return Number(stage.dataset.progress);}
  };
  p.step();return p;
}

test('native mobile momentum reaches the matching animation pose on the next frame',()=>{
  const p=page();p.scroll(1400);
  assert.ok(Math.abs(p.progress()-1400/1890)<1e-9,'A fast touch swipe must not leave the can catching up for seconds');
  assert.equal(p.frames.size,0,'No artificial catch-up frames after native scrolling');
  p.scroll(300);assert.ok(Math.abs(p.progress()-300/1890)<1e-9,'Reversing a swipe follows the same timeline');
});

test('Safari toolbar height changes do not retime a scene sized with svh',()=>{
  const p=page();p.scroll(1000);p.settle();const before=p.progress(),transform=p.stream.style.transform;
  p.resize(780);p.settle();
  assert.equal(p.progress(),before);assert.equal(p.stream.style.transform,transform);
  p.scene.clientHeight=800;p.scene.offsetHeight=800;p.journey.offsetHeight=3760;p.resize(800,844);p.settle();
  assert.ok(Math.abs(p.progress()-1000/2260)<1e-9,'Real layout/orientation changes still remeasure the timeline');
});

test('scroll geometry is read before hero and decorative style mutations',()=>{
  const p=page();p.active();p.step();p.clear();p.scroll(500);
  const firstWrite=p.operations.findIndex(op=>op.type==='write');
  assert.ok(firstWrite>=1);assert.ok(p.operations.slice(firstWrite).every(op=>op.type==='write'));
  assert.ok(p.stage.values['--stage-offset-y']!==undefined,'Can position uses a compositor transform offset');
});

test('unchanged native scroll positions do not rewrite hero transforms',()=>{
  const p=page();p.scroll(500);p.clear();p.scroll(500);
  assert.equal(p.operations.filter(op=>op.type==='write'&&['stream','stage'].includes(op.id)).length,0);
});

test('desktop wheel easing and reduced motion remain supported',()=>{
  const desktop=page({width:1440,height:700,coarse:false});desktop.scroll(1000);
  assert.ok(desktop.progress()>0&&desktop.progress()<1000/1890);desktop.settle();
  assert.ok(Math.abs(desktop.progress()-1000/1890)<.00002);
  const reduced=page({reduced:true});reduced.scroll(1000);
  assert.equal(reduced.progress(),0);assert.equal(reduced.stream.style.transform,'none');assert.equal(reduced.frames.size,0);
});

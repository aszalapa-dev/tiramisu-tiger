const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../store-map.js'),'utf8');
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};

function page({width=390,coarse=true,economical=false}={}){
  const windowEvents=new Map(),documentEvents=new Map(),timers=new Map(),observers=[];
  let clock=0,nextTimer=0;
  const listen=(map,name,callback)=>{if(!map.has(name))map.set(name,new Set());map.get(name).add(callback);};
  const unlisten=(map,name,callback)=>map.get(name)?.delete(callback);
  const fire=(map,name)=>{for(const callback of [...map.get(name)||[]])callback();};
  function element(tag='div'){
    const events=new Map();
    return {tag,children:[],attributes:new Map(),disabled:false,
      setAttribute(name,value){this.attributes.set(name,value);},
      addEventListener(name,callback){listen(events,name,callback);},
      append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}},
      replaceChildren(...nodes){this.children=[];this.append(...nodes);},
      remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);},
      fire(name){fire(events,name);}
    };
  }
  const map=element(),list=element(),notice=element(),head=element('head');
  const document={hidden:false,head,
    querySelector:selector=>({'#dealer-map':map,'#dealer-list':list,'#map-notice':notice})[selector],
    createElement:element,
    addEventListener:(name,callback)=>listen(documentEvents,name,callback),
    removeEventListener:(name,callback)=>unlisten(documentEvents,name,callback)
  };
  class IntersectionObserver{
    constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}
    observe(target){this.targets.add(target);}disconnect(){this.targets.clear();}
  }
  const window={TIRATITI_MAPBOX_TOKEN:'pk.test-browser-token',IntersectionObserver};
  const context={window,document,IntersectionObserver,innerWidth:width,
    navigator:{connection:{saveData:economical,effectiveType:economical?'2g':'4g'}},
    matchMedia:query=>({matches:query.includes('pointer')?coarse:false}),
    addEventListener:(name,callback)=>listen(windowEvents,name,callback),
    removeEventListener:(name,callback)=>unlisten(windowEvents,name,callback),
    setTimeout:(callback,delay)=>{timers.set(++nextTimer,{callback,due:clock+delay});return nextTimer;},
    clearTimeout:id=>timers.delete(id)
  };
  vm.runInNewContext(source,context,{filename:'store-map.js'});
  return {map,head,timers,
    enter(isIntersecting){for(const observer of observers)if(observer.targets.has(map))observer.callback([{target:map,isIntersecting}]);},
    scroll(){fire(windowEvents,'scroll');},
    hidden(value){document.hidden=value;fire(documentEvents,'visibilitychange');},
    advance(milliseconds){const end=clock+milliseconds;while(true){const next=[...timers.entries()].filter(([,timer])=>timer.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;clock=next[1].due;timers.delete(next[0]);next[1].callback();}clock=end;},
    click(){map.children.find(child=>child.tag==='button').fire('click');},
    scripts(){return head.children.filter(child=>child.tag==='script');}
  };
}

test('compact automatic map loading waits until the nearby scroll has settled',()=>{
  const p=page();p.enter(true);assert.equal(p.scripts().length,0);
  for(let i=0;i<12;i++){p.advance(100);p.scroll();assert.equal(p.scripts().length,0,'An ongoing swipe must not start the SDK');}
  p.advance(179);assert.equal(p.scripts().length,0);p.advance(1);assert.equal(p.scripts().length,1);
  assert.equal(p.timers.size,0);p.scroll();p.advance(500);assert.equal(p.scripts().length,1,'Only one automatic request starts');
});

test('leaving the nearby area cancels automatic startup until the next entry',()=>{
  const p=page();p.enter(true);p.advance(100);p.enter(false);assert.equal(p.timers.size,0);
  p.advance(1000);assert.equal(p.scripts().length,0);
  p.enter(true);p.advance(180);assert.equal(p.scripts().length,1);
});

test('the manual map button starts immediately and clears any pending automatic request',()=>{
  const p=page();p.enter(true);p.advance(40);p.click();assert.equal(p.scripts().length,1);assert.equal(p.timers.size,0);
  p.scroll();p.hidden(true);p.hidden(false);p.advance(1000);assert.equal(p.scripts().length,1);
});

test('desktop startup remains immediate while wide touch devices wait for quiet scrolling',()=>{
  const desktop=page({width:1280,coarse:false});desktop.enter(true);assert.equal(desktop.scripts().length,1);assert.equal(desktop.timers.size,0);
  const touch=page({width:1280,coarse:true});touch.enter(true);assert.equal(touch.scripts().length,0);touch.advance(180);assert.equal(touch.scripts().length,1);
});

test('a hidden page suspends pending startup and resumes the quiet period when visible',()=>{
  const p=page();p.enter(true);p.advance(100);p.hidden(true);assert.equal(p.timers.size,0);
  p.scroll();p.advance(1000);assert.equal(p.scripts().length,0);
  p.hidden(false);p.advance(179);assert.equal(p.scripts().length,0);p.advance(1);assert.equal(p.scripts().length,1);
});

test('data saving keeps automatic loading disabled and a failed manual load can retry',async()=>{
  const p=page({economical:true});p.enter(true);p.advance(1000);assert.equal(p.scripts().length,0);
  p.click();assert.equal(p.scripts().length,1);
  p.scripts()[0].fire('error');await flush();assert.equal(p.map.children.find(child=>child.tag==='button').disabled,false);
  p.click();assert.equal(p.scripts().length,1,'A fresh SDK element replaces the failed request immediately');
  assert.equal(p.timers.size,0);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const offline=fs.readFileSync(path.join(root,'downloads/Atlas_Demo_Offline.html'),'utf8');

function navLink(href,key){
  const attrs=new Map([['href',href]]);
  return {dataset:{view:key},classList:{toggle(){}},querySelector(){return null},
    getAttribute:name=>attrs.get(name)??null,
    setAttribute:(name,value)=>attrs.set(name,value),
    removeAttribute:name=>attrs.delete(name),
    current:()=>attrs.get('aria-current')==='page'};
}

test('Discover nested mobile More reflects the selected secondary workspace',()=>{
  const start=app.indexOf('function renderNav(){');
  const end=app.indexOf('\nfunction renderDock(){',start);
  assert.ok(start>=0&&end>start);
  const sections=['overview','dictionary','technologies','games','safety','papers','compare','saved','sources'];
  const desktop=sections.map(s=>navLink('#/'+s,s));
  const mobile=sections.map(s=>navLink('#/'+s,s));
  const more={open:false,querySelector:()=>mobile.slice(4).find(a=>a.current())||null};
  const rail={querySelectorAll:()=>desktop,querySelector:()=>desktop.find(a=>a.current())||null};
  const elements={navigation:rail,'additional-navigation':{open:false},breadcrumb:{textContent:''},
    'snapshot-date':{textContent:''}};
  const context={document:{title:'',querySelectorAll:()=>mobile,
      querySelector:()=>more},window:{ATLAS_OFFLINE:false},$:name=>elements[name],
    sets:{},notebook:{saved:[]},labels:Object.fromEntries(sections.map(s=>[s,s])),
    view:'overview',D:{meta:{research_checked_on:'2026-11-01'}},date:x=>x,renderDock(){}};
  vm.runInNewContext(app.slice(start,end),context);
  for(const section of ['safety','papers','compare','saved','sources']){
    context.view=section;
    context.renderNav();
    assert.equal(mobile.filter(a=>a.current()).length,1,section);
    assert.equal(mobile.find(a=>a.getAttribute('href')==='#/'+section).current(),true,section);
    assert.equal(more.open,true,section+' is visible within More');
  }
  context.view='overview';context.renderNav();
  assert.equal(mobile.filter(a=>a.current()).length,1,'No stale secondary state');
  assert.equal(mobile[0].current(),true);
});

test('single-file fallback embeds the shared navigation implementation',()=>{
  const start=app.indexOf('function renderNav(){');
  const end=app.indexOf('\nfunction renderDock(){',start);
  assert.ok(offline.includes(app.slice(start,end)));
});

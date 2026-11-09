'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const offline=fs.readFileSync(path.join(root,'downloads/Atlas_Demo_Offline.html'),'utf8');

const sectionNames={overview:'Discover',dictionary:'Concept dictionary',
  technologies:'Technology profiles',games:'Games',safety:'Safety observatory',
  papers:'Research library',compare:'Compare tools',saved:'Your notebook',
  sources:'Sources & coverage'};
function navLink(href,key){
  const attrs=new Map([['href',href]]);
  return {dataset:{view:key},classList:{toggle(){}},
    querySelector:selector=>selector==='span:not(.nav-count)'?{textContent:sectionNames[key]}:null,
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
  const more={open:false,dataset:{},querySelector:()=>mobile.slice(4).find(a=>a.current())||null};
  const desktopMore={open:false,dataset:{}};
  const rail={querySelectorAll:()=>desktop,querySelector:selector=>{
    const active=desktop.find(a=>a.current())||null;
    return selector.includes('span:not(.nav-count)')?active?.querySelector('span:not(.nav-count)'):active;
  }};
  const menuAttrs=new Map();
  const menuToggle={setAttribute:(key,val)=>menuAttrs.set(key,val),
    getAttribute:key=>menuAttrs.get(key)||null};
  const headerAttrs=new Map();
  const mobileHeading={dataset:{},
    setAttribute:(key,val)=>headerAttrs.set(key,val),
    getAttribute:key=>headerAttrs.get(key)||null,
    querySelector:()=>menuToggle};
  const elements={navigation:rail,'additional-navigation':desktopMore,breadcrumb:{textContent:''},
    'snapshot-date':{textContent:''}};
  const context={document:{title:'',querySelectorAll:()=>mobile,
      querySelector:selector=>selector==='.discover-mobile-chrome'?mobileHeading:more},
    window:{ATLAS_OFFLINE:false},$:name=>elements[name],
    sets:{},notebook:{saved:[]},labels:Object.fromEntries(sections.map(s=>[s,s])),
    view:'overview',D:{meta:{research_checked_on:'2026-11-01'}},date:x=>x,renderDock(){}};
  vm.runInNewContext(app.slice(start,end),context);
  for(const section of ['safety','papers','compare','saved','sources']){
    context.view=section;
    context.renderNav();
    assert.equal(mobile.filter(a=>a.current()).length,1,section);
    assert.equal(mobile.find(a=>a.getAttribute('href')==='#/'+section).current(),true,section);
    assert.equal(more.open,true,section+' is visible within More');
    assert.equal(desktopMore.open,true,section+' is visible in desktop More');
    assert.equal(mobileHeading.dataset.pageLabel,sectionNames[section]);
    assert.equal(mobileHeading.getAttribute('aria-label'),'AI Updates mobile header · '+sectionNames[section]);
    assert.equal(menuToggle.getAttribute('aria-label'),'Toggle navigation · '+sectionNames[section]);
  }
  context.view='overview';context.renderNav();
  assert.equal(mobile.filter(a=>a.current()).length,1,'No stale secondary state');
  assert.equal(mobile[0].current(),true);
  assert.equal(more.open,false,'Auto-opened mobile disclosure closes on primary navigation');
  assert.equal(desktopMore.open,false,'Auto-opened desktop disclosure closes on primary navigation');
  assert.equal(menuToggle.getAttribute('aria-label'),'Toggle navigation · Discover');
  // User-expanded disclosures must stay open across primary hash changes.
  more.open=true;desktopMore.open=true;
  context.view='dictionary';context.renderNav();
  assert.equal(more.open,true,'Manual mobile expansion preserved');
  assert.equal(desktopMore.open,true,'Manual desktop expansion preserved');
});

test('single-file fallback embeds the shared navigation implementation',()=>{
  const start=app.indexOf('function renderNav(){');
  const end=app.indexOf('\nfunction renderDock(){',start);
  assert.ok(offline.includes(app.slice(start,end)));
});

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


test('single-file navigation resolves the real daily archive rather than a nonexistent local sibling', () => {
  const generator = fs.readFileSync(path.join(root, 'scripts/build_offline.py'), 'utf8');
  assert.match(generator, /html = html\.replace\('href="whats-new\.html"'/);
  assert.equal((offline.match(/href="whats-new\.html"/g) || []).length, 0,
    'standalone archive route cannot resolve from a downloaded HTML file');
  const online = 'href="https://aiupdates.app/whats-new.html" title="Online daily archive; internet required"';
  assert.ok((offline.split(online).length - 1) >= 3, 'same primary archive route on mobile/desktop');
  assert.match(offline, /id="global-search" role="search"/, 'offline keeps its functional local search form');
  assert.match(offline, /href="#\/games"/, 'offline games still point to the real local route');
});

test('offline Discover story cards open their bundled catalog records, not missing downloaded siblings', () => {
  const discover = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const generator = fs.readFileSync(path.join(root, 'scripts/build_offline.py'), 'utf8');
  assert.match(generator, /def local_record_link\(match\):/);
  const hostedLinks = [...discover.matchAll(/href="(terms|technology)\/((?:MLD|TECH)-[0-9]{4})-[^"]+\.html"/g)];
  assert.ok(hostedLinks.length >= 7, 'Discover retains its human-readable featured record links');
  const counts = new Map();
  for (const [, family, recordId] of hostedLinks) {
    const route = '#/' + (family === 'terms' ? 'dictionary' : 'technologies') + '?record=' + recordId;
    counts.set(route, (counts.get(route) || 0) + 1);
  }
  for (const [route, count] of counts) {
    assert.equal(offline.split('href="' + route + '"').length - 1, count,
      'offline cards route to the existing local dialog: ' + route);
  }
  assert.doesNotMatch(offline, /href="(?:terms|technology)\//,
    'a downloaded HTML file must not navigate to nonexistent downloaded detail pages');
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('native and Discover More disclosures visibly retain the active secondary section in both viewport ranges',()=>{
  const css=read('site-chrome.css');
  const begin='/* atlas-current-secondary-parent:begin */',end='/* atlas-current-secondary-parent:end */';
  assert.equal(css.split(begin).length-1,1);
  assert.equal(css.split(end).length-1,1);
  const block=css.slice(css.indexOf(begin),css.indexOf(end)+end.length);
  assert.ok(block.includes('@media (min-width:651px)'));
  assert.ok(block.includes('@media (max-width:650px)'));
  assert.ok(block.includes('#navigation > details.nav-more'));
  assert.ok(block.includes('nav.site-chrome > details.site-chrome__more):has(a[aria-current]) > summary'));
  assert.ok(block.includes('.site-mobile-chrome__more:has(.site-mobile-chrome__more-links a[aria-current]) > summary'));
  assert.ok(block.includes('box-shadow:inset 3px 0 0'),'visible current indicator is not just open/hover');
  assert.equal(block.includes('aria-current="'),false,'parent is visual only, no second current link');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),'offline fallback uses exact shared CSS');
});

test('selected current secondary route remains the only current link in each native More disclosure',()=>{
  for(const [page,name] of [
    ['research.html','Research library'],
    ['demo.html','Guided professor demo'],
    ['terms/index.html','Concept encyclopedia'],
  ]){
    const html=read(page);
    for(const kind of ['site-mobile-chrome__more','site-chrome__more']){
      const at=html.indexOf('<details class="'+kind+'"');
      assert.ok(at>=0,page+' has '+kind);
      const markup=html.slice(at,html.indexOf('</details>',at));
      assert.ok(markup.includes('aria-current="location">'+name+'</a>'),page+' keeps selected '+name);
      assert.equal((markup.match(/aria-current=/g)||[]).length,1,page+' has one current child');
    }
  }
  const discover=read('index.html');
  const app=read('app.js');
  assert.ok(discover.includes('id="additional-navigation"'),'Discover retains canonical secondary rail');
  assert.ok(discover.includes('site-mobile-chrome__more'),'Discover retains nested mobile sections');
  assert.ok(app.includes('syncAutomaticDisclosure(mobileMore,!!mobileMore?.querySelector(\'a[aria-current="page"]\'))'),
    'live hash-route selection remains the source of truth');
});

test('shared Research link hydration routes live page families to one native workspace without breaking filtered and offline links',()=>{
  const vm=require('node:vm');
  const source=read('site-theme.js');
  const a='/* atlas-canonical-research-entry:begin */', b='/* atlas-canonical-research-entry:end */';
  assert.equal(source.split(a).length,2);
  assert.equal(source.split(b).length,2);
  assert.ok(source.includes('syncCanonicalResearchEntry();'), 'shared post-chrome handler runs after mobile links are created');
  const nativeStart=source.indexOf("  const chrome = document.querySelector('.site-mobile-chrome');");
  assert.ok(nativeStart>0 && source.slice(Math.max(0,nativeStart-320),nativeStart).includes('syncCanonicalResearchEntry();'), 'Discover normalization runs before native-only early return');
  const helper=source.split(a)[1].split(b)[0];
  function exercise(home, offline=false){
    const targets=[
      {href:home==='#/overview'?'#/papers':home.replace('index.html#/overview','index.html#/papers'),label:'Research library',nav:true},
      {href:home==='#/overview'?'#/papers':home.replace('index.html#/overview','index.html#/papers'),label:'Open the library ↗',cta:true},
      {href:'index.html#/papers?q=reward',label:'Filtered research search'},
    ];
    const links=targets.map(row=>({
      getAttribute:name=>name==='href'?row.href:null,
      setAttribute:(name,value)=>{if(name==='href')row.href=value},
      querySelector:()=>null, textContent:row.label,
      closest:()=>row.nav?{}:null,
      matches:selector=>selector==='.reading-link a.btn' && !!row.cta,
    }));
    vm.runInNewContext(helper+'\nsyncCanonicalResearchEntry();',{
      window:{ATLAS_OFFLINE:offline},
      document:{
        querySelector:()=>({getAttribute:()=>home}),
        querySelectorAll:()=>links,
      }
    });
    return targets.map(row=>row.href);
  }
  assert.deepEqual(exercise('#/overview'),['research.html','research.html','index.html#/papers?q=reward']);
  assert.deepEqual(exercise('index.html#/overview'),['research.html','research.html','index.html#/papers?q=reward']);
  assert.deepEqual(exercise('../index.html#/overview'),['../research.html','../research.html','index.html#/papers?q=reward']);
  assert.deepEqual(exercise('#/overview',true),['#/papers','#/papers','index.html#/papers?q=reward']);
  assert.ok(read('discovery.js').includes("window.ATLAS_OFFLINE?'#/papers':'research.html'"));
  assert.ok(read('index.html').includes('href="#/papers"'));
  assert.ok(read('terms/index.html').includes('href="../index.html#/papers"'));
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes('href="#/papers">Open the library'));
  assert.ok(offline.includes("window.ATLAS_OFFLINE?'#/papers':'research.html'"));
});

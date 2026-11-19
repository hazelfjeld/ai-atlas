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

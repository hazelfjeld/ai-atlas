'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('shared nav follows script-free cross-page hash fallback on desktop and mobile',()=>{
  const css=read('site-chrome.css'),html=read('index.html');
  const start='/* atlas-scriptless-current-visual:begin */',end='/* atlas-scriptless-current-visual:end */';
  assert.equal(css.split(start).length-1,1);
  assert.equal(css.split(end).length-1,1);
  const rules=css.split(start)[1].split(end)[0];
  for(const key of ['dictionary','technologies','games','safety','papers','compare','saved','sources']){
    assert.ok(html.includes('class="notice" id="/'+key+'"'),'existing target '+key);
    assert.ok(html.includes('data-view="'+key+'"'),'real primary/secondary destination '+key);
    assert.ok(rules.includes('.notice[id="/'+key+'"]:target)'),'native hash selection '+key);
    assert.ok(rules.includes('a.nav-link[data-view="'+key+'"]'),'desktop selection '+key);
    const mobileLink=key==='papers'?'.site-mobile-chrome__more-links > a:nth-of-type(2)':
      '.site-mobile-chrome__menu a[href="#/'+key+'"]';
    assert.ok(rules.includes(mobileLink),'same selected mobile link '+key);
  }
  assert.ok(rules.includes('color:#f5f7ef!important;background:#374b3c!important'),
    'the selected desktop route wins over the shared unselected hover override');
  assert.ok(rules.includes('#additional-navigation > summary'),'secondary section highlighted on closed More parent');
  assert.ok(rules.includes('a[href="#/overview"]'),'stale Discover highlight reset');
  assert.ok(rules.includes('@supports selector('),'progressive hash-only treatment');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'offline embeds the exact shared stylesheet without URL-rewrite drift');
});

test('script-free legacy aliases share the canonical desktop and mobile active treatment', () => {
  const css=read('site-chrome.css');
  const start=css.indexOf('/* atlas-scriptless-current-visual:begin */');
  const end=css.indexOf('/* atlas-scriptless-current-visual:end */');
  const rules=css.slice(start,end);
  for(const [canonical,alias] of [['dictionary','terms'],['safety','alerts'],['sources','coverage']]){
    assert.ok(rules.includes('html:is(:has(.nojs-primary-routes > .notice[id="/'+canonical+'"]:target),:has(.nojs-primary-routes > .notice[id="/'+alias+'"]:target))'));
    assert.ok(rules.includes('a.nav-link[data-view="'+canonical+'"]'));
    assert.ok(rules.includes('a[href="#/'+canonical+'"]'));
  }
});

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
    assert.ok(rules.includes('.site-mobile-chrome__menu a[href="'+(key==='papers'?'research.html':'#/'+key)+'"]'),
      'same selected mobile link '+key);
  }
  assert.ok(rules.includes('#additional-navigation > summary'),'secondary section highlighted on closed More parent');
  assert.ok(rules.includes('a[href="#/overview"]'),'stale Discover highlight reset');
  assert.ok(rules.includes('@supports selector('),'progressive hash-only treatment');
  // The existing offline builder rewrites canonical Research page links to the bundled hash workspace.
  const offlineCss=css.replace('.site-mobile-chrome__menu a[href="research.html"]',
                               '.site-mobile-chrome__menu a[href="#/papers"]');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(offlineCss),
    'offline rebuild matches the shared stylesheet after the canonical route rewrite');
});

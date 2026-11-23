const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'terms/manifest.json'),'utf8'));

test('first 134 concept pages keep native, contextual navigation with JavaScript disabled',()=>{
  for(let num=1;num<=134;num++){
    const id='MLD-'+String(num).padStart(4,'0');
    const record=manifest[id];
    assert.ok(record,id+' permanent route remains');
    const bytes=fs.readFileSync(path.join(root,record.path));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256,id+' manifest');
    const html=bytes.toString('utf8');
    const context=html.match(/data-page-label="([^"]+)"/)?.[1];
    const toggle=html.match(/<summary class="site-mobile-chrome__toggle" aria-label="([^"]+)"/)?.[1];
    assert.ok(context,id+' uses its real catalog title');
    assert.equal(toggle,'Toggle navigation · '+context,id+' is contextual before scripts');
    assert.equal((html.match(/class="site-chrome__links"/g)||[]).length,1,id+' has one shared desktop rail');
    assert.equal((html.match(/class="site-mobile-chrome__more-links"/g)||[]).length,1,id+' has one native secondary menu');
    assert.match(html,/href="\.\.\/index\.html#\/search"/,id+' preserves script-free search route');
    assert.match(html,/<footer class="site-chrome__footer">/,id+' retains global footer');
  }
});
test('concept first-paint labels come from the shared generator',()=>{
  const builder=fs.readFileSync(path.join(root,'scripts/build_term_pages.py'),'utf8');
  assert.match(builder,/first_paint_reference and int\(path\[10:14\]\) <= 134/);
  assert.match(builder,/expanded_concept or/);
});

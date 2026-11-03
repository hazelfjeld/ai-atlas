'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Deferred proposal review is linked and clearly not catalog publication',()=>{
 const page=read('catalog-review.html');
 const archive=read('whats-new.html');
 assert.match(archive,/href="catalog-review.html"/);
 assert.match(page,/<main id="main">/);
 assert.match(page,/<a class="skip" href="#main">/);
 assert.match(page,/Seven proposals, not seven new entries/);
 assert.match(page,/0 new canonical records/);
 const candidates=['InvokeAI','GDPx','NVIDIA Auto Ontology','Windmill','Agent harness','Semantic ontology layer','Environment-grounded agent benchmark'];
 for(const name of candidates)assert.ok(page.includes('<h3>'+name+'</h3>'),'Missing proposal: '+name);
 assert.equal((page.match(/<article class="card">/g)||[]).length,7);
 assert.match(page,/not independently reproduced/i);
 assert.match(page,/Initial release date remains unverified/);
});
test('Catalog review has working first-party citations and canonical links',()=>{
 const page=read('catalog-review.html');
 const links=[...page.matchAll(/\bhref="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(links.length>=20);
 for(const href of links){
  assert.ok(!href.startsWith('//')&&!href.includes('..')&&!href.includes('?ref='),'Unsafe href '+href);
  if(href.startsWith('https://')){assert.equal(new URL(href).protocol,'https:');continue}
  const target=href.split(/[?#]/)[0];if(!target)continue;
  assert.ok(fs.existsSync(path.join(root,target)),'Broken local route '+href);
 }
});

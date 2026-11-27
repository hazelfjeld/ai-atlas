const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const D=require('../daily-core.js');
test('November 27 edition preserves reviewed source dates, bytes and receipt',()=>{
 const index=D.validateIndex(JSON.parse(fs.readFileSync('data/daily/index.json','utf8')));
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
 const ref=index.editions.find(x=>x.path==='data/daily/editions/2026-11-27-v1.json');
 const receipts=ledger.receipts.filter(x=>x.batch_id==='atlas-daily-20261127-145246z-source-review-a');
 assert.equal(receipts.length,1);const r=receipts[0];assert.ok(ref);
 const buf=fs.readFileSync(ref.path);assert.equal(buf.length,ref.bytes);
 assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),ref.sha256);
 assert.equal(ref.sha256,'8623c84b489bc4a290921bd33f56be36b383db0b7524bcf9b3b101c16363488f');assert.equal(r.source_batch_sha256,'c5f8535c1e15a0f187e4d3038eae5161580f39e81a35981dbe38eaca43350559');assert.equal(r.source_batch_bytes,42684);
 const e=D.validateEdition(JSON.parse(buf),ref);assert.equal(e.news.length,12);
 assert.deepEqual(e.news.map(x=>x.id),r.accepted_news_ids);assert.equal(new Set(e.news.map(x=>x.source_url)).size,12);
 assert.equal(e.news.filter(x=>x.release_status==='preprint'&&x.submission_date==='2026-11-25'&&x.publication_date==='2026-11-26').length,6);
 assert.ok(e.news.every(x=>x.publication_date<e.edition_date));assert.equal(e.coverage.status,'partial');
 assert.deepEqual([e.technologies.length,e.terms.length,e.corrections.length,r.deferred_catalog_proposal_ids.length],[0,0,0,6]);
 assert.equal(index.last_successful_publish_at,[...ledger.receipts].reverse().find(x=>x.production_verified_at).production_verified_at);
 // The canonical register includes pending editions; the native preview
 // must expose only certified editions until deployment verification succeeds.
 const certified=new Set(ledger.receipts.filter(x=>x.production_verified_at)
   .map(x=>'data/daily/editions/'+x.publication_edition+'.json'));
 const byDate=new Map();
 for(const x of index.editions.filter(x=>certified.has(x.path))){
  if(!byDate.has(x.date)||byDate.get(x.date).revision<x.revision)byDate.set(x.date,x);
 }
 const recent=[...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
 const html=fs.readFileSync('whats-new.html','utf8');
 const preview=html.split('id="scriptfree-daily-archive"')[1].split('</section>')[0];
 assert.ok(preview.includes('href="data/daily/index.json"'));
 assert.equal(preview.includes('href="'+ref.path+'"'),recent.some(x=>x.path===ref.path));
 if(!r.production_verified_at)assert.ok(!preview.includes('data-edition-date="'+ref.date+'"'));
});

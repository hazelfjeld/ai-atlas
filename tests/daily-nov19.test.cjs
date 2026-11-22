const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Daily=require('../daily-core.js');

test('November 19 source-reviewed queue becomes exactly one immutable partially covered edition',()=>{
 const idx=Daily.validateIndex(JSON.parse(fs.readFileSync('data/daily/index.json','utf8')));
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
 const receipt=ledger.receipts.find(r=>r.batch_id==='atlas-daily-20261119-20261119t145814545z-review-a');
 assert.ok(receipt,'New batch has durable source receipt');
 assert.equal(ledger.receipts.filter(r=>r.batch_id===receipt.batch_id).length,1);
 assert.equal(receipt.source_batch_sha256,'b9e61406e081f130f556a17cec2b4668b9dc5afdad3c0ca5fd2e1984ee69086f');
 assert.equal(receipt.source_batch_bytes,47281);
 assert.equal(receipt.counts.news_published,14);
 assert.deepEqual([receipt.counts.technology_added,receipt.counts.term_added,receipt.counts.catalog_deferred],[0,0,7]);
 const entry=idx.editions.find(e=>e.date==='2026-11-19'&&e.revision===1);
 assert.ok(entry);
 const bytes=fs.readFileSync(entry.path);
 assert.equal(bytes.length,entry.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 const e=Daily.validateEdition(JSON.parse(bytes.toString('utf8')),entry);
 assert.equal(e.coverage.status,'partial');
 assert.equal(e.coverage.sources_failed.length,1);
 assert.equal(e.news.length,14);
 assert.equal(new Set(e.news.map(n=>n.id)).size,14);
 assert.ok(e.news.every(n=>n.source_record_id&&n.review_status&&n.caveat&&n.source_url.startsWith('https://')));
 assert.ok(e.news.some(n=>n.id.includes('mlperf')&&n.publication_date==='2026-11-16'&&n.event_date==='2026-11-18'),'Catch-up post retains distinct post/update dates');
 const html=fs.readFileSync('whats-new.html','utf8');
 assert.ok(html.includes('href="data/daily/index.json"'),
   'The script-free archive retains its durable complete edition register');
 assert.ok(idx.editions.some(x=>x.path===entry.path),
   'Historic November 19 permalink remains discoverable when it leaves the latest-three preview');
 assert.ok(fs.existsSync(entry.path),
   'The original immutable edition stays directly readable without JavaScript');
 assert.equal(receipt.publication_outcome,'immutable_revision_1_cloudflare_http_browser_and_githack_verified');
 assert.equal(receipt.production_commit,'75eb1d33811831f79c2c38fa6aa7a424025ee94c');
 assert.equal(receipt.production_workflow_run_id,44600094128);
 assert.equal(receipt.githack_workflow_run_id,44600094160);
 assert.ok(receipt.publication_history.some(h=>h.status==='cloudflare_http_browser_and_githack_verified'&&h.verified_at===receipt.production_verified_at));
 // An independently verified historic receipt stays verified when a newer
 // source-reviewed edition is committed but certification remains pending.
 const lastVerified=ledger.receipts.filter(r=>r.production_verified_at).at(-1);
 assert.equal(receipt.production_verified_at,'2026-11-19T19:50:08Z',
   'November 19 retains its original independent production certification');
 assert.ok(Date.parse(lastVerified.production_verified_at)>=Date.parse(receipt.production_verified_at),
   'Newer certified releases may advance the clock without invalidating November 19');
 assert.equal(idx.last_successful_publish_at,lastVerified.production_verified_at,
   'A pending edition cannot advance the production-verified publication clock');
 const newestReceipt=ledger.receipts.at(-1),newestEdition=idx.editions.at(-1);
 assert.equal(newestReceipt.publication_edition,newestEdition.date+'-v'+newestEdition.revision);
 assert.equal(idx.status,'edition_revision_'+newestEdition.revision+'_'+
   (newestReceipt.production_verified_at?'production_verified':'pending_production_verification'));
 assert.equal(receipt.counts.catalog_deferred,7,'Public verification must not promote deferred proposals');
});

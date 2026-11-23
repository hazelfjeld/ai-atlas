'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),Core=require('../daily-core.js');
test('November 22 edition stays hash pinned, source reviewed and idempotently receipted',()=>{
 const ix=Core.validateIndex(JSON.parse(fs.readFileSync('data/daily/index.json','utf8')));
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
 const batch='atlas-daily-20261122-primary-reviewed-bounded-0820ct-a';
 assert.equal(ledger.receipts.filter(r=>r.batch_id===batch).length,1);
 const r=ledger.receipts.find(r=>r.batch_id===batch),entry=ix.editions.find(e=>e.date==='2026-11-22'&&e.revision===1);
 assert.ok(entry);
 assert.equal(r.source_batch_sha256,'1cb4ba6667df152a5bf91909fc619f377210516482a5e23e92d9f85656fcac63');
 const b=fs.readFileSync(entry.path);
 assert.equal(b.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),entry.sha256);
 const edition=Core.validateEdition(JSON.parse(b.toString('utf8')),entry);
 assert.equal(edition.news.length,8);
 assert.deepEqual(edition.news.map(x=>x.id),r.accepted_news_ids);
 assert.equal(new Set(edition.news.map(x=>x.source_record_id)).size,8);
 assert.equal(edition.news.filter(x=>x.publication_date==='2026-11-22').length,0);
 assert.ok(edition.news.every(x=>x.review_status.startsWith('publisher_reviewed_')&&x.source_url.startsWith('https://')));
 assert.deepEqual([edition.technologies.length,edition.terms.length,edition.corrections.length],[0,0,0]);
 assert.deepEqual([r.counts.news_deferred,r.counts.catalog_deferred],[3,7]);
 assert.equal(edition.coverage.status,'partial');
 assert.ok(edition.coverage.sources_failed.length>=6);
 assert.ok(r.production_verified_at,'The November 22 release remains certified');
 const latestReceipt=ledger.receipts.at(-1);
 assert.equal(ix.status,'edition_revision_'+ix.editions.at(-1).revision+'_'+(latestReceipt.production_verified_at?'production_verified':'pending_production_verification'));

 const lastVerified=ledger.receipts.filter(x=>x.production_verified_at).at(-1);
 assert.equal(ix.last_successful_publish_at,lastVerified.production_verified_at);
});

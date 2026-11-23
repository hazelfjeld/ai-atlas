'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),Core=require('../daily-core.js');
test('November 23 queue is checksum-pinned, source-reviewed, idempotent and accessible without scripts',()=>{
const index=Core.validateIndex(JSON.parse(fs.readFileSync('data/daily/index.json','utf8'))),ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
const r=ledger.receipts.find(x=>x.batch_id==='atlas-daily-20261123-20261123t20261123t144537778z-source-review-a');assert.ok(r);assert.equal(ledger.receipts.filter(x=>x.batch_id===r.batch_id).length,1);
assert.equal(r.source_batch_sha256,'8350a6df242e04b443e2f964442a72b49fe5e0968b53e550643bb81bca767c6d');assert.equal(r.source_batch_bytes,49126);
const entry=index.editions.find(x=>x.date==='2026-11-23'&&x.revision===1);assert.ok(entry);
const raw=fs.readFileSync(entry.path);assert.equal(raw.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),entry.sha256);
const e=Core.validateEdition(JSON.parse(raw),entry);assert.equal(e.news.length,9);assert.deepEqual(e.news.map(n=>n.id),r.accepted_news_ids);
assert.deepEqual([e.news.filter(n=>n.publication_date===e.edition_date).length,e.technologies.length,e.terms.length,e.corrections.length,r.counts.news_deferred,r.counts.catalog_deferred],[1,0,0,0,1,11]);
assert.equal(e.coverage.status,'partial');assert.ok(e.coverage.sources_failed.length>=5);
assert.ok(e.news.every(x=>x.review_status.startsWith('publisher_reviewed_')&&x.source_url.startsWith('https://')&&x.caveat));
assert.ok(r.deferred_news_ids.some(x=>x.includes('us-banks-tighten')));
const html=fs.readFileSync('whats-new.html','utf8');assert.match(html,/data-edition-date="2026-11-23"/);assert.ok(html.includes('href="'+entry.path+'"'));
const lastVerified=ledger.receipts.filter(x=>x.production_verified_at).at(-1);assert.equal(index.last_successful_publish_at,lastVerified.production_verified_at);
assert.equal(index.status,'edition_revision_1_'+(r.production_verified_at?'production_verified':'pending_production_verification'));
});

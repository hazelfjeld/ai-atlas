'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const Daily=require('../daily-core.js');

test('November 21 edition is SHA-256 pinned, source-reviewed and not prematurely certified',()=>{
 const index=Daily.validateIndex(JSON.parse(fs.readFileSync('data/daily/index.json','utf8')));
 const receipts=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts;
 const batch='atlas-daily-20261121-20261121141437554-source-review-a';
 const receipt=receipts.find(r=>r.batch_id===batch);
 assert.equal(receipts.filter(r=>r.batch_id===batch).length,1,'Collector handoff has exactly one production receipt');
 assert.equal(receipt.source_batch_sha256,'4cfd97f0d01165e5b291ed49b265d20e72fefe4652dee1f4024e6abb2b9cc5f5');
 assert.equal(receipt.source_batch_bytes,54922);
 assert.equal(receipt.source_commit,'e7a94043ba9d2237bb86300a330178a1d136bb1a');
 const entry=index.editions.find(e=>e.date==='2026-11-21'&&e.revision===1);
 assert.ok(entry,'Dated immutable edition exists');
 const bytes=fs.readFileSync(entry.path);
 assert.equal(bytes.length,entry.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 const edition=Daily.validateEdition(JSON.parse(bytes.toString('utf8')),entry);
 assert.equal(edition.news.length,14);
 assert.deepEqual(edition.news.map(n=>n.id),receipt.accepted_news_ids);
 assert.equal(new Set(edition.news.map(n=>n.source_record_id)).size,14);
 assert.equal(new Set(edition.news.map(n=>n.source_url)).size,14);
 assert.ok(edition.news.every(n=>n.review_status.startsWith('publisher_reviewed_')&&n.caveat&&n.summary));
 assert.ok(edition.news.every(n=>n.source_url.startsWith('https://')&&n.publication_date<=edition.edition_date));
 assert.ok(edition.news.some(n=>n.publication_date===edition.edition_date));
 assert.ok(edition.news.some(n=>n.publication_date<'2026-11-21'),'Catch-up must retain its original publication date');
 assert.deepEqual([edition.technologies.length,edition.terms.length,edition.site_changes.length,edition.corrections.length],[0,0,0,0]);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,10);
 assert.deepEqual([receipt.counts.news_published,receipt.counts.technology_added,receipt.counts.term_added],[14,0,0]);
 assert.equal(edition.coverage.status,'partial');
 assert.equal(edition.coverage.sources_failed.length,1);
 assert.ok(receipt.publication_history.some(h=>h.status==='pending_production_verification'));
 const historicReceipt=receipts.find(r=>r.publication_edition==='2026-11-21-v1');
 assert.ok(historicReceipt.production_verified_at,
   'November 21 preserves its independent production certification after later editions');
 const active=index.editions.at(-1),activeReceipt=receipts.find(r=>r.publication_edition===active.date+'-v'+active.revision);
 assert.ok(activeReceipt,'Current indexed edition must have a receipt');
 assert.equal(index.status,'edition_revision_'+active.revision+'_'+
   (activeReceipt.production_verified_at?'production_verified':'pending_production_verification'),
   'The current archive banner follows the newest edition, never overwrites Nov 21 history');
 const latestVerified=receipts.filter(r=>r.production_verified_at).at(-1);
 assert.equal(index.last_successful_publish_at,latestVerified.production_verified_at);
 const sourceFree=fs.readFileSync('whats-new.html','utf8');
 assert.ok(sourceFree.includes('data/daily/index.json'),'No-JS access to immutable index remains');
});

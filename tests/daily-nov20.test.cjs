'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const D=require('../daily-core.js');
test('November 20 queued evidence is a single integrity-checked, dated edition',()=>{
 const index=D.validateIndex(JSON.parse(fs.readFileSync('data/daily/index.json','utf8')));
 const receipts=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts;
 const id='atlas-daily-20261120-20261120t144529290z-primary-review-a';
 const receipt=receipts.find(r=>r.batch_id===id);
 assert.ok(receipt);
 assert.equal(receipts.filter(r=>r.batch_id===id).length,1);
 assert.equal(receipt.source_batch_sha256,'e8f6ae539c87d7b7a02f2b4ecc2cac6ef5657f524c999c3a2ac6154705896e63');
 assert.equal(receipt.source_batch_bytes,51634);
 assert.equal(receipt.source_commit,'c0e135e08c874b7d6dc0df103c02e23f19fa5453');
 const entry=index.editions.find(e=>e.date==='2026-11-20'&&e.revision===1);
 assert.ok(entry);
 const bytes=fs.readFileSync(entry.path);
 assert.equal(bytes.length,entry.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 const edition=D.validateEdition(JSON.parse(bytes.toString('utf8')),entry);
 assert.equal(edition.news.length,15);
 assert.deepEqual(edition.news.map(n=>n.id),receipt.accepted_news_ids);
 assert.equal(new Set(edition.news.map(n=>n.id)).size,15);
 assert.equal(new Set(edition.news.map(n=>n.source_url)).size,15);
 assert.ok(edition.news.every(n=>n.review_status.startsWith('publisher_reviewed_')&&n.caveat&&n.source_record_id&&n.source_url.startsWith('https://')));
 assert.deepEqual([edition.technologies.length,edition.terms.length,edition.corrections.length,receipt.counts.catalog_deferred],[0,0,0,10]);
 assert.equal(edition.coverage.status,'partial');
 assert.equal(edition.coverage.sources_failed.length,1);
 assert.ok(edition.news.some(n=>n.publication_date==='2026-11-14'));
 assert.ok(edition.news.some(n=>n.review_status.includes('reuters_reporting_attributed')));
 assert.ok(receipt.publication_history.some(h=>h.status==='pending_production_verification'));
 // A deployed reviewed edition must advance the shared archive clock only
 // after exact-revision GitHack, Cloudflare HTTP, and hosted browsers succeed.
 assert.equal(receipt.publication_outcome,'immutable_revision_1_cloudflare_http_browser_and_githack_verified');
 assert.equal(receipt.production_verified_at,'2026-11-20T15:15:36Z');
 assert.equal(receipt.production_verified_revision,1);
 assert.equal(receipt.production_commit,'e6e8a94abb72fd3ba53fe3632684e88249a37c29');
 assert.equal(receipt.production_workflow_run_id,44759028003);
 assert.equal(receipt.githack_workflow_run_id,44759028287);
 assert.equal(receipt.last_verified_public_url,'https://aiupdates.app/whats-new.html?date=2026-11-20&revision=1');
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-20-v1'&&h.status==='cloudflare_http_browser_and_githack_verified'&&h.verified_at===receipt.production_verified_at));
 // Historical production evidence remains certified even after newer
 // editions enter the index in a pending state.
 assert.ok(index.editions.some(e=>e.path===entry.path));
 const lastVerified=receipts.filter(r=>r.production_verified_at).at(-1);
 assert.equal(index.last_successful_publish_at,lastVerified.production_verified_at);
 const latest=index.editions.at(-1);
 const latestReceipt=receipts.find(r=>r.publication_edition===latest.date+'-v'+latest.revision);
 assert.ok(latestReceipt,'Every indexed edition needs its source-batch receipt');
 assert.equal(index.status,'edition_revision_'+latest.revision+
  (latestReceipt.production_verified_at?'_production_verified':'_pending_production_verification'));
 const archive=fs.readFileSync('whats-new.html','utf8');
 assert.ok(archive.includes('href="data/daily/index.json"'),
  'Script-free visitors can inspect the immutable archive register');
});

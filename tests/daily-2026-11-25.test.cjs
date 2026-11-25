const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const D=require('../daily-core.js');
test('November 25 source-reviewed edition retains immutable bytes, distinct dates and idempotent receipt',()=>{
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
 const ref=idx.editions.find(x=>x.path==='data/daily/editions/2026-11-25-v1.json');
 const rs=ledger.receipts.filter(x=>x.batch_id==='atlas-daily-20261125-20261125t144215229z-primary-review-a');
 assert.equal(rs.length,1);const r=rs[0];assert.ok(ref);
 const buf=fs.readFileSync(ref.path);assert.equal(buf.length,ref.bytes);assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),ref.sha256);assert.equal(ref.sha256,'525b0375f86fd0592de307a49764c5514b9de342c8dcff2d0db08ee7c505be0b');
 assert.equal(r.source_batch_sha256,'d4b31f2817d4ade96c20a166e9f45f94a49c1643126cfd4baf2279c0fd7eb9e5');assert.equal(r.source_batch_bytes,41837);
 const e=D.validateEdition(JSON.parse(buf),ref);assert.equal(e.news.length,11);assert.deepEqual(e.news.map(x=>x.id),r.accepted_news_ids);
 assert.equal(new Set(e.news.map(x=>x.source_url)).size,11);assert.equal(e.news.filter(x=>x.publication_date==='2026-11-25'&&x.submission_date==='2026-11-24'&&x.release_status==='preprint').length,7);
 assert.equal(e.news.filter(x=>x.publication_date==='2026-11-24').length,4);assert.equal(e.coverage.status,'partial');assert.ok(e.coverage.sources_failed.length);
 assert.deepEqual([e.technologies.length,e.terms.length,e.corrections.length,r.deferred_catalog_proposal_ids.length],[0,0,0,7]);
 const latest=[...ledger.receipts].reverse().find(x=>x.production_verified_at);assert.equal(idx.last_successful_publish_at,latest.production_verified_at);
 assert.ok(fs.readFileSync('whats-new.html','utf8').includes('href="data/daily/index.json"'));
});

test('certified November 25 receipt preserves exact production evidence and source-linked native preview',()=>{
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')),r=ledger.receipts.find(x=>x.batch_id==='atlas-daily-20261125-20261125t144215229z-primary-review-a');
 assert.equal(r.production_verified_at,'2026-11-25T15:47:36Z');assert.equal(r.production_commit,'df87a21fb0944ea8aa4f2ac933c87435ec270653');assert.equal(r.production_workflow_run_id,45645574966);assert.equal(r.githack_workflow_run_id,45645574964);assert.equal(r.publication_history.at(-1).status,'cloudflare_http_browser_and_githack_verified');
 if(ledger.receipts.filter(x=>x.production_verified_at).at(-1)===r){
 const html=fs.readFileSync('whats-new.html','utf8'),section=html.match(/<section class="site-static-fallback" id="scriptfree-daily-archive"[\s\S]*?<\/section>/)[0];
 assert.ok(section.includes('data-edition-date="2026-11-25"'));assert.ok(section.includes('edition (11 reports total).'));
 const e=JSON.parse(fs.readFileSync('data/daily/editions/2026-11-25-v1.json','utf8'));
 for(const n of e.news.slice(0,3)){assert.ok(section.includes('href="'+n.source_url+'"'));assert.ok(section.includes('Source published '+n.publication_date));}
 for(const d of [25,24,23])assert.ok(section.includes('href="data/daily/editions/2026-11-'+d+'-v1.json"'));
 }
});

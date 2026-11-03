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
 assert.match(page,/not (?:been )?independently reproduced/i);
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

test('Dated candidate audit is machine-readable, source-attributed and not a catalog import',()=>{
 const audit=JSON.parse(read('data/catalog-candidate-decisions-2026-11-03.json'));
 const receipt=JSON.parse(read('data/daily/published-batches.json')).receipts[0];
 const pages=JSON.parse(read('terms/manifest.json'));
 const actualIds=[
  'tech-proposal:invokeai:2026-11-02',
  'tech-proposal:gdpx:2026-11-02',
  'tech-proposal:nvidia-auto-ontology:2026-11-02',
  'tech-proposal:windmill:2026-11-02',
  'term-proposal:agent-harness',
  'term-proposal:semantic-ontology-layer',
  'term-proposal:environment-grounded-agent-benchmark'
 ];
 assert.equal(audit.schema,1);
 assert.equal(audit.document_type,'editorial_candidate_triage_with_one_canonical_addition');
 assert.equal(audit.published_canonical_additions,1);
 assert.equal(audit.reviewed_proposals,7);
 assert.equal(audit.independent_product_or_benchmark_replication,false);
 assert.equal(audit.source_batch.batch_id,receipt.batch_id);
 assert.equal(audit.source_batch.source_sha256,receipt.source_batch_sha256);
 assert.equal(audit.collection_edition_date,'2026-11-02');
 assert.equal(audit.reviewed_on,'2026-11-03');
 assert.deepEqual(audit.candidates.map(c=>c.proposal_id),actualIds);
 assert.equal(new Set(actualIds).size,7);
 for(const item of audit.candidates){
  assert.ok(['deferred_not_in_canonical_catalog','canonical_catalog_added_new_to_atlas'].includes(item.publication_state));
  assert.ok(['technology','term'].includes(item.kind));
  assert.ok(item.editorial_basis.length>=65 && item.limitations.length>=65);
  assert.ok(item.evidence_scope.length>=50);
  assert.ok(item.required_before_catalog_publication.length>=3);
  assert.ok(item.required_before_catalog_publication.every(x=>typeof x==='string'&&x.length>=25));
  assert.ok(item.related_existing_term_ids.length>=1);
  for(const id of item.related_existing_term_ids) assert.ok(pages[id], 'Missing related canonical term '+id);
  assert.ok(item.primary_sources.length>=1);
  for(const source of item.primary_sources){
   assert.ok(source.title.length>=15);
   const parsed=new URL(source.url);
   assert.equal(parsed.protocol,'https:');
   assert.ok(!parsed.username&&!parsed.password&&!parsed.hash,'Unsafe evidence URL '+source.url);
  }
 }
 assert.equal(audit.candidates.filter(c=>c.disposition==='composite_phrase_no_new_id').length,1);
 assert.equal(audit.candidates.filter(c=>c.disposition!=='composite_phrase_no_new_id').length,6);
});
test('Candidate audit is linked from the accessible review page and shipped in the static package',()=>{
 const page=read('catalog-review.html');
 const file='data/catalog-candidate-decisions-2026-11-03.json';
 assert.match(page,/href="data\/catalog-candidate-decisions-2026-11-03\.json" download/);
 assert.match(page,/<th scope="col">Proposal<\/th>/);
 assert.match(page,/<table class="decision-matrix">/);
 assert.match(page,/1 new technology ID \(TECH-0301\), 0 new term IDs/);
 const deployed=JSON.parse(read('deploy/public-files.json'));
 assert.ok(deployed.extra_downloads.includes(file),'Audit export must survive Cloudflare allowlisting');
 assert.ok(fs.statSync(path.join(root,file)).size>5000,'Audit export must contain substantive sourced records');
});

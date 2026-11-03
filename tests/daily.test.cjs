const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../daily-core.js');
function index(entries=[]){return {schema:1,timezone:'America/Chicago',editions:entries,last_successful_publish_at:null};}
const entry=(date,revision=1)=>({date,revision,path:'data/daily/editions/'+date+'-v'+revision+'.json',sha256:'a'.repeat(64),bytes:900,published_at:date+'T15:00:00Z'});
function edition(){
 return {schema:1,timezone:'America/Chicago',edition_date:'2026-11-02',published_at:'2026-11-02T15:00:00Z',coverage:{start:'2026-11-01T14:00:00Z',end:'2026-11-02T14:00:00Z',status:'partial',sources_checked:[{url:'https://arxiv.org'}],sources_failed:[{url:'https://example.org',reason:'timeout'}]},tldr:['Several official sources were checked.','Coverage is incomplete due to a source failure.'],news:[],technologies:[],terms:[],site_changes:[],corrections:[]};
}
test('America/Chicago date handles late-night UTC and daylight-saving rollover',()=>{
 assert.equal(D.chicagoDate('2026-11-02T05:30:00Z'),'2026-11-01');
 assert.equal(D.chicagoDate('2026-11-02T06:30:00Z'),'2026-11-02');
 assert.equal(D.chicagoDate('2026-03-08T07:59:00Z'),'2026-03-08');
 assert.equal(D.chicagoDate('2026-03-09T04:30:00Z'),'2026-03-08');
});
test('Archive index accepts empty first edition state without claiming news',()=>{
 const i=D.validateIndex(index());assert.deepEqual(D.selection(i,'2026-11-01').archive,[]);assert.equal(D.selection(i,'2026-11-01').todayEntry,null);
});
test('Archive selects newest revision for actual today and newest historical date separately',()=>{
 const i=index([entry('2026-11-01'),entry('2026-11-01',2),entry('2026-11-02')]);
 assert.equal(D.selection(i,'2026-11-01').todayEntry.revision,2);
 assert.equal(D.selection(i,'2026-11-01').latest.date,'2026-11-02');
 assert.equal(D.selection(i,'2026-11-03').todayEntry,null);
 assert.equal(D.selection(i,'2026-11-03').latest.date,'2026-11-02');
});
test('Edition validation detects corrupt and duplicate archive metadata',()=>{
 assert.throws(()=>D.validateIndex(index([entry('2026-11-31')])),/Invalid archive date/);
 assert.throws(()=>D.validateIndex(index([entry('2026-11-02'),entry('2026-11-02')])),/Duplicate edition/);
 assert.throws(()=>D.validateIndex(index([{...entry('2026-11-02'),path:'../../secrets.json'}])),/archive file path/);
 assert.throws(()=>D.validateIndex(index([{...entry('2026-11-02'),sha256:'xyz'}])),/checksum/);
});
test('Evidence, partial-source-health and zero-item editions remain representable',()=>{
 const e=D.validateEdition(edition(),entry('2026-11-02'));assert.equal(e.coverage.status,'partial');
 assert.equal(e.news.length,0);assert.equal(e.coverage.sources_failed.length,1);
});
test('Reject fabricated/unsafe links, duplicate IDs, mismatched dates and missing review status',()=>{
 const e=edition();
 e.news=[{id:'NEWS-1',title:'Example',summary:'An explicitly hypothetical record',review_status:'unreviewed',source_url:'https://example.org/info',catalog_path:'index.html#/safety',tags:['safety']}];
 assert.equal(D.validateEdition(e,entry('2026-11-02')).news.length,1);
 const duplicate=structuredClone(e);duplicate.news.push({...duplicate.news[0]});
 assert.throws(()=>D.validateEdition(duplicate),/Duplicate news ID/);
 const unsafe=structuredClone(e);unsafe.news[0].source_url='javascript:alert(1)';
 assert.throws(()=>D.validateEdition(unsafe),/source URL/);
 const path=structuredClone(e);path.news[0].catalog_path='../index.html';
 assert.throws(()=>D.validateEdition(path),/internal record link/);
 assert.throws(()=>D.validateEdition(e,entry('2026-11-01')),/date differs/);
});
test('Only HTTPS source links and known internal record routes are accepted',()=>{
 for(const u of ['https://user:pass@example.org','javascript:alert(1)','http://example.org','//example.org/a'])assert.equal(D.safeSource(u),'');
 assert.equal(D.safeCatalogPath('terms/MLD-0691-machine-learning.html'),'terms/MLD-0691-machine-learning.html');
 assert.equal(D.safeCatalogPath('index.html#/technologies?record=TECH-0001'),'index.html#/technologies?record=TECH-0001');
 assert.equal(D.safeCatalogPath('https://evil.example'),'');
});
test('Daily page and scripts are syntax-valid and contain archive, source, topic and missing-edition controls',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 new vm.Script(js);
 for(const token of ['id="edition-select"','id="section-filter"','id="topic-filter"','id="edition-status"','id="edition-content"','src="daily-core.js"','src="whats-new.js"'])assert.ok(html.includes(token),token);
 assert.match(js,/Awaiting the first reviewed daily edition/);
 assert.match(js,/checksum mismatch/i);
 const initial=fs.readFileSync('index.html','utf8');
 assert.match(initial,/data-static="daily" href="whats-new\.html"/);
});

test('Reviewed technology discoveries can link to existing direct technology pages',()=>{
 assert.equal(D.safeCatalogPath('technology/TECH-0216-pytorch.html'),'technology/TECH-0216-pytorch.html');
 for(const invalid of ['technology/../../secrets.html','technology/TECH-0216-%2e%2e.html','technology/TECH-foo.html','technology/TECH-0216-pytorch.html?evil=1'])assert.equal(D.safeCatalogPath(invalid),'');
 const e=edition();e.technologies=[{id:'TECH-0216',title:'PyTorch',summary:'An existing Atlas record, not a new release',review_status:'reviewed',catalog_path:'technology/TECH-0216-pytorch.html',tags:['tools']}];
 assert.equal(D.validateEdition(e,entry('2026-11-02')).technologies.length,1);
});
test('Daily archive reader exposes collection gaps and ignores late responses',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 assert.match(html,/id="source-coverage"/);
 assert.match(js,/sourceCoverage\(\)/);
 assert.match(js,/requestEpoch!==switchEpoch/);
 assert.match(js,/is awaiting publication\. Showing archived edition/);
 assert.match(js,/No source-by-source details were supplied/);
});

test('Strict timestamp and source-date validation rejects fabricated calendar values',()=>{
 for(const v of ['2026-02-29T12:00:00Z','2026-11-31T12:00:00Z','2026-11-02T24:00:00Z','2026-11-02T12:60:00Z','2026-11-02T12:00:60Z','2026-11-02T12:00:00+15:00','2026-11-02T12:00:00-14:30'])assert.equal(D.validTimestamp(v),false,v);
 for(const v of ['2026-11-01T01:30:00-05:00','2026-11-01T01:30:00-06:00','2026-11-02T15:00:00Z','2026-11-02T15:00:00.250+00:00'])assert.equal(D.validTimestamp(v),true,v);
 const bad=edition();bad.news=[{id:'NEWS-1',title:'Fictional',summary:'Example',review_status:'reviewed',source_url:'https://example.org',event_date:'2026-02-31'}];
 assert.throws(()=>D.validateEdition(bad,entry('2026-11-02')),/Invalid event date/);
});
test('Reject mismatched immutable publication timestamps, missing evidence sources and unsafe source-health URLs',()=>{
 const wrong=edition();wrong.published_at='2026-11-02T15:01:00Z';
 assert.throws(()=>D.validateEdition(wrong,entry('2026-11-02')),/Publication timestamp differs/);
 const news=edition();news.news=[{id:'NEWS-2',title:'Fictional',summary:'Example',review_status:'reviewed'}];
 assert.throws(()=>D.validateEdition(news,entry('2026-11-02')),/requires an HTTPS source URL/);
 const health=edition();health.coverage.sources_checked=['javascript:alert(1)'];
 assert.throws(()=>D.validateEdition(health,entry('2026-11-02')),/Invalid collection source URL/);
});
test('Fallback only includes dated editions on or before actual Chicago today',()=>{
 const i=index([entry('2026-10-31'),entry('2026-11-01',1),entry('2026-11-01',2),entry('2026-11-02')]);
 assert.deepEqual(D.fallbackOrder(i,'2026-11-01').map(e=>e.path),[
 'data/daily/editions/2026-11-01-v2.json',
 'data/daily/editions/2026-11-01-v1.json',
 'data/daily/editions/2026-10-31-v1.json']);
});

test('Archive recovery retains verified content after a failed manual selection and checks previous revisions',()=>{
 const js=fs.readFileSync('whats-new.js','utf8');
 assert.match(js,/if\(edition&&active\)/);
 assert.match(js,/Keeping the previously verified/);
 assert.match(js,/for\(const entry of candidates\.slice\(0,32\)\)/);
 assert.match(js,/if\(await switchEdition\(entry\)\)/);
 assert.match(js,/No unverified news is shown/);
 assert.match(js,/select\.disabled=true/);
});

test('Permanent dated archive links select exact immutable revisions without exposing future editions',()=>{
 const i=index([entry('2026-10-31'),entry('2026-11-01'),entry('2026-11-01',2),entry('2026-11-03')]);
 const today='2026-11-02';
 assert.equal(D.requestedEdition(i,'?date=2026-11-01&revision=1',today).entry.revision,1);
 assert.equal(D.requestedEdition(i,'?date=2026-11-01',today).entry.revision,2);
 assert.equal(D.requestedEdition(i,'?date=2026-11-03&revision=1',today).reason,'future');
 assert.equal(D.requestedEdition(i,'?date=2026-11-02&revision=1',today).reason,'unavailable');
 assert.equal(D.requestedEdition(i,'?date=2026-11-31',today).reason,'invalid');
 assert.equal(D.requestedEdition(i,'?revision=1',today).reason,'invalid');
 assert.equal(D.requestedEdition(i,'?date=2026-11-01&date=2026-10-31',today).reason,'invalid');
 assert.equal(D.requestedEdition(i,'?date=2026-11-01&revision=0',today).reason,'invalid');
 assert.equal(D.requestedEdition(i,'?date=2026-11-01&revision=999999999999999999999999',today).reason,'unavailable');
 assert.equal(D.requestedEdition(i,'?utm_source=demo',today).specified,false);
 assert.equal(D.permalink(entry('2026-11-01',2)),'whats-new.html?date=2026-11-01&revision=2');
 assert.throws(()=>D.permalink({date:'2026-11-31',revision:1}),/Invalid edition permalink/);
});
test('Shareable daily links restore verified edition filters without trusting arbitrary URL parameters',()=>{
 const selected=entry('2026-11-02',7);
 const url=D.filterPermalink(selected,{section:'news',topic:'safety',query:'  AI agent  '});
 assert.equal(url,'whats-new.html?date=2026-11-02&revision=7&section=news&topic=safety&q=AI+agent');
 assert.deepEqual(D.viewFilters(url.slice(url.indexOf('?'))),{section:'news',topic:'safety',review:'all',source:'all',query:'AI agent'});
 assert.deepEqual(D.viewFilters('?section=bad&topic=invalid&q='+('a'.repeat(121))),{section:'all',topic:'all',review:'all',source:'all',query:''});
 assert.deepEqual(D.viewFilters('?section=news&section=terms&topic=research&topic=safety&q=a&q=b'),{section:'all',topic:'all',review:'all',source:'all',query:''});
 assert.equal(D.filterPermalink(selected,{section:'nonsense',topic:'unknown',query:''}),D.permalink(selected));
 assert.equal(D.filterPermalink(selected,{section:'news',topic:'tools',query:''}),D.permalink(selected)+'&section=news&topic=tools');
 assert.equal(D.viewFilters('?q=%3Cscript%3E').query,'<script>'); // Only rendered as literal text by the reader.
 assert.equal(D.viewFilters('?review=unreviewed').review,'unreviewed');
 assert.equal(D.viewFilters('?review=unreviewed&review=reviewed').review,'all');
});
test('Reader changes the visible permalink only for a successfully integrity-verified edition',()=>{
 const script=fs.readFileSync('whats-new.js','utf8');
 assert.match(script,/if\(!edition\|\|!active\)return/);
 assert.match(script,/window\.history\.replaceState\(null,'',link\)/);
 assert.match(script,/const filters=C\.viewFilters\(window\.location\.search\)/);
 assert.match(script,/syncVerifiedUrl\(\)/);
 assert.match(script,/Keeping the previously verified/);
});

test('Dated permalink only appears for a hash-verified edition; failed selection retains verified link',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 assert.match(html,/id="edition-permalink-wrap"[^>]* hidden/);
 assert.match(html,/id="edition-permalink"/);
 assert.match(js,/requestedEdition\(index,window\.location\.search,today\)/);
 assert.match(js,/edition-permalink'\)\.href=link/);
 assert.match(js,/syncVerifiedUrl\(\)/);
 assert.match(js,/edition-permalink-wrap'\)\.hidden=false/);
 assert.match(js,/edition-permalink-wrap'\)\.hidden=true/);
 assert.match(js,/requested future-dated edition is not yet available/);
});

test('Broad topic filters match meaningful AI synonyms without fabricating classifications',()=>{
 const vllm={category:'infrastructure',tags:['LLM','Inference','GPU','Open source']};
 const invoke={category:'multimodal',tags:['DL','Diffusion','Vision','Creative tools']};
 const windmill={category:'developer_tooling',tags:['Agents','MCP','Security']};
 assert.equal(D.matchesTopic(vllm,'models'),true);
 assert.equal(D.matchesTopic(vllm,'hardware'),true);
 assert.equal(D.matchesTopic(invoke,'models'),true);
 assert.equal(D.matchesTopic(invoke,'tools'),true);
 assert.equal(D.matchesTopic(windmill,'tools'),true);
 assert.equal(D.matchesTopic(windmill,'safety'),true);
 assert.equal(D.matchesTopic(windmill,'policy'),false);
 assert.equal(D.matchesTopic(vllm,'research'),false);
 assert.equal(D.matchesTopic(vllm,'all'),true);
 assert.equal(D.matchesTopic(vllm,'nonsense'),false);
 assert.equal(D.matchesTopic(null,'models'),false);
});
test('The unfiltered daily reader shows explicit zero counts while filtered search omits empty groups',()=>{
 const script=fs.readFileSync('whats-new.js','utf8');
 for(const text of [
 'No newly integrated technology profile was published',
 'Deferred proposals are not catalog additions',
 'New to AI Updates is not the same as new to the world',
 'No correction was recorded',
 "if(!records.length&&(topic!=='all'||review!=='all'||source!=='all'||query.trim()))continue",
 'C.matchesTopic(item,topic)',
 'C.matchesQuery(item,query)'
 ])assert.ok(script.includes(text),text);
});


test('Source-reviewed v3 edition keeps newsroom proposals separate from catalog additions',()=>{
 const crypto=require('node:crypto');
 const archive=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const entry=archive.editions.find(e=>e.date==='2026-11-02'&&e.revision===3);
 assert.ok(entry,'Immutable Nov 2 revision 3 must remain available');
 const bytes=fs.readFileSync(entry.path);
 assert.equal(bytes.length,entry.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 const daily=D.validateEdition(JSON.parse(bytes.toString('utf8')),entry);
 assert.equal(daily.news.length,9);
 assert.equal(daily.technologies.length,0);
 assert.equal(daily.terms.length,0);
 assert.equal(daily.coverage.status,'partial');
 assert.equal(daily.coverage.sources_failed.length,2);
 assert.equal(new Set(daily.news.map(n=>n.id)).size,9);
 const reuters=daily.news.filter(n=>n.source_url.startsWith('https://www.reuters.com/'));
 assert.equal(reuters.length,4);
 for(const story of reuters){
  assert.equal(story.publication_date,'2026-11-02');
  assert.equal(story.review_status,'original_reuters_reporting_source_checked_not_independently_corroborated');
  assert.match(story.caveat,/reported|not independently|not completed|not enacted/i);
 }
 const receipts=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
 const first=receipts.receipts.find(r=>r.batch_id==='atlas-daily-20261102-first-0850ct-a');
 assert.ok(first);
 assert.equal(first.counts.news_published,9);
 assert.equal(first.accepted_news_ids.length,9);
 assert.deepEqual(first.deferred_news_ids,[]);
 assert.equal(first.deferred_catalog_proposal_ids.length,7);
 assert.deepEqual(first.accepted_catalog_update_ids,['tech-proposal:vllm:2026-11-02-rc3']);
 assert.equal(first.counts.technology_updated,1);
 assert.equal(first.counts.catalog_deferred,7);
 assert.equal(first.counts.term_added,0);
 assert.equal(first.counts.technology_added,0);
});

test('Revision 4 preserves newsroom evidence and records the existing vLLM update as a site change',()=>{
 const crypto=require('node:crypto');
 const archive=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const prev=archive.editions.find(e=>e.date==='2026-11-02'&&e.revision===3);
 const entry=archive.editions.find(e=>e.date==='2026-11-02'&&e.revision===4);
 assert.ok(prev&&entry,'Both immutable dated versions must be preserved');
 const bytes=fs.readFileSync(entry.path);
 assert.equal(bytes.length,entry.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 const v4=D.validateEdition(JSON.parse(bytes.toString('utf8')),entry);
 const v3=D.validateEdition(JSON.parse(fs.readFileSync(prev.path,'utf8')),prev);
 assert.deepEqual(v4.news.map(n=>n.id),v3.news.map(n=>n.id));
 assert.equal(v4.news.length,9);
 assert.equal(v4.technologies.length,0);
 assert.equal(v4.terms.length,0);
 assert.equal(v4.coverage.status,'partial');
 assert.equal(v4.coverage.sources_failed.length,2);
 assert.deepEqual(v4.coverage.sources_checked,v3.coverage.sources_checked);
 assert.equal(v4.site_changes.length,v3.site_changes.length+1);
 const change=v4.site_changes.find(r=>r.id==='site-vllm-release-annotation-20261102');
 assert.ok(change);
 assert.equal(change.catalog_path,'technology/TECH-0288-vllm.html');
 assert.equal(change.review_status,'primary_release_notes_reviewed_not_reproduced');
 assert.match(change.summary,/existing profile|TECH-0288/i);
 assert.equal(v4.tldr.length,3);
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v4'),'The immutable v4 receipt must remain in history after v5 publication');
 assert.equal(receipt.deferred_catalog_proposal_ids.length,7);
 assert.equal(receipt.accepted_catalog_update_records[0].catalog_id,'TECH-0288');
});


test('Revision history compares immutable records by stable ID, not order or property serialization',()=>{
 const prior=edition();prior.news=[
  {id:'N1',title:'Original',summary:'Original summary',review_status:'source_checked',source_url:'https://example.org/n1',tags:['research']},
  {id:'N2',title:'Removed',summary:'Old item',review_status:'source_checked',source_url:'https://example.org/n2'}];
 const next=structuredClone(prior);
 next.news=[{review_status:'source_checked',tags:['research'],summary:'Original summary',title:'Original',source_url:'https://example.org/n1',id:'N1'},
  {id:'N3',title:'Added',summary:'New item',review_status:'source_checked',source_url:'https://example.org/n3'}];
 next.site_changes=[{id:'SITE-1',title:'New archive feature',summary:'A site change, not external news',review_status:'editorial_site_change'}];
 const diff=D.revisionDiff(D.validateEdition(prior),D.validateEdition(next));
 assert.deepEqual(diff.news.added.map(x=>x.id),['N3']);
 assert.deepEqual(diff.news.removed.map(x=>x.id),['N2']);
 assert.equal(diff.news.updated.length,0);
 assert.deepEqual(diff.site_changes.added.map(x=>x.id),['SITE-1']);
 next.news[0].summary='Corrected summary';
 assert.deepEqual(D.revisionDiff(prior,next).news.updated.map(x=>x.id),['N1']);
 next.edition_date='2026-11-01';
 assert.throws(()=>D.revisionDiff(prior,next),/different dates/);
});
test('Revision comparison verifies earlier edition bytes and degrades without hiding the verified latest edition',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 assert.match(html,/id="revision-history"/);
 assert.match(html,/id="revision-history-content"/);
 assert.match(js,/const prior=await readEdition\(previous,true\)/);
 assert.match(js,/if\(epoch!==switchEpoch\)return/);
 assert.match(js,/current edition remains independently verified/);
});
test('Historical Nov 2 editions have an explainable revision 3-to-4 delta',()=>{
 const archive=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const v3=JSON.parse(fs.readFileSync(archive.editions.find(e=>e.revision===3).path,'utf8'));
 const v4=JSON.parse(fs.readFileSync(archive.editions.find(e=>e.revision===4).path,'utf8'));
 const diff=D.revisionDiff(v3,v4);
 assert.equal(diff.news.added.length,0);
 assert.equal(diff.news.updated.length,0);
 assert.equal(diff.site_changes.added.length,1);
 assert.equal(diff.site_changes.added[0].id,'site-vllm-release-annotation-20261102');
});

test('Revision 5 preserves source-reviewed news and independently validates new archive-history site change',()=>{
 const crypto=require('node:crypto');
 const archive=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const previous=archive.editions.find(x=>x.date==='2026-11-02'&&x.revision===4);
 const latest=archive.editions.find(x=>x.date==='2026-11-02'&&x.revision===5);
 assert.ok(previous&&latest);
 const raw=fs.readFileSync(latest.path);
 assert.equal(raw.length,latest.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),latest.sha256);
 const a=D.validateEdition(JSON.parse(fs.readFileSync(previous.path,'utf8')),previous);
 const b=D.validateEdition(JSON.parse(raw.toString('utf8')),latest);
 assert.deepEqual(b.news,a.news);
 assert.deepEqual(b.technologies,a.technologies);
 assert.deepEqual(b.terms,a.terms);
 assert.deepEqual(b.coverage,a.coverage);
 const diff=D.revisionDiff(a,b);
 assert.deepEqual(diff.site_changes.added.map(x=>x.id),['site-daily-revision-comparison-20261102']);
 assert.equal(diff.news.added.length+diff.news.updated.length+diff.news.removed.length,0);
 assert.equal(b.tldr.length,3);
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v5'),'v5 receipt must remain in revision history');
 assert.equal(receipt.counts.news_published,9);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,7);
});

test('The daily audit discloses actual coverage context, source checks and failed lookup causes',()=>{
 const js=fs.readFileSync('whats-new.js','utf8');
 for(const required of ['Collection context: ','Status: ','Checked ','Reason: ','item.reason||item.note','coverage.note','sources_failed']){
  assert.ok(js.includes(required),'Missing source audit element: '+required);
 }
 const e=JSON.parse(fs.readFileSync('data/daily/editions/2026-11-02-v6.json','utf8'));
 assert.match(e.coverage.note,/two source lookups failed/i);
 assert.equal(e.coverage.sources_failed.length,2);
 assert.ok(e.coverage.sources_failed.every(x=>x.reason&&x.status&&x.url.startsWith('https://')));
 assert.ok(e.coverage.sources_checked.every(x=>x.checked_at));
});

test('Revision 6 changes only the documented AI Updates source-audit UI, never world news',()=>{
 const crypto=require('node:crypto');
 const archive=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const before=archive.editions.find(e=>e.date==='2026-11-02'&&e.revision===5);
 const after=archive.editions.find(e=>e.date==='2026-11-02'&&e.revision===6);
 assert.ok(before&&after);
 const raw=fs.readFileSync(after.path);
 assert.equal(raw.length,after.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),after.sha256);
 const prev=D.validateEdition(JSON.parse(fs.readFileSync(before.path,'utf8')),before);
 const next=D.validateEdition(JSON.parse(raw.toString('utf8')),after);
 for(const key of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(next[key],prev[key]);
 const diff=D.revisionDiff(prev,next);
 assert.equal(diff.site_changes.added.length,1);
 assert.equal(diff.site_changes.added[0].id,'site-source-coverage-audit-20261102');
 assert.equal(diff.news.added.length+diff.news.updated.length+diff.news.removed.length,0);
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(receipt.publication_history.some(x=>x.edition==='2026-11-02-v6'));
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v5'));
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v6'));
 assert.equal(receipt.counts.news_published,9);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,7);
 assert.equal(receipt.counts.term_added,0);
 assert.equal(receipt.counts.technology_added,0);
});

test('Verified-edition search matches source and caveat with literal AND keywords',()=>{
 const item={id:'ai-news:reuters:valuation',title:'AI valuation risk warning',summary:'Officials discussed expensive equities',caveat:'Not an established market crash',tags:['policy','financial-stability'],source_url:'https://www.reuters.com/report'};
 assert.equal(D.matchesQuery(item,''),true);
 assert.equal(D.matchesQuery(item,'VALUATION equities'),true);
 assert.equal(D.matchesQuery(item,'Reuters risk'),true);
 assert.equal(D.matchesQuery(item,'market crash'),true);
 assert.equal(D.matchesQuery(item,'chip shortage'),false);
 assert.equal(D.matchesQuery(item,'[.*]'),false);
 assert.equal(D.matchesQuery({...item,title:'Café evaluation'},'cafe'),true);
});
test('Reader offers labelled, keyboard-reachable search and match feedback',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 for(const id of ['edition-search','reset-filters','filter-results']) assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('<label for="edition-search">'));
 assert.ok(html.includes('id="filter-results" role="status" aria-live="polite"'));
 assert.ok(js.includes('C.matchesQuery(item,query)'));
 assert.ok(js.includes("('edition-search').addEventListener('input'"));
 assert.ok(js.includes("('reset-filters').addEventListener('click'"));
 assert.ok(js.includes('No entries match those filters'));
});

test('Revision 7 preserves all external content and records only a site search update',()=>{
 const crypto=require('node:crypto'),idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const a=idx.editions.find(e=>e.date==='2026-11-02'&&e.revision===6);
 const b=idx.editions.find(e=>e.date==='2026-11-02'&&e.revision===7);
 assert.ok(a&&b);
 const raw=fs.readFileSync(b.path);
 assert.equal(raw.length,b.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),b.sha256);
 const before=D.validateEdition(JSON.parse(fs.readFileSync(a.path,'utf8')),a);
 const after=D.validateEdition(JSON.parse(raw.toString('utf8')),b);
 for(const kind of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(after[kind],before[kind]);
 const d=D.revisionDiff(before,after);
 assert.deepEqual(d.site_changes.added.map(x=>x.id),['site-daily-keyword-search-20261102']);
 assert.equal(d.news.added.length+d.news.updated.length+d.news.removed.length,0);
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.equal(receipt.publication_edition,receipt.publication_history.at(-1).edition);
 assert.ok(receipt.publication_history.some(x=>x.edition==='2026-11-02-v6'));
 assert.ok(receipt.publication_history.some(x=>x.edition==='2026-11-02-v7'));
 assert.equal(receipt.deferred_catalog_proposal_ids.length,7);
});

test('Revision 8 preserves all external evidence and only adds the shareable-filter site record',()=>{
 const crypto=require('node:crypto');
 const archive=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const old=archive.editions.find(e=>e.date==='2026-11-02'&&e.revision===7);
 const next=archive.editions.find(e=>e.date==='2026-11-02'&&e.revision===8);
 assert.ok(old&&next);
 const bytes=fs.readFileSync(next.path);
 assert.equal(bytes.length,next.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),next.sha256);
 const before=D.validateEdition(JSON.parse(fs.readFileSync(old.path,'utf8')),old),after=D.validateEdition(JSON.parse(bytes.toString('utf8')),next);
 for(const kind of ['news','technologies','terms','corrections'])assert.deepEqual(after[kind],before[kind]);
 assert.deepEqual(after.coverage,before.coverage);
 assert.equal(after.site_changes.length,before.site_changes.length+1);
 const diff=D.revisionDiff(before,after);
 assert.deepEqual(diff.site_changes.added.map(r=>r.id),['site-daily-shareable-filters-20261102']);
 for(const kind of ['news','technologies','terms','corrections'])assert.equal(diff[kind].added.length+diff[kind].updated.length+diff[kind].removed.length,0);
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
 assert.equal(ledger.receipts[0].deferred_catalog_proposal_ids.length,7);
 assert.equal(ledger.receipts[0].counts.technology_added,0);
 assert.equal(ledger.receipts[0].counts.term_added,0);
});

test('Revision 9 indexes only the accessible sidebar update, preserving immutable AI evidence',()=>{
 const crypto=require('node:crypto');
 const archive=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const old=archive.editions.find(e=>e.date==='2026-11-02'&&e.revision===8);
 const next=archive.editions.find(e=>e.date==='2026-11-02'&&e.revision===9);
 assert.ok(old&&next);
 const raw=fs.readFileSync(next.path);
 assert.equal(raw.length,next.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),next.sha256);
 const before=D.validateEdition(JSON.parse(fs.readFileSync(old.path,'utf8')),old);
 const after=D.validateEdition(JSON.parse(raw.toString('utf8')),next);
 for(const kind of ['news','technologies','terms','corrections','coverage'])assert.deepEqual(after[kind],before[kind]);
 const diff=D.revisionDiff(before,after);
 assert.deepEqual(diff.site_changes.added.map(item=>item.id),['site-progressive-sidebar-navigation-20261102']);
 for(const kind of ['news','technologies','terms','corrections'])assert.equal(diff[kind].added.length+diff[kind].updated.length+diff[kind].removed.length,0);
 assert.match(after.site_changes.at(-1).summary,/not a new real-world AI event/i);
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
 assert.equal(ledger.receipts.length,1);
 assert.ok(ledger.receipts[0].publication_history.some(h=>h.edition==='2026-11-02-v9'));
 assert.equal(ledger.receipts[0].publication_edition,ledger.receipts[0].publication_history.at(-1).edition);
 assert.equal(ledger.receipts[0].deferred_catalog_proposal_ids.length,7);
 assert.equal(ledger.receipts[0].counts.news_published,9);
 assert.equal(ledger.receipts[0].counts.term_added,0);
 assert.equal(ledger.receipts[0].counts.technology_added,0);
});

test('Revision 10 only adds two reviewed Atlas guide updates, preserving real-world evidence',()=>{
 const crypto=require('node:crypto');
 const index=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const old=index.editions.find(e=>e.date==='2026-11-02'&&e.revision===9);
 const newest=index.editions.find(e=>e.date==='2026-11-02'&&e.revision===10);
 assert.ok(old&&newest);
 const raw=fs.readFileSync(newest.path);
 assert.equal(raw.length,newest.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),newest.sha256);
 const previous=D.validateEdition(JSON.parse(fs.readFileSync(old.path,'utf8')),old);
 const current=D.validateEdition(JSON.parse(raw.toString('utf8')),newest);
 assert.equal(D.chicagoDate(current.published_at),'2026-11-02');
 for(const key of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(current[key],previous[key]);
 const diff=D.revisionDiff(previous,current);
 assert.deepEqual(diff.site_changes.added.map(x=>x.id),['site-expanded-agentic-workflow-20261102','site-expanded-knowledge-graph-20261102']);
 assert.equal(diff.site_changes.removed.length+diff.site_changes.updated.length,0);
 for(const key of ['news','technologies','terms','corrections'])assert.equal(diff[key].added.length+diff[key].removed.length+diff[key].updated.length,0);
 const guides=JSON.parse(fs.readFileSync('content/term-guides.json','utf8'));
 const manifest=JSON.parse(fs.readFileSync('terms/manifest.json','utf8'));
 for(const [i,id] of ['MLD-0043','MLD-0608'].entries()){
  assert.ok(guides[id]&&manifest[id].expanded,'Guide is not in canonical encyclopedia');
  assert.equal(diff.site_changes.added[i].catalog_path,manifest[id].path);
  assert.ok(fs.existsSync(manifest[id].path));
  assert.match(diff.site_changes.added[i].summary,/not a new|not evidence|not newly/i);
 }
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v11'), 'Archive revision 11 remains in the receipt ledger');
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v10'));
 assert.equal(receipt.counts.news_published,9);
 assert.equal(receipt.counts.term_added,0);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,7);
});

test('Revision 11 adds only two verified existing concept guides, not fresh AI news',()=>{
 const crypto=require('node:crypto');
 const archive=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const beforeEntry=archive.editions.find(x=>x.date==='2026-11-02'&&x.revision===10);
 const nextEntry=archive.editions.find(x=>x.date==='2026-11-02'&&x.revision===11);
 assert.ok(beforeEntry&&nextEntry);
 const raw=fs.readFileSync(nextEntry.path);
 assert.equal(raw.length,nextEntry.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),nextEntry.sha256);
 const old=D.validateEdition(JSON.parse(fs.readFileSync(beforeEntry.path,'utf8')),beforeEntry);
 const newer=D.validateEdition(JSON.parse(raw.toString('utf8')),nextEntry);
 assert.equal(D.chicagoDate(newer.published_at),'2026-11-02');
 for(const key of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(newer[key],old[key]);
 const changes=D.revisionDiff(old,newer);
 assert.deepEqual(changes.site_changes.added.map(x=>x.id),[
  'site-expanded-benchmark-evaluation-20261102',
  'site-expanded-environment-evaluation-20261102'
 ]);
 assert.equal(changes.site_changes.removed.length+changes.site_changes.updated.length,0);
 for(const key of ['news','technologies','terms','corrections'])
  assert.equal(changes[key].added.length+changes[key].removed.length+changes[key].updated.length,0);
 const guides=JSON.parse(fs.readFileSync('content/term-guides.json','utf8'));
 const pages=JSON.parse(fs.readFileSync('terms/manifest.json','utf8'));
 assert.ok(Object.keys(guides).length >= 35, 'Historical revision 11 must not cap later guide expansions');
 for(const [index,id] of ['MLD-0110','MLD-0371'].entries()){
  assert.equal(pages[id].expanded,true);
  assert.equal(changes.site_changes.added[index].catalog_path,pages[id].path);
  assert.ok(fs.existsSync(pages[id].path));
 }
 const r=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.equal(r.publication_edition,r.publication_history.at(-1).edition, 'Current receipt must track latest edition');
 assert.ok(r.publication_history.some(h=>h.edition==='2026-11-02-v11'), 'Historical revision 11 receipt preserved');
 assert.equal(r.counts.term_added,0);
 assert.equal(r.counts.technology_added,0);
 assert.equal(r.deferred_catalog_proposal_ids.length,7);
 assert.equal(r.counts.news_published,9);
});

test('Revision 12 archives two genuine prompt-injection guide improvements without mutating world news', () => {
  const crypto = require('node:crypto');
  const index = JSON.parse(fs.readFileSync('data/daily/index.json', 'utf8'));
  const previous = index.editions.find(x => x.date === '2026-11-02' && x.revision === 11);
  const latest = index.editions.find(x => x.date === '2026-11-02' && x.revision === 12);
  assert.ok(previous && latest);
  const bytes = fs.readFileSync(latest.path);
  assert.equal(bytes.length, latest.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), latest.sha256);
  const before = D.validateEdition(JSON.parse(fs.readFileSync(previous.path, 'utf8')), previous);
  const after = D.validateEdition(JSON.parse(bytes.toString('utf8')), latest);
  assert.equal(D.chicagoDate(after.published_at), '2026-11-02');
  for (const field of ['news', 'technologies', 'terms', 'coverage', 'corrections'])
    assert.deepEqual(after[field], before[field], 'Original evidence changed: ' + field);
  const diff = D.revisionDiff(before, after);
  assert.deepEqual(diff.site_changes.added.map(x => x.id), [
    'site-expanded-prompt-injection-20261102',
    'site-expanded-indirect-prompt-injection-20261102'
  ]);
  for (const field of ['news','technologies','terms','corrections'])
    assert.equal(diff[field].added.length + diff[field].updated.length + diff[field].removed.length, 0);
  const manifest = JSON.parse(fs.readFileSync('terms/manifest.json','utf8'));
  for (const [i,id] of ['MLD-0957','MLD-0549'].entries()) {
    assert.equal(manifest[id].expanded, true);
    assert.equal(diff.site_changes.added[i].catalog_path, manifest[id].path);
    assert.ok(fs.readFileSync(manifest[id].path,'utf8').includes('Sources for the expanded explanation'));
  }
  const r = JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
  assert.ok(r.publication_history.some(h=>h.edition==='2026-11-02-v12'), 'Revision 12 receipt must survive newer publications');
  assert.ok(r.publication_history.some(h=>h.edition==='2026-11-02-v12'));
  assert.equal(r.deferred_catalog_proposal_ids.length,7);
  assert.equal(r.counts.term_added,0);
});


test('Revision 13 adds exactly two real reward-model guide updates with immutable source evidence', () => {
 const crypto=require('node:crypto');
 const index=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const old=index.editions.find(e=>e.date==='2026-11-02'&&e.revision===12);
 const newer=index.editions.find(e=>e.date==='2026-11-02'&&e.revision===13);
 assert.ok(old&&newer);
 const bytes=fs.readFileSync(newer.path);
 assert.equal(bytes.length,newer.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),newer.sha256);
 const before=D.validateEdition(JSON.parse(fs.readFileSync(old.path,'utf8')),old);
 const after=D.validateEdition(JSON.parse(bytes.toString('utf8')),newer);
 assert.equal(D.chicagoDate(after.published_at),'2026-11-02');
 for(const k of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(after[k],before[k],'Historical evidence altered: '+k);
 const changes=D.revisionDiff(before,after);
 assert.deepEqual(changes.site_changes.added.map(x=>x.id),['site-expanded-reward-model-20261102','site-expanded-reward-overoptimization-20261102']);
 assert.equal(changes.site_changes.updated.length+changes.site_changes.removed.length,0);
 const manifest=JSON.parse(fs.readFileSync('terms/manifest.json','utf8'));
 for(const [i,id] of ['MLD-1040','MLD-1041'].entries()){
  assert.equal(manifest[id].expanded,true);
  assert.equal(changes.site_changes.added[i].catalog_path,manifest[id].path);
  assert.match(fs.readFileSync(manifest[id].path,'utf8'),/Sources for the expanded explanation/);
  assert.match(changes.site_changes.added[i].summary,/not a new|not a newly|not a confirmed/i);
 }
 const r=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(r.publication_history.some(h=>h.edition==='2026-11-02-v13'), 'Historical version 13 remains in the receipt');
 assert.ok(r.publication_history.some(h=>h.edition==='2026-11-02-v13'), 'Historical revision 13 receipt preserved');
 assert.equal(r.deferred_catalog_proposal_ids.length,7);
 assert.equal(r.counts.news_published,9);
 assert.equal(r.counts.technology_added,0);
 assert.equal(r.counts.term_added,0);
});

test('Revision 14 records only two existing research guide expansions and leaves verified archive history intact', () => {
  const crypto=require('node:crypto'), index=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
  const a=index.editions.find(e=>e.date==='2026-11-02'&&e.revision===13);
  const b=index.editions.find(e=>e.date==='2026-11-02'&&e.revision===14);
  assert.ok(a&&b);
  const bytes=fs.readFileSync(b.path);
  assert.equal(bytes.length,b.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),b.sha256);
  const prior=D.validateEdition(JSON.parse(fs.readFileSync(a.path,'utf8')),a);
  const next=D.validateEdition(JSON.parse(bytes.toString('utf8')),b);
  assert.equal(D.chicagoDate(next.published_at),'2026-11-02');
  for(const key of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(next[key],prior[key]);
  const change=D.revisionDiff(prior,next);
  assert.deepEqual(change.site_changes.added.map(x=>x.id),['site-expanded-ablation-study-20261102','site-expanded-data-leakage-20261102']);
  assert.equal(change.site_changes.updated.length+change.site_changes.removed.length,0);
  const pages=JSON.parse(fs.readFileSync('terms/manifest.json','utf8'));
  const guides=JSON.parse(fs.readFileSync('content/term-guides.json','utf8'));
  assert.ok(Object.keys(guides).length>=41, 'Historical revision 14 must allow later guide expansions');
  for(const [i,id] of ['MLD-0002','MLD-0263'].entries()){
    assert.equal(pages[id].expanded,true);
    assert.equal(change.site_changes.added[i].catalog_path,pages[id].path);
    assert.ok(fs.existsSync(pages[id].path));
  }
  const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
  assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v14'&&h.status==='cloudflare_http_browser_and_githack_verified'), 'Preserve immutable v14 verified history');
  // A newly indexed edition can remain pending; verified receipts must agree with their history.
  const verified=receipt.publication_history.filter(h=>h.status==='cloudflare_http_browser_and_githack_verified');
  const lastVerified=verified.at(-1);
  assert.ok(lastVerified && Number.isInteger(receipt.production_verified_revision));
  const verifiedRevision=Number(lastVerified.edition.split('-v').at(-1));
  assert.equal(receipt.production_verified_revision,verifiedRevision);
  assert.ok(index.editions.some(e=>e.date===lastVerified.edition.slice(0,10)&&e.revision===verifiedRevision));
  assert.equal(receipt.production_commit,lastVerified.production_commit);
  assert.equal(receipt.last_verified_at,lastVerified.verified_at);
  assert.equal(receipt.production_workflow_run_id,lastVerified.production_workflow_run_id);
  assert.equal(receipt.githack_workflow_run_id,lastVerified.githack_workflow_run_id);
  assert.equal(receipt.last_verified_public_url,'https://aiupdates.app/whats-new.html?date='+lastVerified.edition.slice(0,10)+'&revision='+verifiedRevision);
  assert.equal(receipt.deferred_catalog_proposal_ids.length,7);
  assert.equal(receipt.counts.news_published,9);
});


test('Revision 15 preserves its two shift-evaluation guides and source claims across later expansions', () => {
 const index=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const prior=index.editions.find(e=>e.date==='2026-11-02'&&e.revision===14);
 const current=index.editions.find(e=>e.date==='2026-11-02'&&e.revision===15);
 assert.ok(prior&&current);
 const bytes=fs.readFileSync(current.path);
 assert.equal(bytes.length,current.bytes);
 assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),current.sha256);
 const prev=D.validateEdition(JSON.parse(fs.readFileSync(prior.path,'utf8')),prior);
 const next=D.validateEdition(JSON.parse(bytes.toString('utf8')),current);
 assert.equal(D.chicagoDate(next.published_at),'2026-11-02');
 for(const key of ['coverage','news','technologies','terms','corrections'])assert.deepEqual(next[key],prev[key],'Source/evidence changed: '+key);
 const delta=D.revisionDiff(prev,next);
 assert.deepEqual(delta.site_changes.added.map(x=>x.id),['site-expanded-covariate-shift-20261102','site-expanded-out-of-distribution-20261102']);
 assert.equal(delta.site_changes.updated.length+delta.site_changes.removed.length,0);
 const manifest=JSON.parse(fs.readFileSync('terms/manifest.json','utf8'));
 const guides=JSON.parse(fs.readFileSync('content/term-guides.json','utf8'));
 assert.ok(Object.keys(guides).length>=43, 'Historical revision 15 must allow future encyclopedia expansions');
 for(const [i,id] of ['MLD-0237','MLD-0854'].entries()){
   assert.ok(manifest[id].expanded&&fs.existsSync(manifest[id].path));
   assert.equal(delta.site_changes.added[i].catalog_path,manifest[id].path);
 }
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v15'), 'Historical revision 15 receipt must survive later editions');
 assert.equal(receipt.publication_history.at(-1).edition,receipt.publication_edition);
 assert.ok(receipt.production_verified_revision>=15, 'Historical v15 production verification must remain recorded');
 assert.equal(receipt.counts.news_published,9);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,7);
 assert.equal(receipt.counts.term_added,0);
 assert.equal(receipt.counts.technology_added,0);
});

test('Revision 16 archives two adversarial-security guides without changing original news evidence', () => {
 const crypto=require('node:crypto'), idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const a=idx.editions.find(e=>e.date==='2026-11-02'&&e.revision===15);
 const b=idx.editions.find(e=>e.date==='2026-11-02'&&e.revision===16);
 assert.ok(a&&b);
 const raw=fs.readFileSync(b.path);
 assert.equal(raw.length,b.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),b.sha256);
 const previous=D.validateEdition(JSON.parse(fs.readFileSync(a.path,'utf8')),a);
 const current=D.validateEdition(JSON.parse(raw.toString('utf8')),b);
 assert.equal(D.chicagoDate(current.published_at),'2026-11-02');
 for(const field of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(current[field],previous[field]);
 const diff=D.revisionDiff(previous,current);
 assert.deepEqual(diff.site_changes.added.map(x=>x.id),['site-expanded-adversarial-example-20261102','site-expanded-adversarial-robustness-20261102']);
 assert.equal(diff.site_changes.removed.length+diff.site_changes.updated.length,0);
 const manifest=JSON.parse(fs.readFileSync('terms/manifest.json','utf8')),guides=JSON.parse(fs.readFileSync('content/term-guides.json','utf8'));
 assert.ok(Object.keys(guides).length>=45);
 for(const [i,id] of ['MLD-0034','MLD-0036'].entries()){
  assert.ok(manifest[id].expanded,'Substantive guide must exist: '+id);
  assert.equal(diff.site_changes.added[i].catalog_path,manifest[id].path);
  assert.match(fs.readFileSync(manifest[id].path,'utf8'),/Sources for the expanded explanation/);
  assert.equal(guides[id].sections.length,9);
 }
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(ledger.publication_history.some(h=>h.edition==='2026-11-02-v16'), 'Historical revision 16 receipt must remain archived');
 assert.equal(ledger.publication_history.at(-1).edition,ledger.publication_edition);
 assert.ok(ledger.publication_history.some(h=>h.edition==='2026-11-02-v16'&&h.status==='cloudflare_http_browser_and_githack_verified'),'Preserve v16 verification history after future editions');
 assert.ok(ledger.production_verified_revision>=16,'Verified revision cannot regress behind confirmed v16');
 assert.equal(ledger.deferred_catalog_proposal_ids.length,7);
 assert.equal(ledger.counts.news_published,9);
 assert.equal(ledger.counts.term_added,0);
 assert.equal(ledger.counts.technology_added,0);
});

test('Retrospective revision 17 records existing Atlas changes without inventing November 3 collection', () => {
 const crypto = require('node:crypto'), idx = JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const old = idx.editions.find(e=>e.date==='2026-11-02' && e.revision===16);
 const cur = idx.editions.find(e=>e.date==='2026-11-02' && e.revision===17);
 assert.ok(old && cur,'Immutable prior version and retrospective edition remain indexed');
 const raw = fs.readFileSync(cur.path);
 assert.equal(raw.length,cur.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),cur.sha256);
 const before = D.validateEdition(JSON.parse(fs.readFileSync(old.path,'utf8')),old);
 const after = D.validateEdition(JSON.parse(raw.toString('utf8')),cur);
 assert.equal(after.edition_date,'2026-11-02');
 assert.equal(D.chicagoDate(after.published_at),'2026-11-03','Retrospective publication time stays truthful');
 for (const field of ['coverage','news','technologies','terms','corrections']) assert.deepEqual(after[field],before[field],field+' must not change');
 const changes = D.revisionDiff(before,after);
 assert.deepEqual(changes.site_changes.added.map(s=>s.id),['site-expanded-data-poisoning-20261103','site-expanded-backdoor-20261103']);
 assert.equal(changes.site_changes.updated.length+changes.site_changes.removed.length,0);
 const manifest = JSON.parse(fs.readFileSync('terms/manifest.json','utf8'));
 for(const [i,id] of ['MLD-0268','MLD-0085'].entries()){
  const entry=manifest[id], item=changes.site_changes.added[i];
  assert.ok(entry.expanded && fs.existsSync(entry.path));
  assert.equal(item.catalog_path,entry.path);
  assert.equal(D.chicagoDate(item.added_to_atlas_at),'2026-11-03');
  assert.match(item.summary,/not a new|not evidence of a new|not a newly/i);
 }
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(ledger.publication_history.some(h=>h.edition==='2026-11-02-v17'));
 assert.equal(ledger.publication_history.at(-1).edition,ledger.publication_edition);
 assert.equal(ledger.deferred_catalog_proposal_ids.length,7);
 assert.equal(ledger.counts.news_published,9);
 assert.equal(ledger.counts.technology_added,0);
 assert.equal(ledger.counts.term_added,0);
 assert.equal(D.selection(idx,'2026-11-03').todayEntry,null,'Nov 3 must still await an actual collected edition');
});

test('Daily source CSV export preserves evidence dates and neutralizes spreadsheet formulas',()=>{
 const e=edition();
 e.news=[
  {id:'N-1',title:'=IMPORTXML("https://example.org","x")',summary:'A credible, quoted "claim" from a source',
   review_status:'source-checked; not reproduced',release_status:'controlled demo',category:'safety',
   caveat:'+not a deployment incident',source_url:'https://example.org/release',publication_date:'2026-11-02',
   event_date:'2026-11-01',discovered_at:'2026-11-02T14:00:00Z',tags:['safety','research']},
  {id:'N-2',title:'Unrelated hardware announcement',summary:'Different section of results',
   review_status:'reviewed',category:'hardware',source_url:'https://example.org/chip',tags:['hardware']}
 ];
 e.site_changes=[{id:'S-1',title:'Atlas export feature',summary:'Website improvement, not a new-world event',review_status:'site update',tags:['tools']}];
 const csv=D.citationCsv(e,entry('2026-11-02',17),{section:'news',topic:'safety',query:'quoted claim'});
 assert.ok(csv.startsWith('\ufeff'));
 assert.match(csv,/edition_date.*record_id.*review_status.*source_publication_date.*event_date.*added_to_atlas_at/);
 assert.match(csv,/'=IMPORTXML/);
 assert.match(csv,/'\+not a deployment incident/);
 assert.match(csv,/A credible, quoted ""claim"" from a source/);
 assert.match(csv,/source-checked; not reproduced/);
 assert.match(csv,/2026-11-02.*2026-11-01/);
 assert.doesNotMatch(csv,/Unrelated hardware announcement|Atlas export feature/);
 assert.equal(csv.trim().split('\r\n').length,2);
 const all=D.citationCsv(e,entry('2026-11-02'),{});
 assert.equal(all.trim().split('\r\n').length,4);
 assert.throws(()=>D.citationCsv(e,entry('2026-11-01')),/date differs|Invalid export edition/);
});
test('Research export stays disabled until immutable edition verification succeeds',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 assert.match(html,/id="export-verified"[^>]*disabled/);
 assert.match(js,/await readEdition\(entry\)/);
 assert.match(js,/edition=e;active=entry;/);
 assert.match(js,/export-verified'\)\.disabled=false/);
 assert.match(js,/if\(!edition\|\|!active\)return;/);
 assert.match(js,/C\.citationCsv\(edition,active,currentFilters\(\)\)/);
 assert.match(js,/new Blob\(\[csv\]/);
});

test('Retrospective v18 contains one verified-reader site change and preserves the source collection',()=>{
 const crypto=require('node:crypto');
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const beforeEntry=idx.editions.find(e=>e.date==='2026-11-02'&&e.revision===17);
 const afterEntry=idx.editions.find(e=>e.date==='2026-11-02'&&e.revision===18);
 assert.ok(beforeEntry&&afterEntry);
 const raw=fs.readFileSync(afterEntry.path);
 assert.equal(raw.length,afterEntry.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),afterEntry.sha256);
 const before=D.validateEdition(JSON.parse(fs.readFileSync(beforeEntry.path,'utf8')),beforeEntry);
 const after=D.validateEdition(JSON.parse(raw.toString('utf8')),afterEntry);
 for(const field of ['news','technologies','terms','corrections','coverage'])assert.deepEqual(after[field],before[field]);
 assert.equal(D.chicagoDate(after.published_at),'2026-11-03');
 const changes=D.revisionDiff(before,after);
 assert.deepEqual(changes.site_changes.added.map(x=>x.id),['site-verified-evidence-csv-export-20261103']);
 assert.equal(changes.site_changes.updated.length+changes.site_changes.removed.length,0);
 assert.match(changes.site_changes.added[0].summary,/not an external AI news event/i);
 assert.match(changes.site_changes.added[0].summary,/SHA-256/);
 assert.equal(D.selection(idx,'2026-11-03').todayEntry,null,'No November 3 collection is staged');
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(ledger.publication_history.some(h=>h.edition==='2026-11-02-v18'&&h.status==='cloudflare_http_browser_and_githack_verified'));
 assert.equal(ledger.publication_history.at(-1).edition,ledger.publication_edition);
 assert.equal(ledger.deferred_catalog_proposal_ids.length,7);
 assert.equal(ledger.counts.news_published,9);
 assert.equal(ledger.counts.technology_added,0);
 assert.equal(ledger.counts.term_added,0);
});

test('Archive verification metadata agrees with the last actual production receipt',()=>{
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 const revision=receipt.production_verified_revision;
 assert.ok(Number.isInteger(revision)&&revision>=18);
 assert.equal(idx.status,'edition_revision_'+revision+'_production_verified');
 assert.equal(idx.last_successful_publish_at,receipt.production_verified_at);
 assert.ok(idx.editions.some(e=>e.date===receipt.edition_date&&e.revision===revision));
 assert.ok(idx.coverage_note.includes('revision '+revision));
 assert.equal(receipt.publication_history.find(h=>h.edition===receipt.edition_date+'-v'+revision)?.status,
              'cloudflare_http_browser_and_githack_verified');
});

test('Exact provenance labels filter research records, CSV and safe share links',()=>{
 const e=edition();
 e.news=[
  {id:'N1',title:'Publisher-announced example',summary:'A hypothetical source claim',review_status:'publisher report; not independently reproduced',source_url:'https://example.org/1',tags:['safety']},
  {id:'N2',title:'Source-checked example',summary:'A second hypothetical example',review_status:'source-checked',source_url:'https://example.org/2',tags:['safety']}
 ];
 const selected=entry('2026-11-02',18),review='publisher report; not independently reproduced';
 assert.equal(D.matchesReviewStatus(e.news[0],review),true);
 assert.equal(D.matchesReviewStatus(e.news[1],review),false);
 assert.equal(D.matchesReviewStatus(e.news[1],'all'),true);
 const url=D.filterPermalink(selected,{section:'news',topic:'safety',review,query:''});
 assert.ok(url.includes('review=publisher+report'));
 assert.equal(D.viewFilters(url.slice(url.indexOf('?'))).review,review);
 const csv=D.citationCsv(e,selected,{section:'news',topic:'safety',review});
 assert.match(csv,/Publisher-announced example/);
 assert.doesNotMatch(csv,/Source-checked example/);
 assert.equal(csv.trim().split('\r\n').length,2);
 assert.equal(D.filterPermalink(selected,{review:'a'.repeat(121)}),D.permalink(selected));
 assert.equal(D.viewFilters('?review='+encodeURIComponent('x'.repeat(121))).review,'all');
 const html=fs.readFileSync('whats-new.html','utf8'),script=fs.readFileSync('whats-new.js','utf8');
 assert.match(html,/id="evidence-filter" disabled/);
 assert.match(script,/populateReviewOptions\(e\)/);
 assert.match(script,/C\.matchesReviewStatus\(item,review\)/);
 assert.match(script,/select\.disabled=false;pendingReview=null/);
});

test('Retrospective revision 19 adds only the Atlas evidence-review filter, preserving old news',()=>{
 const crypto=require('node:crypto'),idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const prev=idx.editions.find(x=>x.date==='2026-11-02'&&x.revision===18);
 const cur=idx.editions.find(x=>x.date==='2026-11-02'&&x.revision===19);
 assert.ok(prev&&cur);
 const data=fs.readFileSync(cur.path);
 assert.equal(data.length,cur.bytes);
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),cur.sha256);
 const before=D.validateEdition(JSON.parse(fs.readFileSync(prev.path,'utf8')),prev);
 const after=D.validateEdition(JSON.parse(data.toString('utf8')),cur);
 assert.equal(D.chicagoDate(after.published_at),'2026-11-03');
 for(const key of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(after[key],before[key]);
 const delta=D.revisionDiff(before,after);
 assert.deepEqual(delta.site_changes.added.map(x=>x.id),['site-exact-review-label-filter-20261103']);
 assert.equal(delta.site_changes.removed.length+delta.site_changes.updated.length,0);
 assert.match(delta.site_changes.added[0].summary,/not an external AI news event/i);
 assert.equal(D.selection(idx,'2026-11-03').todayEntry,null);
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v19'&&h.status==='cloudflare_http_browser_and_githack_verified'));
 assert.ok(receipt.production_verified_revision>=19);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,7);
 assert.equal(receipt.counts.news_published,9);
 assert.equal(receipt.counts.technology_added+receipt.counts.term_added,0);
});


test('Exact source-domain filtering uses citation URLs, not publisher strings or tags',()=>{
 const story={id:'NEWS-1',title:'Reuters-mentioned project',summary:'Evidence',review_status:'source_checked',source_url:'https://www.reuters.com/world/story'};
 assert.equal(D.sourceHost(story.source_url),'www.reuters.com');
 assert.equal(D.sourceHost('javascript:alert(1)'),'');
 assert.equal(D.matchesSource(story,'www.reuters.com'),true);
 assert.equal(D.matchesSource(story,'reuters.com'),false);
 assert.equal(D.matchesSource({...story,source_url:'https://reuters.com.evil.test/story'},'www.reuters.com'),false);
 assert.equal(D.matchesSource({...story,source_url:undefined},'www.reuters.com'),false);
 assert.equal(D.matchesSource(story,'all'),true);
 const e=entry('2026-11-02',19);
 const link=D.filterPermalink(e,{section:'news',source:'www.reuters.com'});
 assert.equal(link,D.permalink(e)+'&section=news&source=www.reuters.com');
 assert.equal(D.viewFilters(link.slice(link.indexOf('?'))).source,'www.reuters.com');
 assert.equal(D.viewFilters('?source=www.reuters.com&source=evil.example').source,'all');
 assert.equal(D.viewFilters('?source=javascript%3Aalert%281%29').source,'all');
 assert.equal(D.viewFilters('?source=example..com').source,'all');
 assert.equal(D.filterPermalink(e,{source:'bad/host'}),D.permalink(e));
});

test('Verified evidence CSV uses the same exact citation-host filter as on-page view',()=>{
 const e=edition(),indexEntry=entry('2026-11-02');
 e.news=[
  {id:'NEWS-1',title:'Source A',summary:'First',review_status:'source_checked',source_url:'https://www.reuters.com/report'},
  {id:'NEWS-2',title:'Source B',summary:'Second',review_status:'source_checked',source_url:'https://example.org/report'}
 ];
 const csv=D.citationCsv(e,indexEntry,{source:'www.reuters.com'});
 assert.match(csv,/Source A/);
 assert.doesNotMatch(csv,/Source B/);
 assert.equal((csv.match(/\r\n/g)||[]).length,2);
});

test('Source filter is disabled before immutable edition checks and resets with other filters',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 assert.match(html,/<label for="source-filter">Source domain<select id="source-filter" disabled>/);
 assert.match(js,/populateSourceOptions\(e\)/);
 assert.match(js,/source-filter'\)\.disabled=true/);
 assert.match(js,/source-filter'\)\.value='all'/);
 assert.match(js,/C\.matchesSource\(item,source\)/);
});

test('Retrospective v20 adds only source-domain filtering as an Atlas site change',()=>{
 const crypto=require('node:crypto'),idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const prev=idx.editions.find(x=>x.date==='2026-11-02'&&x.revision===19);
 const cur=idx.editions.find(x=>x.date==='2026-11-02'&&x.revision===20);
 assert.ok(prev&&cur);
 const bytes=fs.readFileSync(cur.path);
 assert.equal(bytes.length,cur.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),cur.sha256);
 const before=D.validateEdition(JSON.parse(fs.readFileSync(prev.path,'utf8')),prev);
 const after=D.validateEdition(JSON.parse(bytes.toString('utf8')),cur);
 assert.equal(D.chicagoDate(after.published_at),'2026-11-03');
 for(const key of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(after[key],before[key]);
 const diff=D.revisionDiff(before,after);
 assert.deepEqual(diff.site_changes.added.map(x=>x.id),['site-verified-source-domain-filter-20261103']);
 assert.equal(diff.site_changes.updated.length+diff.site_changes.removed.length,0);
 assert.match(diff.site_changes.added[0].summary,/not new external news/i);
 assert.equal(D.selection(idx,'2026-11-03').todayEntry,null,'No Nov 3 collection was manufactured');
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.equal(receipt.publication_edition,'2026-11-02-v20');
 assert.equal(receipt.publication_history.at(-1).edition,'2026-11-02-v20');
 assert.equal(receipt.deferred_catalog_proposal_ids.length,7);
 assert.equal(receipt.counts.news_published,9);
 assert.equal(receipt.counts.technology_added+receipt.counts.term_added,0);
});

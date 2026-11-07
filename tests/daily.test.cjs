const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../daily-core.js');
function verifiedPublicationClock(){
 const receipts=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts;
 return receipts.at(-1).production_verified_at || receipts[0].production_verified_at;
}
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


test('daily archive uses the compact Discover-style mobile navigation and a real search destination',()=>{
 const html=fs.readFileSync('whats-new.html','utf8');
 assert.match(html,/<div class="mobile-topbar site-mobile-chrome" data-page-label="What’s New Today">/);
 assert.match(html,/<details class="archive-mobile-nav site-mobile-chrome__nav" id="archive-mobile-nav">/);
 assert.match(html,/<nav class="archive-menu-panel site-mobile-chrome__menu" aria-label="AI Updates sections">/);
 assert.match(html,/<a href="whats-new\.html" aria-current="page">What’s New Today<\/a>/);
 assert.match(html,/<a class="archive-search-link site-mobile-chrome__search" href="index\.html#\/search"/);
 assert.match(html,/@media\(max-width:650px\)\{\s*\.top\{display:none\}/);
});

test('daily reader leads with verified briefing and stories before supplemental archive statistics',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 const order=['id="edition-status"','id="edition-summary"','class="panel"','id="edition-content"','id="edition-snapshot"','id="edition-metadata"','id="source-coverage"','id="revision-history"'];
 const positions=order.map(token=>html.indexOf(token));
 assert.ok(positions.every((pos,i)=>pos>=0&&(i===0||pos>positions[i-1])), 'Reading order must prioritize stories over edition audit: '+positions);
 assert.match(html,/class="site-chrome__name">AI Updates<small>THE FRONTIER, IN CONTEXT<\/small>/);
 assert.match(html,/\.edition-footnotes\{/);
 assert.match(js,/element\('p',undefined,'why'\)/);
 const freeze=JSON.parse(fs.readFileSync('publication.json','utf8'));
 assert.equal(freeze.published_counts.terms,1345);
});

test('daily archive loading text is neutral until the index proves a dated edition exists',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 const initial=html.match(/<div id="edition-content" aria-busy="true">([\s\S]*?)<\/div><\/div>/);
 assert.ok(initial, 'Initial archive must advertise its pending state to assistive technology');
 assert.match(initial[1],/Checking published editions/);
 assert.doesNotMatch(initial[1],/Awaiting the first reviewed edition/);
 assert.match(js,/setAttribute\('aria-busy','false'\)/);
 assert.match(js,/No verified archive edition is available on or before/);
 assert.match(js,/Awaiting the first reviewed edition\. No unverified headlines/);
});

test('archive record links identify their destination for screen-reader link lists',()=>{
 const js=fs.readFileSync('whats-new.js','utf8');
 assert.ok(js.includes("source.setAttribute('aria-label','Original source for '+item.title+' (opens in new tab)')"));
 assert.ok(js.includes("internal.setAttribute('aria-label','Explore '+item.title+' in AI Updates')"));
});

test('Revision comparison links have record-specific screen-reader names',()=>{
 const js=fs.readFileSync('whats-new.js','utf8');
 assert.ok(js.includes("dest.setAttribute('aria-label','Explore '+item.title+' in AI Updates (revision comparison)')"));
 assert.ok(js.includes("source.setAttribute('aria-label','Source for '+item.title+' (opens in new tab)')"));
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
 assert.deepEqual(D.viewFilters(url.slice(url.indexOf('?'))),{section:'news',topic:'safety',review:'all',source:'all',publication:'all',query:'AI agent'});
 assert.deepEqual(D.viewFilters('?section=bad&topic=invalid&q='+('a'.repeat(121))),{section:'all',topic:'all',review:'all',source:'all',publication:'all',query:''});
 assert.deepEqual(D.viewFilters('?section=news&section=terms&topic=research&topic=safety&q=a&q=b'),{section:'all',topic:'all',review:'all',source:'all',publication:'all',query:''});
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
 "if(!records.length&&(topic!=='all'||review!=='all'||source!=='all'||publication!=='all'||query.trim()))continue",
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
 assert.equal(first.deferred_catalog_proposal_ids.length,5);
 assert.deepEqual(first.accepted_catalog_update_ids,['tech-proposal:vllm:2026-11-02-rc3']);
 assert.equal(first.counts.technology_updated,1);
 assert.equal(first.counts.catalog_deferred,5);
 assert.equal(first.counts.term_added,0);
 assert.equal(first.counts.technology_added,2);
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
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
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
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
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
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
 assert.equal(receipt.counts.term_added,0);
 assert.equal(receipt.counts.technology_added,2);
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
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
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
 assert.equal(ledger.receipts[0].deferred_catalog_proposal_ids.length,5);
 assert.equal(ledger.receipts[0].counts.technology_added,2);
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
 assert.equal(ledger.receipts.length,2,'Genuine Nov 3 batch receipt joins the historical Nov 2 receipt');
 assert.ok(ledger.receipts[0].publication_history.some(h=>h.edition==='2026-11-02-v9'));
 assert.equal(ledger.receipts[0].publication_edition,ledger.receipts[0].publication_history.at(-1).edition);
 assert.equal(ledger.receipts[0].deferred_catalog_proposal_ids.length,5);
 assert.equal(ledger.receipts[0].counts.news_published,9);
 assert.equal(ledger.receipts[0].counts.term_added,0);
 assert.equal(ledger.receipts[0].counts.technology_added,2);
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
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
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
 assert.equal(r.counts.technology_added,2);
 assert.equal(r.deferred_catalog_proposal_ids.length,5);
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
  assert.equal(r.deferred_catalog_proposal_ids.length,5);
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
 assert.equal(r.deferred_catalog_proposal_ids.length,5);
 assert.equal(r.counts.news_published,9);
 assert.equal(r.counts.technology_added,2);
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
  assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
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
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
 assert.equal(receipt.counts.term_added,0);
 assert.equal(receipt.counts.technology_added,2);
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
 assert.equal(ledger.deferred_catalog_proposal_ids.length,5);
 assert.equal(ledger.counts.news_published,9);
 assert.equal(ledger.counts.term_added,0);
 assert.equal(ledger.counts.technology_added,2);
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
 assert.equal(ledger.deferred_catalog_proposal_ids.length,5);
 assert.equal(ledger.counts.news_published,9);
 assert.equal(ledger.counts.technology_added,2);
 assert.equal(ledger.counts.term_added,0);
 assert.ok(D.selection(idx,'2026-11-03').todayEntry?.revision>=4,'November 3 collected edition and subsequent immutable v2 must be indexed');
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
test('Archive search stays disabled until an edition is SHA-verified',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 assert.match(html,/id="edition-search"[^>]*disabled/);
 assert.match(html,/id="edition-search"[^>]*aria-describedby="filter-results"/);
 assert.ok(js.includes("$('edition-search').disabled=false;"));
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
 assert.ok(D.selection(idx,'2026-11-03').todayEntry?.revision>=4,'The November 3 collector edition remains separate from November 2 retrospectives');
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(ledger.publication_history.some(h=>h.edition==='2026-11-02-v18'&&h.status==='cloudflare_http_browser_and_githack_verified'));
 assert.equal(ledger.publication_history.at(-1).edition,ledger.publication_edition);
 assert.equal(ledger.deferred_catalog_proposal_ids.length,5);
 assert.equal(ledger.counts.news_published,9);
 assert.equal(ledger.counts.technology_added,2);
 assert.equal(ledger.counts.term_added,0);
});

test('Archive verification metadata agrees with the last actual production receipt',()=>{
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 const revision=receipt.production_verified_revision;
 assert.ok(Number.isInteger(revision)&&revision>=18);
 const activeReceipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts.at(-1);
 const latest=idx.editions.at(-1).revision;
 const isLatestVerified=activeReceipt.production_verified_at!==null && activeReceipt.publication_edition===idx.editions.at(-1).date+'-v'+latest && activeReceipt.publication_history.at(-1).status==='cloudflare_http_browser_and_githack_verified';
 const expectedStatus='edition_revision_'+latest+(isLatestVerified?'_production_verified':'_pending_production_verification');
 assert.equal(idx.status,expectedStatus);
 assert.equal(idx.last_successful_publish_at,verifiedPublicationClock(),'Last successful publication must match latest independently verified batch');
 assert.ok(idx.editions.some(e=>e.date===receipt.edition_date&&e.revision===revision));
 assert.ok(idx.coverage_note.includes('revision '+latest) || idx.coverage_note.includes('v'+latest),'Coverage note identifies the newest indexed edition');
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
 assert.ok(D.selection(idx,'2026-11-03').todayEntry?.revision>=4);
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v19'&&h.status==='cloudflare_http_browser_and_githack_verified'));
 assert.ok(receipt.production_verified_revision>=19);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
 assert.equal(receipt.counts.news_published,9);
 assert.equal(receipt.counts.technology_added+receipt.counts.term_added,2);
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
 assert.ok(D.selection(idx,'2026-11-03').todayEntry?.revision>=4,'Actual Nov 3 collector batch and site-only v2 must stay separate from Nov 2');
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(receipt.publication_history.some(h=>h.edition==='2026-11-02-v20'), 'Immutable historical revision 20 must remain in the receipt ledger');
 assert.equal(receipt.publication_history.at(-1).edition,receipt.publication_edition, 'Latest receipt head and history must agree');
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
 assert.equal(receipt.counts.news_published,9);
 assert.equal(receipt.counts.technology_added+receipt.counts.term_added,2);
});

test('Retrospective v21 records reviewed catalog candidates without claiming world news or a November 3 edition',()=>{
 const crypto=require('node:crypto');
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const beforeEntry=idx.editions.find(x=>x.date==='2026-11-02'&&x.revision===20);
 const afterEntry=idx.editions.find(x=>x.date==='2026-11-02'&&x.revision===21);
 assert.ok(beforeEntry&&afterEntry);
 const payload=fs.readFileSync(afterEntry.path);
 assert.equal(payload.length,afterEntry.bytes);
 assert.equal(crypto.createHash('sha256').update(payload).digest('hex'),afterEntry.sha256);
 const prior=D.validateEdition(JSON.parse(fs.readFileSync(beforeEntry.path,'utf8')),beforeEntry);
 const next=D.validateEdition(JSON.parse(payload.toString('utf8')),afterEntry);
 assert.equal(D.chicagoDate(next.published_at),'2026-11-03');
 for(const kind of ['news','technologies','terms','coverage','corrections'])assert.deepEqual(next[kind],prior[kind]);
 const diff=D.revisionDiff(prior,next);
 assert.deepEqual(diff.site_changes.added.map(x=>x.id),['site-reviewed-seven-deferred-candidates-20261103']);
 assert.equal(diff.site_changes.updated.length+diff.site_changes.removed.length,0);
 const record=diff.site_changes.added[0];
 assert.equal(record.catalog_path,'catalog-review.html');
 assert.match(record.summary,/not.*new permanent catalog entry|none is yet a new permanent catalog entry/i);
 assert.match(record.release_status,/not_new_world_event/);
 assert.equal(D.safeCatalogPath('catalog-review.html'),'catalog-review.html');
 assert.equal(D.safeCatalogPath('catalog-review.html?inject=1'),'');
 assert.ok(D.selection(idx,'2026-11-03').todayEntry?.revision>=4);
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 assert.ok(ledger.publication_history.some(h=>h.edition==='2026-11-02-v21'&&h.status==='cloudflare_http_browser_and_githack_verified'), 'Preserve verified v21 receipt');
 const latest=idx.editions.filter(e=>e.date==='2026-11-02').at(-1); // The historical first receipt refers to Nov 2, not the new dated edition.
 assert.equal(ledger.publication_edition,latest.date+'-v'+latest.revision);
 assert.equal(ledger.publication_history.at(-1).edition,ledger.publication_edition);
 assert.equal(ledger.deferred_catalog_proposal_ids.length,5);
 assert.equal(ledger.counts.technology_added+ledger.counts.term_added,2);
 assert.equal(idx.last_successful_publish_at,verifiedPublicationClock(),'Last successful publication must match latest independently verified batch');
});


test('Retrospective v23 adds only two real Atlas drift guides and leaves the Nov 2 collector evidence untouched',()=>{
 const fs=require('node:fs'),crypto=require('node:crypto');
 const before=fs.readFileSync('data/daily/editions/2026-11-02-v22.json');
 const after=fs.readFileSync('data/daily/editions/2026-11-02-v23.json');
 const old=JSON.parse(before),updated=JSON.parse(after),index=JSON.parse(fs.readFileSync('data/daily/index.json'));
 const entry=index.editions.find(e=>e.date==='2026-11-02'&&e.revision===23);
 assert.ok(entry&&entry.bytes===after.length&&entry.sha256===crypto.createHash('sha256').update(after).digest('hex'));
 assert.equal(D.chicagoDate(updated.published_at),'2026-11-03');
 for(const key of ['coverage','news','technologies','terms','corrections'])assert.deepEqual(updated[key],old[key]);
 assert.deepEqual(D.revisionDiff(old,updated).site_changes.added.map(x=>x.id),['site-expanded-concept-drift-20261103','site-expanded-data-drift-20261103']);
 for(const change of updated.site_changes.slice(-2)){
   assert.match(change.release_status,/not_new_world_event/);
   assert.match(change.review_status,/pending_production_verification/);
   assert.ok(fs.existsSync(change.catalog_path),'Missing existing term path '+change.catalog_path);
 }
 assert.ok(D.selection(index,'2026-11-03').todayEntry?.revision>=4);
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json')).receipts[0];
 assert.ok(receipt.production_verified_revision>=22, 'Must retain previously verified revision 22');
 const v22=receipt.publication_history.find(h=>h.edition==='2026-11-02-v22');
 const v23=receipt.publication_history.find(h=>h.edition==='2026-11-02-v23');
 assert.equal(v22?.status,'cloudflare_http_browser_and_githack_verified');
 assert.equal(v23?.site_changes_added_in_revision,2);
 if(receipt.production_verified_revision>=23)assert.equal(v23.status,'cloudflare_http_browser_and_githack_verified');
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
 assert.equal(receipt.counts.news_published,9);
});

test('Retrospective v24 records one source-attributed catalog-review site change without new-world claims',()=>{
 const crypto=require('node:crypto');
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const priorEntry=idx.editions.find(x=>x.date==='2026-11-02'&&x.revision===23);
 const currentEntry=idx.editions.find(x=>x.date==='2026-11-02'&&x.revision===24);
 assert.ok(priorEntry&&currentEntry,'Both immutable versions must be indexed');
 const before=JSON.parse(fs.readFileSync(priorEntry.path,'utf8'));
 const bytes=fs.readFileSync(currentEntry.path),after=JSON.parse(bytes.toString('utf8'));
 assert.equal(bytes.length,currentEntry.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),currentEntry.sha256);
 D.validateIndex(idx);D.validateEdition(after,currentEntry);
 assert.equal(after.edition_date,'2026-11-02');
 assert.ok(after.published_at.startsWith('2026-11-03'));
 assert.ok(after.site_changes.at(-1).added_to_atlas_at.startsWith('2026-11-03'));
 for(const kind of ['news','technologies','terms','corrections'])assert.deepEqual(after[kind],before[kind],'Original '+kind+' changed');
 assert.deepEqual(after.coverage,before.coverage,'Original collection coverage changed');
 const delta=D.revisionDiff(before,after);
 assert.deepEqual(delta.site_changes.added.map(x=>x.id),['site-catalog-candidate-audit-json-20261103']);
 assert.equal(after.site_changes.at(-1).catalog_path,'catalog-review.html');
 assert.match(after.site_changes.at(-1).summary,/not seven new technologies|not seven new technologies or terms/i);
 assert.match(after.site_changes.at(-1).review_status,/editorial_audit/);
 const receipt=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8')).receipts[0];
 const priorV24=receipt.publication_history.find(h=>h.edition==='2026-11-02-v24');
 assert.ok(priorV24,'Immutable v24 receipt must remain present');
 assert.equal(priorV24.site_changes_added_in_revision,1);
 assert.ok(receipt.production_verified_revision>=23,'Earlier verified release must not regress');
 if(receipt.production_verified_revision>=24) assert.equal(priorV24.status,'cloudflare_http_browser_and_githack_verified','Certification requires a matching verified receipt');
 else assert.equal(priorV24.status,'pending_production_verification','Pending edition cannot be certified early');
 assert.equal(idx.last_successful_publish_at,verifiedPublicationClock(),'Last successful publication must match latest independently verified batch');
 assert.equal(receipt.deferred_catalog_proposal_ids.length,5);
 assert.equal(receipt.counts.news_published,9);
 assert.equal(receipt.counts.technology_added+receipt.counts.term_added,2);
 assert.ok(D.selection(idx,'2026-11-03').todayEntry?.revision>=4,'Original Nov 3 batch is present with the site-only revision');
});

test('NVIDIA Auto Ontology is a checksum-pinned Atlas addition, not an invented new launch',()=>{
 const path=require('node:path'),crypto=require('node:crypto'),root=path.join(__dirname,'..');
 const buf=fs.readFileSync(path.join(root,'data/technologies-07.json'));
 const rec=JSON.parse(buf)[0];
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'publication.json')));
 const file=manifest.extensions.technologies.find(x=>x.path==='data/technologies-07.json');
 assert.equal(manifest.prepared_counts.technologies,300);
 assert.equal(manifest.published_counts.technologies,303);
 assert.equal(file.path,'data/technologies-07.json');
 assert.equal(file.count,2);
 assert.equal(file.bytes,buf.byteLength);
 assert.equal(file.sha256,crypto.createHash('sha256').update(buf).digest('hex'));
 assert.equal(rec.id,'TECH-0301');
 assert.equal(rec.initial_release_date,null);
 assert.equal(rec.catalog_added_on,'2026-11-03');
 assert.deepEqual(rec.concept_ids,['MLD-0608','MLD-1104','MLD-1033']);
 assert.match(rec.evidence_status,/not independently reproduced/);
 assert.equal(rec.source_revision,'cdaf61e1bd0cf3820d11d72b43bb460816aebbd3');
 assert.match(rec.watch_out,/FastAPI/);
});

test('audit and canonical technology addition resolve the same deferred proposal',()=>{
 const path=require('node:path'),root=path.join(__dirname,'..');
 const audit=JSON.parse(fs.readFileSync(path.join(root,'data/catalog-candidate-decisions-2026-11-03.json')));
 const item=audit.candidates.find(x=>x.proposal_id==='tech-proposal:nvidia-auto-ontology:2026-11-02');
 const record=JSON.parse(fs.readFileSync(path.join(root,'data/technologies-07.json')))[0];
 assert.equal(item.canonical_id,record.id);
 assert.equal(item.publication_state,'canonical_catalog_added_new_to_atlas');
 assert.equal(audit.candidates.filter(x=>x.publication_state==='deferred_not_in_canonical_catalog').length,5);
});

test('first-paint technology navigation matches the checksummed catalog count',()=>{
 const path=require('node:path'),root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const m=JSON.parse(fs.readFileSync(path.join(root,'publication.json')));
 const tech=html.match(/<a class="nav-link" data-view="technologies" href="#[/]technologies">[^]*?<span class="nav-count">([0-9]+)<[/]span><[/]a>/);
 assert.ok(tech,'Missing first-paint technology badge');
 assert.equal(Number(tech[1]),m.published_counts.technologies);
});

test('Windmill is an explicitly dated, source-reviewed canonical Atlas addition',()=>{
 const path=require('node:path'),root=path.join(__dirname,'..');
 const row=JSON.parse(fs.readFileSync(path.join(root,'data/technologies-07.json'))).find(x=>x.id==='TECH-0302');
 const m=JSON.parse(fs.readFileSync(path.join(root,'publication.json')));
 const a=JSON.parse(fs.readFileSync(path.join(root,'data/catalog-candidate-decisions-2026-11-03.json')));
 const candidate=a.candidates.find(x=>x.proposal_id==='tech-proposal:windmill:2026-11-02');
 assert.ok(row&&candidate);assert.equal(row.name,'Windmill');
 assert.equal(row.catalog_added_on,'2026-11-03');assert.equal(row.initial_release_date,null);
 assert.equal(row.source_revision,'v1.856.0');
 assert.deepEqual(row.concept_ids,['MLD-0043','MLD-0851','MLD-1246']);
 assert.deepEqual(row.alternative_ids,['TECH-0258','TECH-0007']);
 assert.match(row.access,/AGPLv3/);assert.match(row.access,/proprietary/);
 assert.match(row.watch_out,/OIDC/);assert.match(row.evidence_status,/not independently reproduced/);
 assert.ok(row.primary_sources.length>=3&&row.primary_sources.every(x=>x.url.startsWith('https://')));
 assert.equal(candidate.canonical_id,row.id);
 assert.equal(candidate.catalog_path,'technology/TECH-0302-windmill.html');
 assert.equal(candidate.publication_state,'canonical_catalog_added_new_to_atlas');
 assert.equal(m.catalog_additions.technologies.filter(x=>x.id===row.id).length,1);
});

test('Immutable v25 records the actual TECH-0302 Atlas catalog addition without fabricating November 3 news',()=>{
 const crypto=require('node:crypto'),path=require('node:path'),root=path.join(__dirname,'..');
 const idx=JSON.parse(fs.readFileSync(path.join(root,'data/daily/index.json')));
 const ref=idx.editions.find(e=>e.date==='2026-11-02'&&e.revision===25);
 const oldRef=idx.editions.find(e=>e.date==='2026-11-02'&&e.revision===24);
 assert.ok(ref&&oldRef);
 const blob=fs.readFileSync(path.join(root,ref.path));
 assert.equal(blob.length,ref.bytes);
 assert.equal(crypto.createHash('sha256').update(blob).digest('hex'),ref.sha256);
 const after=JSON.parse(blob),before=JSON.parse(fs.readFileSync(path.join(root,oldRef.path)));
 D.validateIndex(idx);D.validateEdition(after,ref);
 assert.equal(after.edition_date,'2026-11-02');
 assert.equal(D.chicagoDate(after.published_at),'2026-11-03');
 for(const k of ['news','technologies','terms','corrections'])assert.deepEqual(after[k],before[k],'Original news source or proposed catalog changed: '+k);
 assert.deepEqual(after.coverage,before.coverage,'Original partial source window must be retained');
 const delta=D.revisionDiff(before,after);
 assert.deepEqual(delta.site_changes.added.map(x=>x.id),['site-windmill-TECH-0302-canonical-added-20261103']);
 const change=delta.site_changes.added[0];
 assert.equal(change.catalog_path,'technology/TECH-0302-windmill.html');
 assert.ok(fs.existsSync(path.join(root,change.catalog_path)));
 assert.match(change.summary,/not a new product launch/);
 const r=JSON.parse(fs.readFileSync(path.join(root,'data/daily/published-batches.json'))).receipts[0];
 assert.equal(r.publication_edition,'2026-11-02-v25');
 assert.equal(r.publication_history.at(-1).edition,'2026-11-02-v25');
 assert.equal(r.counts.technology_added,2);
 assert.equal(r.counts.catalog_deferred,5);
 assert.equal(r.deferred_catalog_proposal_ids.length,5);
 assert.deepEqual(r.accepted_catalog_addition_ids,['tech-proposal:nvidia-auto-ontology:2026-11-02','tech-proposal:windmill:2026-11-02']);
 const m=JSON.parse(fs.readFileSync(path.join(root,'publication.json')));
 assert.equal(m.published_counts.technologies,m.prepared_counts.technologies+m.catalog_additions.technologies.length,'Subsequent additions cannot be hidden from the current catalog');
 assert.deepEqual(m.catalog_additions.technologies.slice(0,2).map(x=>x.source_proposal_id),r.accepted_catalog_addition_ids,'Earlier receipt remains the historical two-addition event');
 assert.equal(idx.last_successful_publish_at,verifiedPublicationClock(),'Last successful publication must match latest independently verified batch');
 const activeReceipt=JSON.parse(fs.readFileSync(path.join(root,'data/daily/published-batches.json'))).receipts.at(-1),lastIndexEntry=idx.editions.at(-1);
 assert.equal(idx.status,'edition_revision_'+lastIndexEntry.revision+(activeReceipt.publication_edition===lastIndexEntry.date+'-v'+lastIndexEntry.revision&&activeReceipt.publication_history.at(-1).status==='cloudflare_http_browser_and_githack_verified'?'_production_verified':'_pending_production_verification'));
 assert.ok(r.publication_history.at(-1).status==='pending_production_verification'||r.publication_history.at(-1).status==='cloudflare_http_browser_and_githack_verified');
 assert.ok(D.selection(idx,'2026-11-03').todayEntry?.revision>=4);
});

test('Source-reviewed November 3 daily edition is immutable, deduplicated, dated, and honest about incomplete coverage',()=>{
 const crypto=require('node:crypto'), path=require('node:path'), root=path.join(__dirname,'..');
 const idx=JSON.parse(fs.readFileSync(path.join(root,'data/daily/index.json'),'utf8'));
 const ref=idx.editions.find(e=>e.date==='2026-11-03'&&e.revision===1);
 assert.ok(ref && ref.date==='2026-11-03' && ref.revision===1,'Actual collected Nov 3 edition must be indexed');
 const buf=fs.readFileSync(path.join(root,ref.path));
 assert.equal(ref.bytes,buf.length);
 assert.equal(ref.sha256,crypto.createHash('sha256').update(buf).digest('hex'));
 const today=D.validateEdition(JSON.parse(buf.toString('utf8')),ref);
 assert.equal(today.coverage.status,'partial');
 assert.equal(today.coverage.sources_checked.length,14);
 assert.equal(today.coverage.sources_failed.length,3);
 assert.equal(today.news.length,8);
 assert.equal(today.news.filter(r=>r.publication_date==='2026-11-03').length,4);
 assert.equal(today.news.filter(r=>r.publication_date<'2026-11-03').length,4,'Catch-up items retain their earlier source dates');
 assert.deepEqual([today.technologies.length,today.terms.length,today.site_changes.length,today.corrections.length],[0,0,0,0],'Unintegrated proposals cannot be counted as catalog additions');
 assert.ok(today.tldr.length>=2&&today.tldr.length<=3);
 const previous=JSON.parse(fs.readFileSync(path.join(root,'data/daily/editions/2026-11-02-v25.json')));
 const sourceUrls=new Set(previous.news.map(n=>n.source_url));
 const ids=new Set(),urls=new Set();
 for(const item of today.news){
  assert.ok(!ids.has(item.id),'Duplicated public news ID');ids.add(item.id);
  assert.ok(!sourceUrls.has(item.source_url) && !urls.has(item.source_url),'Duplicated canonical news URL');urls.add(item.source_url);
  assert.ok(item.source_url.startsWith('https://'));
  assert.ok(/publisher_checked|original_reuters_reporting/.test(item.review_status));
  assert.ok(item.caveat && item.why_it_matters);
  assert.ok(Date.parse(item.discovered_at)<=Date.parse(today.coverage.end));
 }
 assert.ok(today.news.some(n=>/investigation_not_adjudicated/.test(n.review_status)));
 assert.ok(today.news.some(n=>/prototype_results_unreplicated/.test(n.review_status)));
 assert.equal(idx.last_successful_publish_at,verifiedPublicationClock(),'Last successful publication must match latest independently verified batch');
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'data/daily/published-batches.json'),'utf8'));
 assert.equal(ledger.receipts.length,2);
 const receipt=ledger.receipts[1];
 assert.equal(receipt.batch_id,'atlas-daily-20261103-0824ct-recovery-a');
 assert.equal(receipt.source_batch_sha256,'f6d155caec1fda714b8fdd456ec47cc886dd10856159b65b9745c69d64b9adb3');
 assert.equal(receipt.source_batch_bytes,32219);
 assert.equal(receipt.source_commit,'9a2d9a0f21551737b041a49e398ebf08793272ae');
 assert.equal(receipt.publication_edition,'2026-11-03-v6');
 assert.equal(receipt.counts.news_published,8);
 assert.equal(receipt.counts.catalog_deferred,3);
 assert.equal(new Set(receipt.accepted_news_ids).size,8);
 assert.equal(new Set(receipt.deferred_catalog_proposal_ids).size,3);
 assert.ok(receipt.production_verified_at===null||D.validTimestamp(receipt.production_verified_at));
 assert.equal(ledger.receipts[0].production_verified_revision,25,'Keep verified November 2 history unchanged');
});

test('November 3 v2 records actual Atlas guide expansions, without rewriting reviewed news or source dates',()=>{
 const crypto=require('node:crypto'),path=require('node:path'),root=path.join(__dirname,'..');
 const idx=JSON.parse(fs.readFileSync(path.join(root,'data/daily/index.json'),'utf8'));
 D.validateIndex(idx);
 const ref=idx.editions.find(e=>e.date==='2026-11-03'&&e.revision===2);
 assert.ok(ref && ref.revision===2);
 const raw=fs.readFileSync(path.join(root,ref.path));
 assert.equal(raw.length,ref.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),ref.sha256);
 const now=D.validateEdition(JSON.parse(raw.toString('utf8')),ref);
 const original=JSON.parse(fs.readFileSync(path.join(root,'data/daily/editions/2026-11-03-v1.json'),'utf8'));
 for(const kind of ['news','technologies','terms','corrections'])assert.deepEqual(now[kind],original[kind],'Original source evidence changed: '+kind);
 assert.deepEqual(now.coverage,original.coverage,'Original partial collection cannot be rewritten');
 const delta=D.revisionDiff(original,now);
 assert.equal(delta.site_changes.added.length,2);
 assert.deepEqual(delta.site_changes.added.map(c=>c.id),['site-expanded-defense-in-depth-20261103','site-expanded-instruction-hierarchy-20261103']);
 for(const x of delta.site_changes.added){
  assert.equal(x.release_status,'atlas_educational_improvement_not_new_world_event');
  assert.match(x.review_status,/previously_production_verified/);
  assert.ok(x.added_to_atlas_at.startsWith('2026-11-03'));
  assert.ok(!x.publication_date&&!x.event_date,'No fabricated external event timestamp');
  assert.ok(fs.existsSync(path.join(root,x.catalog_path)),'Canonical guide missing: '+x.catalog_path);
  assert.equal(x.source_url,'https://github.com/hazelfjeld/ai-atlas/pull/39');
 }
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'data/daily/published-batches.json'),'utf8'));
 const receipt=ledger.receipts.at(-1);
 assert.equal(receipt.publication_edition,'2026-11-03-v6');
 assert.equal(receipt.publication_history.at(-1).edition,'2026-11-03-v6');
 assert.equal(receipt.production_verified_revision>=1,true,'Prior verified v1 must remain in history');
 assert.equal(receipt.deferred_catalog_proposal_ids.length,3);
 assert.equal(idx.last_successful_publish_at,verifiedPublicationClock(),'Pending revision cannot advance verified publication clock');
});


test('November 3 v3 archives only already-published hardware research site changes with trustworthy deep links',()=>{
 const crypto=require('node:crypto'),path=require('node:path'),root=path.join(__dirname,'..');
 const idx=JSON.parse(fs.readFileSync(path.join(root,'data/daily/index.json'),'utf8'));
 D.validateIndex(idx);
 const ref=idx.editions.find(e=>e.date==='2026-11-03'&&e.revision===3);
 assert.equal(ref?.revision,3,'Immutable historical version 3 remains available');
 const bytes=fs.readFileSync(path.join(root,ref.path));
 assert.equal(bytes.length,ref.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),ref.sha256);
 const next=D.validateEdition(JSON.parse(bytes.toString('utf8')),ref);
 const prior=JSON.parse(fs.readFileSync(path.join(root,'data/daily/editions/2026-11-03-v2.json'),'utf8'));
 for(const kind of ['news','technologies','terms','corrections','coverage'])assert.deepEqual(next[kind],prior[kind],'Historical reporting or source window mutated: '+kind);
 assert.equal(next.news.length,8);
 assert.equal(next.site_changes.length,4);
 assert.equal(next.coverage.sources_checked.length,14);
 assert.equal(next.coverage.sources_failed.length,3);
 const delta=D.revisionDiff(prior,next);
 assert.deepEqual(delta.site_changes.added.map(x=>x.id),['site-nov03-candidate-evidence-review-20261103','site-stt-mram-technical-explainer-20261103']);
 assert.equal(delta.site_changes.removed.length+delta.site_changes.updated.length,0);
 for(const change of delta.site_changes.added){
  assert.ok(change.release_status.includes('not_new_world_event'));
  assert.ok(change.review_status.includes('previously_production_verified'));
  assert.ok(!change.publication_date&&!change.event_date,'Do not invent outside-world release/event dates');
  assert.ok(change.added_to_atlas_at.startsWith('2026-11-03'));
  assert.ok(change.source_url.startsWith('https://github.com/hazelfjeld/ai-atlas/pull/'));
  assert.equal(D.safeCatalogPath(change.catalog_path),change.catalog_path);
  assert.ok(fs.existsSync(path.join(root,change.catalog_path)));
 }
 assert.equal(D.safeCatalogPath('hardware-review.html'),'hardware-review.html');
 assert.equal(D.safeCatalogPath('hardware-review.html?spoof=1'),'');
 assert.equal(D.safeCatalogPath('../hardware-review.html'),'');
 const receipt=JSON.parse(fs.readFileSync(path.join(root,'data/daily/published-batches.json'),'utf8')).receipts.at(-1);
 assert.equal(receipt.publication_edition,'2026-11-03-v6');
 const archivedV3=receipt.publication_history.find(h=>h.edition==='2026-11-03-v3');
 assert.ok(archivedV3,'Immutable prior verification history missing');
 assert.equal(archivedV3.production_commit,'fc565eefb38b17e0b1a6dac28446297843a8e590');
 assert.equal(archivedV3.production_workflow_run_id,41703813098);
 assert.equal(archivedV3.githack_workflow_run_id,41703812947);
 assert.equal(receipt.production_verified_revision,6,'Current verified revision must match deployed proof');
 assert.equal(receipt.publication_history.at(-1).edition,'2026-11-03-v6');
 assert.equal(receipt.publication_history.find(h=>h.edition==='2026-11-03-v3').status,'cloudflare_http_browser_and_githack_verified');
 assert.ok(['pending_production_verification','cloudflare_http_browser_and_githack_verified'].includes(receipt.publication_history.at(-1).status));
 assert.equal(receipt.deferred_catalog_proposal_ids.length,3);
 assert.equal(idx.last_successful_publish_at,receipt.production_verified_at,'Never imply a pending edition has passed production');
});


test('Immutable November 3 revision 4 indexes two previously verified guides and publication-date filters only as Atlas improvements',()=>{
 const crypto=require('node:crypto'),path=require('node:path'),root=path.join(__dirname,'..');
 const idx=JSON.parse(fs.readFileSync(path.join(root,'data/daily/index.json'),'utf8'));
 D.validateIndex(idx);
 const ref=idx.editions.find(x=>x.date==='2026-11-03'&&x.revision===4);
 assert.equal(ref?.revision,4); // Historical v4 must remain independently addressable as later immutable revisions arrive.
 const raw=fs.readFileSync(path.join(root,ref.path));
 assert.equal(raw.length,ref.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),ref.sha256);
 const next=D.validateEdition(JSON.parse(raw.toString('utf8')),ref);
 const old=JSON.parse(fs.readFileSync(path.join(root,'data/daily/editions/2026-11-03-v3.json'),'utf8'));
 for(const k of ['news','technologies','terms','corrections','coverage'])assert.deepEqual(next[k],old[k],'Source evidence changed: '+k);
 assert.equal(next.news.length,8);
 assert.equal(next.coverage.sources_checked.length,14);
 assert.equal(next.coverage.sources_failed.length,3);
 assert.equal(next.site_changes.length,7);
 const delta=D.revisionDiff(old,next);
 assert.deepEqual(delta.site_changes.added.map(x=>x.id),['site-expanded-memory-bandwidth-20261103','site-expanded-arithmetic-intensity-20261103','site-source-publication-date-filter-20261103']);
 assert.equal(delta.site_changes.removed.length+delta.site_changes.updated.length,0);
 for(const change of delta.site_changes.added){
  assert.match(change.review_status,/previously_production_verified/);
  assert.match(change.release_status,/not_new_world_event/);
  assert.ok(!change.publication_date&&!change.event_date);
  assert.equal(D.safeCatalogPath(change.catalog_path),change.catalog_path);
  assert.ok(fs.existsSync(path.join(root,change.catalog_path)));
  assert.ok(change.added_to_atlas_at.startsWith('2026-11-03'));
 }
 assert.equal(D.safeCatalogPath('whats-new.html'),'whats-new.html');
 for(const bad of ['whats-new.html?evil=1','../whats-new.html','whats-new.html#unsafe'])assert.equal(D.safeCatalogPath(bad),'');
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'data/daily/published-batches.json'),'utf8'));
 assert.equal(ledger.receipts.length,2);
 const receipt=ledger.receipts.at(-1);
 assert.equal(receipt.publication_edition,'2026-11-03-v6');
 assert.equal(receipt.publication_history.at(-1).edition,'2026-11-03-v6');
 assert.equal(receipt.publication_history.find(x=>x.edition==='2026-11-03-v3').status,'cloudflare_http_browser_and_githack_verified');
 assert.equal(receipt.counts.news_published,8);
 assert.equal(receipt.counts.technology_added+receipt.counts.term_added,1);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,3);
 assert.equal(receipt.production_verified_revision,6);
 assert.equal(receipt.production_commit,'e549b579d413e717e4784ed942a20ad4c06529bc');
 assert.equal(receipt.production_workflow_run_id,41767787139);
 assert.equal(receipt.githack_workflow_run_id,41767787275);
 assert.equal(receipt.publication_history.find(x=>x.edition==='2026-11-03-v5').status,'cloudflare_http_browser_and_githack_verified');
 assert.equal(receipt.last_verified_public_url,'https://aiupdates.app/whats-new.html?date=2026-11-03&revision=6');
 assert.equal(idx.last_successful_publish_at,verifiedPublicationClock());
});

test('Source-date scope separates real Nov 3 reporting from catch-up, without using event or Atlas dates',()=>{
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const ref=idx.editions.find(x=>x.date==='2026-11-03'&&x.revision===3);
 assert.ok(ref,'Immutable November 3 version 3 must exist');
 const edition=JSON.parse(fs.readFileSync(ref.path,'utf8'));
 D.validateEdition(edition,ref);
 const count=scope=>edition.news.filter(item=>D.matchesPublicationTiming(item,'news',ref.date,scope)).length;
 assert.equal(count('all'),8);
 assert.equal(count('same-day'),4);
 assert.equal(count('catch-up'),4);
 assert.equal(count('undated'),0);
 assert.equal(count('postdated'),0);
 assert.equal(D.matchesPublicationTiming(edition.site_changes[0],'site_changes',ref.date,'catch-up'),false);
 assert.equal(D.matchesPublicationTiming({publication_date:'2026-11-02',event_date:'2026-11-03',added_to_atlas_at:'2026-11-03T19:00:00Z'},'news','2026-11-03','catch-up'),true);
 assert.equal(D.matchesPublicationTiming({event_date:'2026-11-03',discovered_at:'2026-11-03T19:00:00Z'},'news','2026-11-03','undated'),true);
 assert.equal(D.matchesPublicationTiming({publication_date:'2026-11-04'},'news','2026-11-03','postdated'),true);
 assert.equal(D.matchesPublicationTiming({publication_date:'2026-11-02'},'news','2026-11-03','invalid'),false);
});

test('Source-date scope round-trips through safe share links and filtered evidence CSV',()=>{
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const ref=idx.editions.find(x=>x.date==='2026-11-03'&&x.revision===3);
 const edition=JSON.parse(fs.readFileSync(ref.path,'utf8'));
 const url=D.filterPermalink(ref,{publication:'catch-up'});
 assert.equal(url,D.permalink(ref)+'&published=catch-up');
 assert.equal(D.viewFilters(url.slice(url.indexOf('?'))).publication,'catch-up');
 assert.equal(D.viewFilters('?published=catch-up&published=same-day').publication,'all');
 assert.equal(D.viewFilters('?published=%3Cscript%3E').publication,'all');
 assert.equal(D.viewFilters('?published=postdated').publication,'postdated');
 assert.equal(D.filterPermalink(ref,{publication:'not-a-date-scope'}),D.permalink(ref));
 const csv=D.citationCsv(edition,ref,{publication:'catch-up'});
 assert.equal(csv.split('\r\n').filter(Boolean).length,5,'CSV contains header plus exactly four catch-up news items');
 assert.match(csv,/Tohoku and Aisin/);
 assert.doesNotMatch(csv,/Chinese financial regulator warns/);
 assert.doesNotMatch(csv,/site-nov03-candidate-evidence-review/);
 const todayCsv=D.citationCsv(edition,ref,{publication:'same-day',section:'news'});
 assert.equal(todayCsv.split('\r\n').filter(Boolean).length,5);
 assert.match(todayCsv,/Chinese financial regulator warns/);
 assert.doesNotMatch(todayCsv,/Tohoku and Aisin/);
});

test('Publication-date view is accessible and wired to the same filter as CSV and share URL',()=>{
 const html=fs.readFileSync('whats-new.html','utf8');
 const js=fs.readFileSync('whats-new.js','utf8');
 assert.ok(html.includes('<label for="publication-filter">News source date<select id="publication-filter">'));
 assert.ok(html.includes('<option value="catch-up">'));
 assert.ok(html.includes('event, discovery and catalog-addition dates remain separate'));
 for(const token of [
  'C.matchesPublicationTiming(item,kind,edition.edition_date,publication)',
  "publication-filter').value=filters.publication",
  "publication-filter').addEventListener('change',render)",
  "publication-filter').value='all'",
  'Publisher date unreported'
 ])assert.ok(js.includes(token),'Missing archive UI wiring '+token);
});

test('TECH-0303 research profile is SHA-verified and source-qualified, not a dated new-world launch',()=>{
 const path=require('node:path'),crypto=require('node:crypto'),root=path.join(__dirname,'..');
 const bytes=fs.readFileSync(path.join(root,'data/technologies-08.json'));
 const rows=JSON.parse(bytes),manifest=JSON.parse(fs.readFileSync(path.join(root,'publication.json')));
 const meta=manifest.extensions.technologies.find(x=>x.path==='data/technologies-08.json');
 assert.equal(rows.length,1);assert.equal(meta.count,1);
 assert.equal(bytes.length,meta.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),meta.sha256);
 assert.equal(rows[0].id,'TECH-0303');assert.equal(rows[0].catalog_added_on,'2026-11-03');
 const tracked=manifest.catalog_additions.technologies.find(x=>x.id==='TECH-0303');
 assert.equal(tracked.source_proposal_id,'tech-proposal:tohoku-aisin:stt-mram-ai-soc:2026-11-03');
 assert.equal(manifest.published_counts.technologies-manifest.catalog_additions.technologies.length,300,'Original technology baseline retained');
 assert.equal(rows[0].initial_release_date,null);
 assert.match(rows[0].kind,/Research hardware prototype/);
 assert.match(rows[0].watch_out,/65.7 ms.*124.2 ms/);
 assert.equal(rows[0].source_url,'https://www.tohoku.ac.jp/japanese/2026/11/press20261102-03-emram.html');
 assert.equal(new Set(rows[0].primary_sources.map(x=>x.url)).size,3);
 assert.deepEqual(rows[0].concept_ids,['MLD-0724','MLD-0062']);
 assert.ok(fs.existsSync(path.join(root,'technology/TECH-0303-tohoku-aisin-16-nm-stt-mram-edge-ai-soc.html')));
 const nov3=JSON.parse(fs.readFileSync(path.join(root,'data/daily/editions/2026-11-03-v4.json')));
 assert.equal(nov3.technologies.length,0,'Immutable prior edition cannot claim a retroactive canonical addition');
});

test('November 3 v5 archives one real canonical technology without changing original news evidence',()=>{
 const {createHash}=require('node:crypto');
 const old=JSON.parse(fs.readFileSync('data/daily/editions/2026-11-03-v4.json','utf8'));
 const filename='data/daily/editions/2026-11-03-v5.json';
 const body=fs.readFileSync(filename);
 const next=JSON.parse(body);
 const archive=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const entry=archive.editions.find(x=>x.date==='2026-11-03'&&x.revision===5);
 assert.ok(entry,'immutable v5 archive index entry');
 assert.equal(entry.bytes,body.length);
 assert.equal(entry.sha256,createHash('sha256').update(body).digest('hex'));
 assert.equal(D.validateEdition(next,entry).edition_date,'2026-11-03');
 for(const section of ['news','terms','corrections'])assert.deepEqual(next[section],old[section],section+' retained');
 assert.deepEqual(next.coverage.sources_checked,old.coverage.sources_checked);
 assert.deepEqual(next.coverage.sources_failed,old.coverage.sources_failed);
 assert.equal(next.coverage.status,'partial');
 assert.equal(next.technologies.length,1);
 const item=next.technologies[0];
 assert.equal(item.id,'TECH-0303');
 assert.equal(item.publication_date,'2026-11-02');
 assert.equal(item.event_date,'2026-11-02');
 assert.match(item.release_status,/new_to_atlas/);
 assert.match(item.caveat,/not independently reproduced/);
 assert.ok(fs.existsSync(item.catalog_path),'canonical technology detail page exists');
 const actual=JSON.parse(fs.readFileSync('data/technologies-08.json','utf8')).find(x=>x.id===item.id);
 assert.ok(actual);
 assert.equal(actual.catalog_added_on,'2026-11-03');
 assert.ok(next.site_changes.some(x=>x.id==='site-dated-edition-source-snapshot-20261103'));
 assert.equal(next.site_changes.length,old.site_changes.length+1);
 const ids=[...next.news,...next.technologies,...next.terms,...next.site_changes,...next.corrections].map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length,'no duplicate cross-section IDs');
});


test('November 3 v5 verification receipts retain historical v4 proof and source provenance',()=>{
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const receipt=ledger.receipts.at(-1),arch=idx.editions.at(-1);
 assert.equal(arch.date,'2026-11-03');
 assert.equal(arch.revision,6);
 assert.equal(receipt.publication_edition,'2026-11-03-v6');
 assert.equal(idx.status,'edition_revision_6_production_verified');
 assert.equal(idx.last_successful_publish_at,receipt.production_verified_at);
 assert.equal(receipt.production_commit,'e549b579d413e717e4784ed942a20ad4c06529bc');
 assert.equal(receipt.production_workflow_run_id,41767787139);
 assert.equal(receipt.githack_workflow_run_id,41767787275);
 assert.deepEqual(receipt.accepted_catalog_addition_ids,['tech-proposal:tohoku-aisin:stt-mram-ai-soc:2026-11-03']);
 assert.equal(receipt.counts.technology_added,1);
 assert.equal(receipt.counts.catalog_deferred,3);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,3);
 assert.ok(!receipt.deferred_catalog_proposal_ids.includes(receipt.accepted_catalog_addition_ids[0]));
 const old=receipt.publication_history.find(x=>x.edition==='2026-11-03-v4');
 const latest=receipt.publication_history.find(x=>x.edition==='2026-11-03-v5');
 assert.equal(old.production_commit,'38409e2ecc75afcfd783b3a048500ad64afd9eb5');
 assert.equal(old.production_workflow_run_id,41732217253);
 assert.equal(old.githack_workflow_run_id,41732217128);
 assert.equal(latest.edition,'2026-11-03-v5');
 assert.equal(latest.status,'cloudflare_http_browser_and_githack_verified');
 assert.equal(latest.verified_at,'2026-11-04T01:45:26Z','Historical v5 proof must not adopt v6 timestamp');
 assert.equal(latest.source_batch_sha256,receipt.source_batch_sha256);
 assert.equal(receipt.source_batch_sha256,'f6d155caec1fda714b8fdd456ec47cc886dd10856159b65b9745c69d64b9adb3');
});


test('November 3 v6 indexes exactly two already-live educational guides without new-world claims',()=>{
 const crypto=require('node:crypto');
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const entry=idx.editions.find(e=>e.date==='2026-11-03'&&e.revision===6);
 assert.ok(entry,'New immutable revision must be indexed');
 const raw=fs.readFileSync(entry.path),next=JSON.parse(raw);
 assert.equal(raw.length,entry.bytes);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),entry.sha256);
 assert.equal(D.validateEdition(next,entry).edition_date,'2026-11-03');
 const old=JSON.parse(fs.readFileSync('data/daily/editions/2026-11-03-v5.json','utf8'));
 for(const section of ['news','technologies','terms','corrections','coverage'])assert.deepEqual(next[section],old[section],'Historical evidence mutated: '+section);
 assert.equal(next.news.length,8);assert.equal(next.technologies.length,1);assert.equal(next.terms.length,0);
 assert.equal(next.coverage.sources_checked.length,14);assert.equal(next.coverage.sources_failed.length,3);
 const delta=D.revisionDiff(old,next);
 assert.deepEqual(delta.site_changes.added.map(x=>x.id),['site-expanded-structured-output-20261103','site-expanded-exact-match-20261103']);
 assert.equal(delta.site_changes.removed.length+delta.site_changes.updated.length,0);
 assert.equal(next.site_changes.length,old.site_changes.length+2);
 for(const item of delta.site_changes.added){
  assert.equal(item.source_url,'https://github.com/hazelfjeld/ai-atlas/pull/56');
  assert.match(item.review_status,/previously_production_verified/);
  assert.match(item.release_status,/not_new_world_event/);
  assert.ok(!item.publication_date&&!item.event_date,'No fabricated date of new research');
  assert.ok(item.added_to_atlas_at.startsWith('2026-11-04T02:32:52Z'));
  assert.equal(D.safeCatalogPath(item.catalog_path),item.catalog_path);
  assert.ok(fs.existsSync(item.catalog_path));
 }
 assert.equal(new Set([...next.news,...next.technologies,...next.terms,...next.site_changes,...next.corrections].map(x=>x.id)).size,8+1+next.site_changes.length);
 assert.equal(D.matchesPublicationTiming(next.news[0],'news','2026-11-03','catch-up'),true);
 assert.equal(next.tldr.length,3);
});

test('Verified v6 preserves collector provenance and records actual production proof',()=>{
 const ledger=JSON.parse(fs.readFileSync('data/daily/published-batches.json','utf8'));
 const idx=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
 const receipt=ledger.receipts.at(-1);
 assert.equal(ledger.receipts.length,2,'No duplicate immutable collector batch');
 assert.equal(receipt.source_batch_sha256,'f6d155caec1fda714b8fdd456ec47cc886dd10856159b65b9745c69d64b9adb3');
 assert.equal(receipt.source_commit,'9a2d9a0f21551737b041a49e398ebf08793272ae');
 assert.equal(receipt.publication_edition,'2026-11-03-v6');
 assert.equal(receipt.publication_history.at(-1).status,'cloudflare_http_browser_and_githack_verified');
 assert.equal(receipt.production_verified_revision,6);
 assert.equal(idx.last_successful_publish_at,'2026-11-04T03:35:50Z');
 assert.equal(receipt.last_verified_public_url,'https://aiupdates.app/whats-new.html?date=2026-11-03&revision=6');
 assert.deepEqual(receipt.accepted_catalog_addition_ids,['tech-proposal:tohoku-aisin:stt-mram-ai-soc:2026-11-03']);
 assert.equal(receipt.deferred_catalog_proposal_ids.length,3);
});


test('filtering an older verified edition cannot end a pending revision loading state',()=>{
 const js=fs.readFileSync('whats-new.js','utf8');
 const render=js.slice(js.indexOf('function render(){'),js.indexOf('async function request(path){'));
 const switching=js.slice(js.indexOf('async function switchEdition(entry){'),js.indexOf('function populateArchive(selected){'));
 assert.ok(render.includes('syncVerifiedUrl()'));
 assert.doesNotMatch(render,/setAttribute\('aria-busy','false'\)/,'Filtering verified older content must not announce that pending revision verification is complete');
 assert.match(switching,/\$\('edition-select'\)\.value=entry\.path;\s*\$\('edition-content'\)\.setAttribute\('aria-busy','false'\);/,'Only the successfully verified revision should clear the busy state');
 assert.match(switching,/if\(requestEpoch!==switchEpoch\)return/,'Superseded revision loads must not update the page');
});

test('Failed archive selection explains rollback beside the picker without stealing keyboard focus',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 assert.match(html,/<select id="edition-select" aria-describedby="edition-selection-error" disabled>/);
 assert.match(html,/<p id="edition-selection-error" class="selection-error" role="note" hidden><\/p>/);
 assert.match(js,/selectionFeedback\(\); \/\/ Remove the prior inline error/);
 assert.match(js,/Still showing the previously verified edition/);
 assert.match(js,/note\.hidden=!message/);
 assert.match(js,/\$\('edition-select'\)\.value=active\.path/);
});

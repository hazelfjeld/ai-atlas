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
 assert.match(js,/for\(const entry of candidates\.slice\(0,4\)\)/);
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
test('Dated permalink only appears for a hash-verified edition; failed selection retains verified link',()=>{
 const html=fs.readFileSync('whats-new.html','utf8'),js=fs.readFileSync('whats-new.js','utf8');
 assert.match(html,/id="edition-permalink-wrap"[^>]* hidden/);
 assert.match(html,/id="edition-permalink"/);
 assert.match(js,/requestedEdition\(index,window\.location\.search,today\)/);
 assert.match(js,/edition-permalink'\)\.href=C\.permalink\(entry\)/);
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
test('The unfiltered daily reader shows explicit zero-count editorial sections',()=>{
 const script=fs.readFileSync('whats-new.js','utf8');
 for(const text of [
 'No newly integrated technology profile was published',
 'Deferred proposals are not catalog additions',
 'New to AI Updates is not the same as new to the world',
 'No correction was recorded',
 "if(!records.length&&topic!=='all')continue",
 'C.matchesTopic(item,topic)'
 ])assert.ok(script.includes(text),text);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

test('HTML escaping protects all markup-sensitive characters',()=>assert.equal(C.escapeHTML(`<script x="a">'&`),'&lt;script x=&quot;a&quot;&gt;&#39;&amp;'));
test('Safe URLs reject executable and credential-bearing URLs',()=>{for(const url of ['javascript:alert(1)','data:text/html,<script>','file:///etc/passwd','https://user:pass@example.org'])assert.equal(C.safeURL(url),'');assert.equal(C.safeURL('https://arxiv.org/abs/1234.56789'),'https://arxiv.org/abs/1234.56789');});
test('Search is case/accent-insensitive and matches all query words',()=>{const r={name:'Évaluation',tags:['Reward hacking']};assert.equal(C.matches(r,'evaluation REWARD'),true);assert.equal(C.matches(r,'reward unrelated'),false);assert.equal(C.matches(r,''),true);});
test('CSV exports escape quotes, multiline fields and formula injection',()=>{const s=C.csv([{name:'=HYPERLINK("bad")',notes:'a\nb',other:' @SUM(1)'}]);assert.ok(s.includes('"\'=HYPERLINK(""bad"")"'));assert.ok(s.includes('"a\nb"'));assert.ok(s.includes('"\' @SUM(1)"'));});
test('BibTeX marks an abbreviated author list and escapes braces',()=>{const s=C.bibtex({arxiv_id:'2610.04083',title:'{Safety}',authors:['A Author'],authors_complete:false,published_at:'2026-10-02',source_url:'https://arxiv.org/abs/2610.04083'});assert.ok(s.includes('A Author and others'));assert.ok(s.includes('\\{Safety\\}'));});
test('Date formatting is stable across local timezones',()=>assert.equal(C.formatDate('2026-11-01'),'Nov 1, 2026'));
test('Unknown dates do not invent precision',()=>{assert.equal(C.formatDate(null),'Not specified');assert.equal(C.formatDate('2026-Q2'),'2026-Q2');});
test('Staleness distinguishes missing and fresh health records',()=>{const now=Date.parse('2026-11-01T12:00:00Z');assert.equal(C.isStale(null,24,now),true);assert.equal(C.isStale('2026-11-01T10:00:00Z',24,now),false);assert.equal(C.isStale('2026-10-20T10:00:00Z',24,now),true);});
test('Notebook import accepts only known IDs and bounded data',()=>{const ids=new Set(['TECH-0001','PAPER-X']);const n=C.validateNotebook({schema:1,saved:['TECH-0001','TECH-0001','bad'],notes:{'TECH-0001':'a'.repeat(30000),bad:'bad'},compare:['PAPER-X','TECH-0001']},ids);assert.deepEqual(n.saved,['TECH-0001']);assert.equal(n.notes['TECH-0001'].length,20000);assert.equal(n.notes.bad,undefined);assert.deepEqual(n.compare,['TECH-0001']);});
test('Notebook rejects mismatched schema',()=>assert.throws(()=>C.validateNotebook({schema:2},new Set()),/Unsupported/));
test('Search helper tolerates missing text',()=>assert.equal(C.matches({name:null},'not-here'),false));
test('Exact technology names outrank incidental profile mentions',()=>{assert.ok(C.relevance({name:'PyTorch'},'pytorch')>C.relevance({name:'GPyTorch'},'pytorch'));assert.ok(C.relevance({name:'PyTorch FSDP2'},'pytorch')>C.relevance({name:'Other tool',what:'Uses PyTorch'},'pytorch'));});

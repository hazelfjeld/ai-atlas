'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const guides = JSON.parse(fs.readFileSync(path.join(root, 'content/term-guides.json'), 'utf8'));
const termManifest = JSON.parse(fs.readFileSync(path.join(root, 'terms/manifest.json'), 'utf8'));
const safetyIDs = ['MLD-1149', 'MLD-1039', 'MLD-0470', 'MLD-0469', 'MLD-0280', 'MLD-1119', 'MLD-0017'];
test('Safety guide additions have mechanisms, examples, tests, caveats and primary citations', () => {
  for (const id of safetyIDs) {
    const g = guides[id];
    assert.ok(g, 'Missing guide ' + id);
    assert.ok(termManifest[id], 'Missing stable term URL ' + id);
    assert.match(g.reviewed_on, /^20\d\d-\d\d-\d\d$/);
    assert.ok(g.sections.length >= 6, 'Too shallow: ' + id);
    assert.ok(g.sections.every(s => Array.isArray(s) && s.length === 2 && s[0].length >= 8 && s[1].length >= 120), 'Weak section: ' + id);
    assert.ok(g.prerequisites.every(x => termManifest[x]), 'Broken prerequisite: ' + id);
    assert.ok(g.citations.length >= 2 && g.citations.every(c => c.length === 2 && new URL(c[1]).protocol === 'https:'), 'Citations: ' + id);
  }
});
test('Every authored guide has unique section labels and a published reference route', () => {
  for (const [id, g] of Object.entries(guides)) {
    assert.ok(termManifest[id], 'Orphan authored guide ' + id);
    assert.equal(new Set(g.sections.map(s => s[0])).size, g.sections.length, 'Duplicate guide heading ' + id);
  }
});

test('New monitoring guides distinguish hypotheses, constructed evaluations and observed conduct', () => {
  const ids = ['MLD-0280', 'MLD-1119', 'MLD-0017'];
  const patterns = {
    'MLD-0280': /hypothesis|proposed/i,
    'MLD-1119': /sandbox|controlled/i,
    'MLD-0017': /probe|classifier/i,
  };
  for (const id of ids) {
    const g = guides[id];
    const body = g.sections.map(s => s[1]).join(' ');
    assert.ok(g.sections.length >= 7, 'Detailed evaluation protocol required: ' + id);
    assert.match(body, patterns[id], 'Missing core mechanism: ' + id);
    assert.match(body, /not (?:prove|establish)|does not (?:establish|prove|claim)|insufficient|not evidence|neither proves/i, 'Missing evidence boundary: ' + id);
    assert.ok(g.citations.every(c => c[0].length > 35 && /^https:\/\//.test(c[1])), 'Primary attribution: ' + id);
  }
});


test('New mechanistic and adversarial evaluation guides have checked evidence boundaries', () => {
  const expected = {
    'MLD-0718': /activation patching|causal|superposition/i,
    'MLD-1002': /threat model|authorization|untrusted/i,
  };
  for (const [id, mechanism] of Object.entries(expected)) {
    const g = guides[id];
    assert.ok(g && termManifest[id], 'Missing published guide ' + id);
    assert.equal(g.reviewed_on, '2026-11-02');
    assert.ok(g.sections.length >= 8 && g.sections.every(([heading, body]) => heading.length >= 8 && body.length >= 120));
    assert.ok(g.prerequisites.length >= 3 && g.prerequisites.every(term => !!termManifest[term]));
    const body = g.sections.map(section => section[1]).join(' ');
    assert.match(body, mechanism);
    assert.match(body, /not (?:prove|necessarily)|does not (?:prove|establish)|not evidence|no[t]? automatically|not the final validation/i);
    assert.ok(g.citations.length >= 3 && g.citations.every(([title, url]) => title.length >= 35 && /^https:\/\//.test(url)));
  }
});


test('Agent evaluation and capability failure guides distinguish objectives, skills and observed actions', () => {
  const required = {
    'MLD-0041': [/final environment state|final database/i, /tool call|trajectory/i, /unauthorized|forbidden/i, /not proof|not evidence|does not prove/i],
    'MLD-0146': [/capability failure/i, /goal misgeneralization/i, /proxy/i, /does not.*prove|not.*prove|not.*evidence/i]
  };
  for (const [id, patterns] of Object.entries(required)) {
    const g = guides[id];
    assert.ok(g && termManifest[id], 'Missing stable guide page: ' + id);
    assert.equal(g.reviewed_on, '2026-11-02');
    assert.ok(g.sections.length >= 8);
    assert.ok(g.sections.every(([heading, body]) => heading.length >= 8 && body.length >= 120));
    assert.ok(g.prerequisites.length >= 3 && g.prerequisites.every(x => termManifest[x]));
    assert.ok(g.citations.length >= 3 && g.citations.every(([title, url]) => title.length > 35 && new URL(url).protocol === 'https:'));
    const body = g.sections.map(x => x[1]).join(' ');
    for (const pattern of patterns) assert.match(body, pattern, 'Missing evidence boundary ' + id);
  }
});

test('Latest encyclopedia review date derives from guide evidence, not a hardcoded day', () => {
  const publication = JSON.parse(fs.readFileSync(path.join(root, 'publication.json'), 'utf8'));
  const latest = Object.values(guides).map(g => g.reviewed_on).sort().at(-1);
  assert.equal(publication.encyclopedia.reviewed_on, latest);
  assert.equal(publication.encyclopedia.detailed_page_count, Object.keys(guides).length);
});

test('Distribution shift and contamination guides have diagnostic experiments and evidence limits', () => {
  for (const [id, patterns] of Object.entries({
    'MLD-0326': [/covariate shift/i, /label shift/i, /concept drift/i, /held-out|untouched/i],
    'MLD-1254': [/train-test contamination/i, /verbatim|duplicate/i, /held-out|sealed/i, /not.*prove|not.*establish|does not.*prove/i]
  })) {
    const g = guides[id];
    assert.ok(g && termManifest[id], 'Guide missing from stable route ' + id);
    assert.equal(g.reviewed_on, '2026-11-02');
    assert.ok(g.sections.length >= 8);
    assert.ok(g.sections.every(([title, body]) => title.length >= 8 && body.length >= 120));
    assert.equal(new Set(g.sections.map(s => s[0])).size, g.sections.length);
    assert.ok(g.prerequisites.length >= 3 && g.prerequisites.every(x => termManifest[x]));
    assert.ok(g.citations.length >= 3 && g.citations.every(([title, url]) => title.length >= 35 && /^https:\/\//.test(url)));
    const text = g.sections.map(([_, body]) => body).join(' ');
    for (const pattern of patterns) assert.match(text, pattern, 'Missing evidence or mechanism ' + id);
    assert.match(text, /synthetic|toy|illustrat/i);
  }
});

test('Calibration and conformal prediction guides expose their assumptions, worked arithmetic and test boundaries', () => {
  const required = {
    'MLD-0142': [/P\(correct/i, /0\.80/i, /Brier score/i, /temperature scaling/i, /test labels/i, /not.*(?:establish|prove)|does not establish/i],
    'MLD-0198': [/exchangeab/i, /ceil\(/i, /n=9/i, /0\.9/i, /marginal coverage/i, /not.*(?:generally|ensure|prove)|does not.*(?:ensure|prove)/i]
  };
  for (const [id, patterns] of Object.entries(required)) {
    const g = guides[id];
    assert.ok(g && termManifest[id], 'Missing direct guide page '+id);
    assert.equal(g.reviewed_on, '2026-11-02');
    assert.ok(g.sections.length >= 9);
    assert.ok(g.sections.every(([heading, text]) => heading.length >= 8 && text.length >= 120));
    assert.equal(new Set(g.sections.map(([heading]) => heading)).size, g.sections.length);
    assert.ok(g.prerequisites.length >= 4 && g.prerequisites.every(x => termManifest[x]));
    assert.ok(g.citations.length >= 3 && g.citations.every(([title, url]) => title.length >= 35 && /^https:\/\//.test(url)));
    const body = g.sections.map(s => s[1]).join(' ');
    for (const pattern of patterns) assert.match(body, pattern, 'Missing mechanism or caveat '+id);
    const html = fs.readFileSync(path.join(root, termManifest[id].path), 'utf8');
    assert.match(html, /Expanded guide/);
    assert.match(html, /Sources for the expanded explanation/);
  }
});

test('Expected calibration error and subgroup evaluation preserve worked metrics, uncertainty and evidence limits', () => {
  const specifications = {
    'MLD-0389': [/ECE =/i, /0\.14/i, /bin/i, /Brier score/i, /test labels/i, /not (?:a guarantee|proof)|not proof|does not prove/i],
    'MLD-1184': [/subgroup/i, /85%/i, /40%/i, /worst-group/i, /missing group/i, /not automatically evidence|does not prove/i]
  };
  for (const [id, patterns] of Object.entries(specifications)) {
    const guide = guides[id];
    assert.ok(guide && termManifest[id], 'Missing stable expanded guide ' + id);
    assert.equal(guide.reviewed_on, '2026-11-02');
    assert.ok(guide.prerequisites.length >= 4 && guide.prerequisites.every(t => !!termManifest[t]), 'Missing prerequisite '+id);
    assert.ok(guide.sections.length >= 9, 'Missing worked explanation '+id);
    assert.ok(guide.sections.every(([h, b]) => h.length >= 8 && b.length >= 120), 'Shallow section '+id);
    assert.equal(new Set(guide.sections.map(([h]) => h)).size, guide.sections.length);
    assert.ok(guide.citations.length >= 3 && guide.citations.every(([name, url]) => name.length >= 35 && /^https:\/\//.test(url)));
    const body = guide.sections.map(([_, b]) => b).join(' ');
    for (const expression of patterns) assert.match(body, expression, 'Missing caveat or arithmetic '+id);
    const html = fs.readFileSync(path.join(root, termManifest[id].path), 'utf8');
    assert.match(html, /Expanded guide/);
    assert.match(html, /Sources for the expanded explanation/);
  }
});

test('Weak-supervisor and verifier guides use independent evaluation and bound overclaims', () => {
  const specifications = {
    'MLD-1323': [/weak.to.strong/i, /0\.75 - 0\.60/i, /0\.50/i, /independent/i, /sealed|held.out/i, /not.*proof|not.*certificate|not.*demonstration/i],
    'MLD-1308': [/verifier/i, /best.of.N/i, /argmax/i, /false.positive/i, /sandbox/i, /not.*(?:establish|prove)|does not establish/i]
  };
  for (const [id, patterns] of Object.entries(specifications)) {
    const g = guides[id];
    assert.ok(g && termManifest[id], 'Missing canonical guide path ' + id);
    assert.equal(g.reviewed_on, '2026-11-02');
    assert.ok(g.sections.length >= 9 && g.sections.every(([title, paragraph]) => title.length >= 8 && paragraph.length >= 120));
    assert.equal(new Set(g.sections.map(([heading]) => heading)).size, g.sections.length);
    assert.ok(g.prerequisites.length >= 4 && g.prerequisites.every(x => termManifest[x]), 'Unresolved prerequisite ' + id);
    assert.ok(g.citations.length >= 3 && g.citations.every(([name, url]) => name.length > 35 && /^https:\/\//.test(url)));
    const body = g.sections.map(([_, paragraph]) => paragraph).join(' ');
    for (const regex of patterns) assert.match(body, regex, 'Missing mechanism or evidence limit for ' + id);
    const html = fs.readFileSync(path.join(root, termManifest[id].path), 'utf8');
    assert.match(html, /Expanded guide/);
    assert.match(html, /Sources for the expanded explanation/);
  }
});

test('Agentic workflow and knowledge graph expansions explain mechanisms, constraints and evidence boundaries', () => {
  const rules = {
    'MLD-0043': [/agent harness/i,/authorization/i,/capability failure/i,/specification gaming/i,/held-out/i,/not.*automatically/i],
    'MLD-0608': [/RDF/i,/SPARQL/i,/semantic ontology layer/i,/provenance/i,/access control/i,/not.*automatically/i]
  };
  for (const [id, required] of Object.entries(rules)) {
    const g = guides[id];
    assert.ok(g && termManifest[id] && termManifest[id].expanded,'Not marked expanded: '+id);
    assert.equal(g.reviewed_on,'2026-11-02');
    assert.ok(g.sections.length>=9 && g.sections.every(([h,b])=>h.length>=8 && b.length>=120),'Insufficient explanatory depth');
    assert.equal(new Set(g.sections.map(([heading])=>heading)).size,g.sections.length);
    assert.ok(g.prerequisites.length>=4 && g.prerequisites.every(p=>termManifest[p]),'Broken prerequisite');
    assert.ok(g.citations.length>=3 && g.citations.every(([title,url])=>title.length>35 && new URL(url).protocol==='https:'),'Citation requirement');
    const full=g.sections.map(([,body])=>body).join(' ');
    for (const re of required) assert.match(full,re,'Missing explanation or evidence boundary: '+id);
    const html=fs.readFileSync(path.join(root,termManifest[id].path),'utf8');
    assert.match(html,/Expanded guide/);assert.match(html,/Sources for the expanded explanation/);
  }
  assert.ok(Object.keys(guides).length>=37, 'Previous guides must remain');
});

test('Benchmark and Environment are source-backed expanded agent-evaluation guides',()=>{
 for(const [id,checks] of Object.entries({
 'MLD-0110':[/20 held-out tasks/,/65%/,/75%/,/AgentBench/,/OSWorld/,/training overlap|contamination/i],
 'MLD-0371':[/step\(action\)/i,/terminated/,/truncated/,/transition/,/reward/,/sandbox/i]
 })){
  const g=guides[id],entry=termManifest[id];
  assert.ok(g&&entry&&entry.expanded,'Expanded guide missing: '+id);
  assert.equal(g.reviewed_on,'2026-11-02');
  assert.ok(g.sections.length>=9&&g.sections.every(([heading,body])=>heading.length>=8&&body.length>=120));
  assert.equal(new Set(g.sections.map(x=>x[0])).size,g.sections.length);
  assert.ok(g.prerequisites.length>=4&&g.prerequisites.every(x=>termManifest[x]));
  assert.ok(g.citations.length>=4&&g.citations.every(([title,url])=>title.length>35&&new URL(url).protocol==='https:'));
  const body=g.sections.map(x=>x[1]).join(' ');
  for(const re of checks)assert.match(body,re,'Missing evidence scope: '+id);
  const html=fs.readFileSync(path.join(root,entry.path),'utf8');
  assert.match(html,/Expanded guide/);
  assert.match(html,/Sources for the expanded explanation/);
 }
 assert.ok(Object.keys(guides).length>=37, 'Previous guides must remain');
});

test('Prompt injection guides distinguish untrusted content, authorization and controlled outcomes', () => {
  for (const [id, patterns] of Object.entries({
    'MLD-0957': [/trust boundary/i, /direct injection|direct attempt/i, /schema|typed/i, /false positive/i, /not automatically|does not establish|not.*proof/i],
    'MLD-0549': [/retrieval-augmented/i, /tool response|tool-output/i, /false-positive rate/i, /calendar state/i, /not.*prove|neither proves/i]
  })) {
    const guide = guides[id], route = termManifest[id];
    assert.ok(guide && route && route.expanded, 'Expanded guide missing: ' + id);
    assert.equal(guide.reviewed_on, '2026-11-02');
    assert.equal(guide.sections.length, 9);
    assert.ok(guide.sections.every(([heading, body]) => heading.length >= 8 && body.length >= 120));
    assert.equal(new Set(guide.sections.map(x => x[0])).size, guide.sections.length);
    assert.ok(guide.prerequisites.length >= 4 && guide.prerequisites.every(x => termManifest[x]), 'Broken prerequisite');
    assert.ok(guide.citations.length >= 4 && guide.citations.every(([title, url]) => title.length >= 35 && new URL(url).protocol === 'https:'));
    const body = guide.sections.map(s => s[1]).join(' ');
    for (const pattern of patterns) assert.match(body, pattern, 'Missing mechanism or caveat: ' + id);
    const html = fs.readFileSync(path.join(root, route.path), 'utf8');
    assert.match(html, /Expanded guide/);
    assert.match(html, /Sources for the expanded explanation/);
  }
  assert.ok(Object.keys(guides).length>=37, 'Previous guides must remain');
});


test('Reward modeling and overoptimization guides separate proxy scores from independent human quality', () => {
  for (const [id, patterns] of Object.entries({
    'MLD-1040': [/sigmoid/i, /0\.69/, /pairwise/i, /held-out/i, /RewardBench/i, /not.*(?:prove|automatically|validated)/i],
    'MLD-1041': [/best-of-N/i, /0\.12/, /KL/i, /blinded/i, /synthetic|invented/i, /not proof|not.*establish/i]
  })) {
    const g = guides[id];
    assert.ok(g && termManifest[id] && termManifest[id].expanded, 'Missing reviewed page: ' + id);
    assert.equal(g.reviewed_on, '2026-11-02');
    assert.ok(g.sections.length >= 9 && g.sections.every(([title, body]) => title.length >= 8 && body.length >= 120));
    assert.ok(g.prerequisites.length >= 4 && g.prerequisites.every(p => termManifest[p]), 'Broken prerequisite');
    assert.ok(g.citations.length >= 4 && g.citations.every(([name, url]) => name.length > 35 && new URL(url).protocol === 'https:'));
    const content = g.sections.map(([_, body]) => body).join(' ');
    for (const re of patterns) assert.match(content, re);
    const html = fs.readFileSync(path.join(root, termManifest[id].path), 'utf8');
    assert.match(html, /Expanded guide/);
    assert.match(html, /Sources for the expanded explanation/);
  }
});


test('Ablation and leakage research guides publish controlled examples and independent-test safeguards', () => {
 for (const id of ['MLD-0002','MLD-0263']) {
  const g=guides[id]; assert.ok(g && termManifest[id]?.expanded);
  assert.equal(g.reviewed_on,'2026-11-02'); assert.equal(g.sections.length,9);
  assert.ok(g.prerequisites.length>=4 && g.prerequisites.every(p=>termManifest[p]));
  assert.ok(g.sections.every(([h,b])=>h.length>=8 && b.length>=120));
  assert.ok(g.citations.length>=3 && g.citations.every(([h,u])=>h.length>30 && new URL(u).protocol === 'https:'));
  const body=g.sections.map(s=>s[1]).join(' ');
  assert.match(body,/illustrat|invented/i);
  assert.match(body,/not automatically|not evidence|not a universal|not published|not proof|does not/i);
  assert.match(body,id==='MLD-0002'?/paired random seeds|crossed experiments/i:/train.*test|prediction-time/i);
 }
});


test('Covariate shift and OOD guides distinguish assumptions, synthetic arithmetic and held-out evaluation', () => {
  for (const [id, patterns] of Object.entries({
    'MLD-0237': [/P\(Y\|X\)/, /importance.weight/i, /support overlap/i, /synthetic|invented/i, /not.*proof|not proof|does not establish/i],
    'MLD-0854': [/maximum.softmax/i, /FPR95/, /near.*OOD/i, /synthetic/i, /not evidence|not proof/i]
  })) {
    const g=guides[id], route=termManifest[id];
    assert.ok(g && route?.expanded, 'Stable expanded route missing: ' + id);
    assert.equal(g.reviewed_on, '2026-11-02');
    assert.equal(g.sections.length, 9);
    assert.ok(g.sections.every(([title,body])=>title.length>=8&&body.length>=120));
    assert.ok(g.prerequisites.length>=4&&g.prerequisites.every(pre=>termManifest[pre]));
    assert.ok(g.citations.length>=4&&g.citations.every(([name,url])=>name.length>=35&&new URL(url).protocol==='https:'));
    const body=g.sections.map(x=>x[1]).join(' ');
    for(const p of patterns)assert.match(body,p,'Missing mechanism or evidence limit in '+id);
    const page=fs.readFileSync(path.join(root,route.path),'utf8');
    assert.match(page,/Expanded guide/);
    assert.match(page,/Sources for the expanded explanation/);
  }
  assert.ok(Object.keys(guides).length>=43);
});

test('Poisoning and learned-backdoor guides distinguish training compromise from deployed incidents', () => {
  const expected = {
    'MLD-0268': [/data-to-model trust boundary/i, /0\.5%/, /targeted attack success/i, /held-out/i, /not proof|not automatically|not establish/i],
    'MLD-0085': [/96%/, /70%/, /false activation/i, /provenance/i, /not (?:establish|proof)|cannot exclude/i]
  };
  for (const [id, patterns] of Object.entries(expected)) {
    const guide = guides[id], route = termManifest[id];
    assert.ok(guide && route && route.expanded, 'Missing expanded route: ' + id);
    assert.equal(guide.reviewed_on, '2026-11-02');
    assert.equal(guide.sections.length, 9);
    assert.ok(guide.sections.every(([title, paragraph]) => title.length >= 8 && paragraph.length >= 120), 'Short section: ' + id);
    assert.equal(new Set(guide.sections.map(s => s[0])).size, 9);
    assert.ok(guide.prerequisites.length >= 4 && guide.prerequisites.every(prereq => termManifest[prereq]), 'Unknown prerequisite: ' + id);
    assert.equal(guide.citations.length, 4);
    assert.ok(guide.citations.every(([name, url]) => name.length >= 35 && new URL(url).protocol === 'https:'), 'Unattributed guide source: ' + id);
    const combined = guide.sections.map(s => s[1]).join(' ');
    for (const pattern of patterns) assert.match(combined, pattern, 'Expected mechanism/limit missing for ' + id);
    const rendered = fs.readFileSync(path.join(root, route.path), 'utf8');
    assert.match(rendered, /Expanded guide/);
    assert.match(rendered, /Sources for the expanded explanation/);
  }
  assert.ok(Object.keys(guides).length >= 47);
});

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

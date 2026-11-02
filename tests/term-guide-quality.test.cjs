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
    assert.match(body, /not (?:prove|establish)|does not (?:establish|prove)|insufficient|not evidence/i, 'Missing evidence boundary: ' + id);
    assert.ok(g.citations.every(c => c[0].length > 35 && /^https:\/\//.test(c[1])), 'Primary attribution: ' + id);
  }
});

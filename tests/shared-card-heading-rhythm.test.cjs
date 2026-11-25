const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Discover and four editorial card families share heading-to-summary spacing', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-shared-card-heading-rhythm:begin */')[1]
    ?.split('/* atlas-shared-card-heading-rhythm:end */')[0];
  assert.ok(block, 'Missing shared card rhythm');
  const titles = [
    '.story-body > h3',
    '.playbook-shell .playbook > h2',
    '.tech-shell .tech-card > h2',
    '.shell:has(> .site-chrome.nav) article.card > h3',
    '.shell:has(> .site-chrome.research-site-chrome) .cards > .card > h2'
  ];
  const summaries = titles.map(s => s.includes('.tech-card') ? '.tech-shell .tech-card > .lede' : s + ' + p');
  const rules = block.replace(/\/\*[\s\S]*?\*\//g, '').trim().split('}').filter(s => s.trim());
  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0].split('{')[0].split(',').map(s => s.trim()), titles);
  assert.deepEqual(rules[1].split('{')[0].split(',').map(s => s.trim()), summaries);
  assert.equal(rules[0].split('{')[1].trim(), 'margin-block:12px 11px;');
  assert.equal(rules[1].split('{')[1].trim(), 'margin-block-start:0;');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css), 'Offline must contain the exact shared stylesheet');
});
